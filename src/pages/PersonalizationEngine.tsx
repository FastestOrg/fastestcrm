import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Loader2, MessageCircle, Mail, Zap,
  User, Send, RefreshCcw, Copy, CheckCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';

type Channel = 'whatsapp' | 'email';
type Tone = 'professional' | 'casual' | 'urgent' | 'warm';

interface GeneratedMessage {
  channel: Channel;
  subject?: string;
  body: string;
  personalization_notes: string;
}

export default function PersonalizationEngine() {
  const { company } = useCompany();
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [tone, setTone] = useState<Tone>('professional');
  const [goal, setGoal] = useState('book_meeting');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedMessage | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => { if (company?.id) fetchLeads(); }, [company?.id]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, name, status, phone, email, updated_at')
      .eq('company_id', company?.id)
      .limit(50)
      .order('updated_at', { ascending: false });
    setLeads(data || []);
  };

  const generateMessage = async () => {
    if (!selectedLead) { toast({ title: 'Select a lead first', variant: 'destructive' }); return; }
    setGenerating(true);
    setGenerated(null);
    try {
      const goalMap: Record<string, string> = {
        book_meeting: 'Book a meeting or call',
        demo_scheduled: 'Schedule a product demo',
        site_visit: 'Book a property/site visit',
        sale_closed: 'Advance toward a sale decision',
        follow_up: 'Follow up after previous conversation',
      };

      const instructions = `
Channel: ${channel === 'whatsapp' ? 'WhatsApp (conversational, concise, no markdown)' : 'Email (can be slightly longer, professional)'}
Tone: ${tone}
Goal: ${goalMap[goal] || goal}
${customInstructions ? `Extra instructions: ${customInstructions}` : ''}
      `;

      const { data, error } = await supabase.functions.invoke('ai-agent-runner', {
        body: {
          goal: goalMap[goal] || goal,
          outcome_goal: goal,
          lead_context: selectedLead,
          channel_preference: channel,
          instructions,
          company_id: company?.id,
          available_tools: channel === 'whatsapp' ? ['send_whatsapp'] : ['send_email'],
        }
      });

      if (error) throw error;

      const decision = data?.decision;
      if (!decision) throw new Error('No decision returned');

      setGenerated({
        channel,
        subject: decision.params?.subject,
        body: decision.params?.message || decision.params?.body_html || '',
        personalization_notes: decision.personalization_notes || decision.reasoning || '',
      });
    } catch (e: any) {
      toast({ title: 'Generation Failed', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!generated) return;
    const text = generated.subject ? `Subject: ${generated.subject}\n\n${generated.body}` : generated.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendNow = async () => {
    if (!generated || !selectedLead) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('ai-workflow-executor', {
        body: {
          lead_id: selectedLead.id,
          company_id: company?.id,
          trigger_type: 'manual',
          manual_trigger: true,
          trigger_data: { source: 'personalization_engine', channel: generated.channel }
        }
      });
      if (error) throw error;
      toast({ title: 'Message Queued', description: `AI will send the ${generated.channel} to ${selectedLead.name} via AI Ops Center.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-amber-400" /> Personalization Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Hyper-personalized outreach at machine scale. Every message uniquely AI-crafted per lead.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config Panel */}
        <Card className="border-border">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Message Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Lead Selector */}
            <div>
              <Label className="mb-1.5 block">Select Lead</Label>
              <Select onValueChange={(id) => setSelectedLead(leads.find(l => l.id === id))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a lead to personalize for..." />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        <span>{lead.name}</span>
                        <span className="text-xs text-muted-foreground">({lead.status})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLead && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {selectedLead.name}</p>
                <p><span className="text-muted-foreground">Status:</span> {selectedLead.status}</p>
                {selectedLead.phone && <p><span className="text-muted-foreground">Phone:</span> {selectedLead.phone}</p>}
                {selectedLead.email && <p><span className="text-muted-foreground">Email:</span> {selectedLead.email}</p>}
              </div>
            )}

            {/* Channel */}
            <div>
              <Label className="mb-1.5 block">Channel</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setChannel('whatsapp')}
                  className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${channel === 'whatsapp' ? 'border-green-500/50 bg-green-500/10' : 'border-border hover:border-primary/30'}`}
                >
                  <MessageCircle className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium">WhatsApp</span>
                </button>
                <button
                  onClick={() => setChannel('email')}
                  className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${channel === 'email' ? 'border-blue-500/50 bg-blue-500/10' : 'border-border hover:border-primary/30'}`}
                >
                  <Mail className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium">Email</span>
                </button>
              </div>
            </div>

            {/* Goal */}
            <div>
              <Label className="mb-1.5 block">Outcome Goal</Label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="book_meeting">📅 Book Meeting</SelectItem>
                  <SelectItem value="demo_scheduled">🎯 Schedule Demo</SelectItem>
                  <SelectItem value="site_visit">🏠 Site Visit</SelectItem>
                  <SelectItem value="sale_closed">💰 Close Sale</SelectItem>
                  <SelectItem value="follow_up">💬 Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tone */}
            <div>
              <Label className="mb-1.5 block">Tone</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['professional', 'casual', 'urgent', 'warm'] as Tone[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`p-2 rounded-lg border text-sm capitalize transition-all ${tone === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra instructions */}
            <div>
              <Label className="mb-1.5 block">Extra Instructions (optional)</Label>
              <Textarea
                placeholder="e.g. mention our free trial, reference their industry..."
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>

            <Button onClick={generateMessage} disabled={generating || !selectedLead} className="gradient-primary w-full">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {generating ? 'Crafting Personalized Message...' : 'Generate Message'}
            </Button>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="border-border">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              {channel === 'whatsapp' ? <MessageCircle className="h-4 w-4 text-green-400" /> : <Mail className="h-4 w-4 text-blue-400" />}
              AI-Generated Message
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {!generated && !generating && (
              <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">Configure settings and click Generate</p>
                <p className="text-xs mt-1">AI will craft a unique, personalized message for the selected lead.</p>
              </div>
            )}

            {generating && (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-t-2 border-primary animate-spin" />
                  <Sparkles className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">Analyzing lead context and crafting message...</p>
              </div>
            )}

            {generated && !generating && (
              <div className="space-y-4 animate-in fade-in duration-500">
                {generated.subject && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Subject</p>
                    <p className="font-semibold text-sm">{generated.subject}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">Message</p>
                  <ScrollArea className="h-48">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{generated.body}</p>
                    </div>
                  </ScrollArea>
                </div>

                {generated.personalization_notes && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                      <Zap className="h-3 w-3" /> Personalization Notes
                    </p>
                    <p className="text-xs text-muted-foreground">{generated.personalization_notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={copyToClipboard}>
                    {copied ? <CheckCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button size="sm" className="flex-1 gradient-primary" onClick={sendNow} disabled={sending}>
                    {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                    Queue to Send
                  </Button>
                  <Button variant="ghost" size="sm" onClick={generateMessage} disabled={generating}>
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper icon import
function SlidersHorizontal({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/>
      <line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/>
      <line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/>
      <line x1="16" y1="18" x2="16" y2="22"/>
    </svg>
  );
}
