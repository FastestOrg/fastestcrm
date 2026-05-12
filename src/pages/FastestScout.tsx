import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, Send, Bot, User, Sparkles, Check, X, ArrowUpRight,
  Loader2, Globe, Target, Mail, Linkedin, Building2, MapPin,
  Users, ChevronDown, ChevronUp, Download, RefreshCcw, Zap,
  CheckCircle2, MessageCircle, ExternalLink, Crown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'scout' | 'system';
  content: string;
  timestamp: Date;
  data?: any;
  type?: 'text' | 'confirmation' | 'results' | 'enriched' | 'saved' | 'error' | 'clarification';
}

interface ApolloLead {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  title: string;
  headline: string;
  email: string;
  email_status: string;
  linkedin_url: string;
  photo_url: string;
  city: string;
  state: string;
  country: string;
  organization: {
    name: string;
    website_url: string;
    industry: string;
    estimated_num_employees: number;
    short_description: string;
    logo_url: string;
    founded_year: number;
    keywords: string[];
  };
}

interface EnrichedLead {
  id: string;
  vibe_score: number;
  vibe_category: string;
  relevance_reason: string;
  icebreaker: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function FastestScout() {
  const { session } = useAuth();
  const { company } = useCompany();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'scout',
      content: "I'm **Fastest-Scout**, your AI Sales Intelligence Agent. Describe your ideal prospect and I'll find them using Apollo.io's database of 275M+ contacts.\n\nTry something like:\n- *\"Find me CTOs of AI startups in San Francisco\"*\n- *\"Series B fintech companies in London with 50-200 employees\"*\n- *\"VP of Sales at SaaS companies in India\"*",
      timestamp: new Date(),
      type: 'text',
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [pendingParams, setPendingParams] = useState<any>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [leads, setLeads] = useState<ApolloLead[]>([]);
  const [enrichedMap, setEnrichedMap] = useState<Record<string, EnrichedLead>>({});
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [savingToCRM, setSavingToCRM] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, isThinking]);

  const addMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
    ]);
  };

  // ─── Step 1: Interpret ──────────────────────────────────────────────
  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || isThinking) return;

    setInput('');
    setOriginalPrompt(prompt);
    addMessage({ role: 'user', content: prompt, type: 'text' });
    setIsThinking(true);

    if (!company?.id) {
      addMessage({
        role: 'scout',
        content: '⚠️ Company profile not loaded. Please refresh the page.',
        type: 'error',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('fastest-scout', {
        body: { action: 'interpret', prompt, company_id: company?.id },
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Empty response from Scout AI');

      if (data.needs_clarification) {
        addMessage({
          role: 'scout',
          content: data.message,
          type: 'clarification',
        });
      } else {
        setPendingParams(data.apollo_params);
        addMessage({
          role: 'scout',
          content: `**Here's what I found in your request:**\n\n${data.summary}\n\nShall I run the search with these filters?`,
          type: 'confirmation',
          data: data,
        });
      }
    } catch (err: any) {
      addMessage({
        role: 'scout',
        content: `⚠️ ${err.message || 'Something went wrong during interpretation.'}`,
        type: 'error',
      });
    } finally {
      setIsThinking(false);
    }
  };

  // ─── Step 2: Search ─────────────────────────────────────────────────
  const handleApproveSearch = async () => {
    if (!pendingParams) return;
    setIsThinking(true);

    addMessage({
      role: 'system',
      content: '🔍 Running Apollo.io search...',
      type: 'text',
    });

    if (!company?.id) {
      addMessage({ role: 'scout', content: '⚠️ Company profile not loaded.', type: 'error' });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('fastest-scout', {
        body: { action: 'search', apollo_params: pendingParams, company_id: company?.id },
      });

      if (error) throw new Error(error.message);
      if (!data || !data.leads) throw new Error('No results returned from Apollo');

      setLeads(data.leads);
      setPendingParams(null);

      addMessage({
        role: 'scout',
        content: `Found **${data.total_count.toLocaleString()} total prospects**. Showing the first ${data.leads.length}. Let me run a Vibe Check to score relevance...`,
        type: 'results',
        data: { total_count: data.total_count },
      });

      // Automatically trigger enrichment
      await handleEnrich(data.leads, originalPrompt);
    } catch (err: any) {
      addMessage({
        role: 'scout',
        content: `⚠️ Search failed: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsThinking(false);
    }
  };

  // ─── Step 3: Enrich ─────────────────────────────────────────────────
  const handleEnrich = async (leadsToEnrich: ApolloLead[], prompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fastest-scout', {
        body: {
          action: 'enrich',
          leads: leadsToEnrich,
          original_prompt: prompt,
          company_id: company?.id
        },
      });

      if (error) throw new Error(error.message);

      // Build enrichment map
      const map: Record<string, EnrichedLead> = {};
      (data.enriched_leads || []).forEach((el: EnrichedLead) => {
        map[el.id] = el;
      });
      setEnrichedMap(map);

      addMessage({
        role: 'scout',
        content: `**Vibe Check Complete!** ${data.quick_summary}\n\nI've scored each prospect. Select the ones you'd like to import into your CRM.`,
        type: 'enriched',
        data: data,
      });
    } catch (err: any) {
      addMessage({
        role: 'scout',
        content: `⚠️ Enrichment failed: ${err.message}. You can still browse and import the raw results below.`,
        type: 'error',
      });
    }
  };

  // ─── Step 4: Save to CRM ───────────────────────────────────────────
  const handleSaveToCRM = async () => {
    if (selectedLeads.size === 0) {
      toast({ title: 'No leads selected', description: 'Select at least one lead to import.', variant: 'destructive' });
      return;
    }

    if (!company?.id) {
      toast({ title: 'Error', description: 'Company profile not loaded.', variant: 'destructive' });
      return;
    }

    setSavingToCRM(true);
    try {
      const leadsToSave = leads.filter((l) => selectedLeads.has(l.id));
      const { data, error } = await supabase.functions.invoke('fastest-scout', {
        body: {
          action: 'save_to_crm',
          leads_to_save: leadsToSave,
          company_id: company?.id,
          user_id: session?.user?.id,
        },
      });

      if (error) throw new Error(error.message);

      addMessage({
        role: 'scout',
        content: `✅ **${data.count} leads imported** to your CRM successfully! They're now in your "All Leads" view with source "Fastest Scout (Apollo)".`,
        type: 'saved',
      });

      setSelectedLeads(new Set());

      toast({ title: 'Leads Imported!', description: data.message });
    } catch (err: any) {
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingToCRM(false);
    }
  };

  const handleRejectSearch = () => {
    setPendingParams(null);
    addMessage({
      role: 'scout',
      content: "No worries! Describe your target prospect differently and I'll extract new filters.",
      type: 'text',
    });
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllLeads = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getVibeColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (score >= 50) return 'text-blue-400 bg-blue-500/15 border-blue-500/30';
    return 'text-slate-400 bg-slate-500/15 border-slate-500/30';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-black/95 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-violet-950/20 to-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20">
                <Search className="h-5 w-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <h1
                className="text-xl font-extrabold tracking-tight text-white"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Fastest-Scout
              </h1>
              <p className="text-xs text-slate-500">
                AI Sales Intelligence Agent · Apollo.io Powered
              </p>
            </div>
          </div>
          {leads.length > 0 && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllLeads}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
              >
                {selectedLeads.size === leads.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveToCRM}
                disabled={selectedLeads.size === 0 || savingToCRM}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white h-8 text-xs gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                {savingToCRM ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Import {selectedLeads.size > 0 ? `(${selectedLeads.size})` : ''} to CRM
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Chat + Results Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className={`flex flex-col ${leads.length > 0 ? 'w-[45%] border-r border-slate-800' : 'w-full'} transition-all duration-300`}>
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4 max-w-2xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {msg.role !== 'user' && (
                    <div className="shrink-0 mt-1">
                      <div className={`p-1.5 rounded-lg ${msg.role === 'scout' ? 'bg-violet-500/20' : 'bg-slate-800'}`}>
                        {msg.role === 'scout' ? (
                          <Bot className="h-4 w-4 text-violet-400" />
                        ) : (
                          <Zap className="h-4 w-4 text-blue-400" />
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-md'
                        : msg.type === 'error'
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-slate-900/80 border border-slate-800 text-slate-200'
                    }`}
                  >
                    {/* Render markdown-lite content */}
                    <div
                      className="prose-sm prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/\n/g, '<br/>'),
                      }}
                    />

                    {/* Confirmation buttons */}
                    {msg.type === 'confirmation' && pendingParams && (
                      <div className="mt-4 space-y-3">
                        {msg.data?.extracted_entities && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.data.extracted_entities.titles?.map((t: string) => (
                              <Badge key={t} className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px]">
                                👤 {t}
                              </Badge>
                            ))}
                            {msg.data.extracted_entities.locations?.map((l: string) => (
                              <Badge key={l} className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">
                                📍 {l}
                              </Badge>
                            ))}
                            {msg.data.extracted_entities.industries?.map((i: string) => (
                              <Badge key={i} className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                                🏢 {i}
                              </Badge>
                            ))}
                            {msg.data.extracted_entities.keywords?.map((k: string) => (
                              <Badge key={k} className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                                🔑 {k}
                              </Badge>
                            ))}
                            {msg.data.extracted_entities.employee_range && (
                              <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-[10px]">
                                👥 {msg.data.extracted_entities.employee_range}
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleApproveSearch}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs gap-1.5"
                          >
                            <Check className="h-3.5 w-3.5" /> Run Search
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRejectSearch}
                            className="border-slate-700 text-slate-400 hover:bg-slate-800 h-8 text-xs gap-1.5"
                          >
                            <X className="h-3.5 w-3.5" /> Refine
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="shrink-0 mt-1">
                      <div className="p-1.5 rounded-lg bg-violet-600/30">
                        <User className="h-4 w-4 text-violet-300" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isThinking && (
                <div className="flex gap-3 animate-in fade-in duration-300">
                  <div className="shrink-0 mt-1">
                    <div className="p-1.5 rounded-lg bg-violet-500/20">
                      <Bot className="h-4 w-4 text-violet-400" />
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-slate-500 ml-1">Scout is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80">
            <div className="max-w-2xl mx-auto flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your ideal prospect..."
                  className="min-h-[44px] max-h-[120px] resize-none bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 rounded-xl pr-12 focus:border-violet-500/50 focus:ring-violet-500/20"
                  rows={1}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                  className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-lg bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-500/20 disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        {leads.length > 0 && (
          <div className="w-[55%] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-white">
                  Prospects ({leads.length})
                </h3>
                {Object.keys(enrichedMap).length > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                    <Sparkles className="h-3 w-3 mr-1" /> Vibe Checked
                  </Badge>
                )}
              </div>
              <span className="text-xs text-slate-500">
                {selectedLeads.size} selected
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {leads.map((lead) => {
                  const enrichment = enrichedMap[lead.id];
                  const isSelected = selectedLeads.has(lead.id);
                  const isExpanded = expandedCards.has(lead.id);

                  return (
                    <div
                      key={lead.id}
                      className={`rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? 'border-violet-500/40 bg-violet-500/5'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      }`}
                    >
                      {/* Lead Header */}
                      <div className="p-3 flex items-start gap-3">
                        {/* Selection checkbox */}
                        <button
                          onClick={() => toggleLeadSelection(lead.id)}
                          className={`mt-1 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-violet-600 border-violet-500'
                              : 'border-slate-600 hover:border-slate-400'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </button>

                        {/* Avatar */}
                        <div className="shrink-0">
                          {lead.photo_url ? (
                            <img
                              src={lead.photo_url}
                              alt={lead.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600/40 to-indigo-600/40 flex items-center justify-center">
                              <span className="text-sm font-bold text-violet-300">
                                {lead.first_name?.[0]}{lead.last_name?.[0]}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-white truncate">
                              {lead.name}
                            </h4>
                            {enrichment && (
                              <Badge
                                className={`text-[10px] shrink-0 ${getVibeColor(enrichment.vibe_score)}`}
                              >
                                {enrichment.vibe_score}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">
                            {lead.title}
                          </p>
                          {lead.organization?.name && (
                            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {lead.organization.name}
                              {lead.organization.industry && (
                                <span className="text-slate-600">· {lead.organization.industry}</span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* Expand toggle */}
                        <button
                          onClick={() => toggleCard(lead.id)}
                          className="shrink-0 p-1 rounded hover:bg-slate-800 text-slate-500"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Enrichment badge row */}
                      {enrichment && (
                        <div className="px-3 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">
                              {enrichment.vibe_category}
                            </span>
                            {enrichment.relevance_reason && (
                              <span className="text-[10px] text-slate-600 truncate">
                                — {enrichment.relevance_reason}
                              </span>
                            )}
                          </div>
                          {enrichment.icebreaker && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                              <div className="flex items-start gap-1.5">
                                <Crown className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-amber-300/90 italic leading-relaxed">
                                  "{enrichment.icebreaker}"
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-800/50 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          {lead.email && (
                            <div className="flex items-center gap-2 text-xs">
                              <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                              <span className="text-slate-300">{lead.email}</span>
                              {lead.email_status === 'verified' && (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              )}
                            </div>
                          )}
                          {lead.linkedin_url && (
                            <a
                              href={lead.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <Linkedin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{lead.linkedin_url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          )}
                          {(lead.city || lead.country) && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                            </div>
                          )}
                          {lead.organization?.short_description && (
                            <p className="text-xs text-slate-500 leading-relaxed mt-1">
                              {lead.organization.short_description}
                            </p>
                          )}
                          {lead.organization?.estimated_num_employees && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Users className="h-3 w-3 shrink-0" />
                              ~{lead.organization.estimated_num_employees.toLocaleString()} employees
                            </div>
                          )}
                          {lead.organization?.website_url && (
                            <a
                              href={lead.organization.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                            >
                              <Globe className="h-3 w-3 shrink-0" />
                              <span className="truncate">{lead.organization.website_url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          )}
                          {lead.organization?.keywords?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {lead.organization.keywords.slice(0, 6).map((kw) => (
                                <Badge
                                  key={kw}
                                  variant="outline"
                                  className="text-[9px] border-slate-700 text-slate-500"
                                >
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
