import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PhoneCall, Loader2, PhoneOff, Bot, ChevronDown } from 'lucide-react';
import { useAICallerAgents } from '@/hooks/useAICallerAgents';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AICallerCallButtonProps {
    leadId: string;
    leadPhone?: string;
    leadName?: string;
    companyId: string;
    size?: 'sm' | 'default' | 'lg' | 'icon';
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    className?: string;
    onCallInitiated?: (queueItemId: string) => void;
}

type CallState = 'idle' | 'loading' | 'queued' | 'calling' | 'error';

export function AICallerCallButton({
    leadId,
    leadPhone,
    leadName,
    companyId,
    size = 'sm',
    variant = 'outline',
    className,
    onCallInitiated,
}: AICallerCallButtonProps) {
    const { agents } = useAICallerAgents();
    const { toast } = useToast();
    const [callState, setCallState] = useState<CallState>('idle');
    const [lastQueueId, setLastQueueId] = useState<string | null>(null);

    const activeAgents = agents.filter(a => a.is_active);

    const handleCall = async (agentId: string) => {
        if (!leadPhone) {
            toast({
                title: 'No phone number',
                description: 'This lead does not have a phone number.',
                variant: 'destructive',
            });
            return;
        }

        setCallState('loading');

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

            const res = await fetch(`${supabaseUrl}/functions/v1/trigger-ai-call`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lead_id: leadId,
                    lead_phone: leadPhone,
                    lead_name: leadName,
                    agent_id: agentId,
                    company_id: companyId,
                }),
            });

            const result = await res.json();

            if (!res.ok) throw new Error(result?.error || 'Failed to initiate call');

            setLastQueueId(result.queue_item_id);
            onCallInitiated?.(result.queue_item_id);

            if (result.queued) {
                setCallState('queued');
                toast({
                    title: '📞 Call Queued',
                    description: `Position ${result.position} in queue. Will dial ${leadName || leadPhone} soon.`,
                });
            } else {
                setCallState('calling');
                toast({
                    title: '📞 Calling Now',
                    description: `AI agent is dialing ${leadName || leadPhone}...`,
                });
            }

            // Reset after 10 seconds
            setTimeout(() => setCallState('idle'), 10_000);

        } catch (err: any) {
            setCallState('error');
            toast({
                title: 'Call Failed',
                description: err.message,
                variant: 'destructive',
            });
            setTimeout(() => setCallState('idle'), 4_000);
        }
    };

    // No phone — show disabled
    if (!leadPhone) {
        return (
            <Button size={size} variant={variant} className={cn("opacity-50 cursor-not-allowed", className)} disabled>
                <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
                No Phone
            </Button>
        );
    }

    // No agents configured
    if (activeAgents.length === 0) {
        return (
            <Button
                size={size}
                variant={variant}
                className={cn("text-muted-foreground", className)}
                asChild
            >
                <a href="/dashboard/ai-caller" title="Set up AI Caller first">
                    <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                    Set up AI Caller
                </a>
            </Button>
        );
    }

    // Loading / calling state
    if (callState === 'loading') {
        return (
            <Button size={size} variant={variant} className={className} disabled>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Initiating...
            </Button>
        );
    }

    if (callState === 'calling') {
        return (
            <Button size={size} variant="default" className={cn("bg-green-600 hover:bg-green-700", className)} disabled>
                <PhoneCall className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                Calling...
            </Button>
        );
    }

    if (callState === 'queued') {
        return (
            <Button size={size} variant="secondary" className={className} disabled>
                <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                In Queue
            </Button>
        );
    }

    // Single agent — direct call
    if (activeAgents.length === 1) {
        return (
            <Button
                size={size}
                variant={variant}
                className={cn("text-primary border-primary/30 hover:bg-primary/10", className)}
                onClick={() => handleCall(activeAgents[0].id)}
            >
                <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                Initiate AI call
            </Button>
        );
    }

    // Multiple agents — dropdown
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size={size}
                    variant={variant}
                    className={cn("text-primary border-primary/30 hover:bg-primary/10", className)}
                >
                    <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                    Initiate AI call
                    <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Choose AI Agent</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activeAgents.map(agent => (
                    <DropdownMenuItem
                        key={agent.id}
                        onClick={() => handleCall(agent.id)}
                        className="flex items-center gap-2 cursor-pointer"
                    >
                        <Bot className="h-3.5 w-3.5 text-primary" />
                        <div>
                            <div className="font-medium text-sm">{agent.name}</div>
                            <div className="text-xs text-muted-foreground">{agent.voice} · {agent.language}</div>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
