import { useState } from 'react';
import { useAIAgentMemory } from '@/hooks/useAIAgentMemory';
import { Bot, Sparkles, Brain, Trash2, Calendar, Phone, MessageSquare, Mail, AlertCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface AIAgentHistoryTabProps {
  leadId: string;
}

export function AIAgentHistoryTab({ leadId }: AIAgentHistoryTabProps) {
  const { memories, actions, isLoading, clearMemory } = useAIAgentMemory(leadId);
  const [isClearing, setIsClearing] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Loading AI agent context and logs...</p>
      </div>
    );
  }

  const memory = memories?.[0]; // Get the first memory (usually one per lead)

  const handleClearMemory = async (employeeId: string) => {
    setIsClearing(employeeId);
    try {
      await clearMemory.mutateAsync(employeeId);
    } finally {
      setIsClearing(null);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'make_call':
        return <Phone className="h-4 w-4 text-blue-500" />;
      case 'send_whatsapp':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'send_email':
        return <Mail className="h-4 w-4 text-purple-500" />;
      case 'update_lead_status':
        return <Bot className="h-4 w-4 text-amber-500" />;
      case 'update_lead_fields':
        return <Sparkles className="h-4 w-4 text-cyan-500" />;
      case 'add_note':
        return <FileText className="h-4 w-4 text-gray-500" />;
      default:
        return <Brain className="h-4 w-4 text-primary" />;
    }
  };

  const getActionStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Failed
          </Badge>
        );
      case 'pending_approval':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 animate-pulse">
            <AlertCircle className="h-3 w-3" /> Awaiting Approval
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 max-h-[70vh] overflow-y-auto">
      {/* AI Memory / Summary Column */}
      <div className="md:col-span-1 space-y-4">
        <Card className="border-primary/10 bg-primary/5 dark:bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary animate-pulse" />
              <CardTitle className="text-md">AI Employee Memory</CardTitle>
            </div>
            <CardDescription>
              Current state representation and context tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {memory ? (
              <>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Employee</span>
                  <div className="text-sm font-bold text-foreground">
                    {memory.ai_employees?.name || 'AI Employee'}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversation Summary</span>
                  <p className="text-sm text-foreground bg-background/50 p-3 rounded-lg border border-primary/5 leading-relaxed">
                    {memory.summary || "No summary generated yet. The AI is learning from initial interactions."}
                  </p>
                </div>
                <Separator />
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Total Interactions</span>
                    <span className="font-bold">{memory.interaction_count}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="font-semibold text-muted-foreground">Last Action</span>
                    <span className="font-bold">
                      {format(new Date(memory.last_interaction_at), 'MMM d, p')}
                    </span>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 mt-4"
                  onClick={() => handleClearMemory(memory.employee_id)}
                  disabled={isClearing === memory.employee_id}
                >
                  <Trash2 className="h-4 w-4" />
                  {isClearing === memory.employee_id ? 'Clearing...' : 'Clear Agent Memory'}
                </Button>
              </>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                No active memory logs for this lead yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Actions Timeline Column */}
      <div className="md:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-md">AI Execution Log</CardTitle>
            </div>
            <CardDescription>
              Chronological log of autonomous actions and CRM mutations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px] pr-4">
              {actions && actions.length > 0 ? (
                <div className="relative pl-6 border-l border-muted space-y-6">
                  {actions.map((act) => {
                    let parsedContent = null;
                    try {
                      parsedContent = typeof act.content === 'string' ? JSON.parse(act.content) : act.content;
                    } catch (_) {}

                    return (
                      <div key={act.id} className="relative group">
                        {/* Timeline node icon */}
                        <div className="absolute -left-[35px] top-1 bg-background border rounded-full p-1.5 shadow-sm group-hover:scale-110 transition-transform">
                          {getActionIcon(act.action_type)}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-sm capitalize">
                              {act.action_type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(act.created_at), 'PPP p')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 my-1">
                            <span className="text-xs text-muted-foreground font-medium">
                              By {act.ai_employees?.name || 'AI Employee'}
                            </span>
                            <span>•</span>
                            {getActionStatusBadge(act.status)}
                          </div>

                          {/* Action content details */}
                          {parsedContent && (
                            <div className="text-xs bg-muted/65 p-2 rounded border border-muted mt-2 font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-[150px]">
                              {JSON.stringify(parsedContent, null, 2)}
                            </div>
                          )}

                          {act.error_message && (
                            <p className="text-xs text-red-500 mt-1 font-medium">
                              Error: {act.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground/60" />
                  No actions have been executed by AI agents for this lead yet.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
