import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Zap, TrendingUp, Sparkles, ArrowRight, MousePointer2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useActionCenter, ActionItem } from '@/hooks/useActionCenter';
import { Lead } from '@/hooks/useLeads';

import { Skeleton } from '@/components/ui/skeleton';

interface ActionCenterProps {
    leads: Lead[];
    onOpenLead?: (lead: Lead) => void;
    isLoading?: boolean;
}

export function ActionCenter({ leads, onOpenLead, isLoading }: ActionCenterProps) {
    const actions = useActionCenter(leads);

    if (isLoading) {
        return (
            <Card className="glass h-full overflow-hidden border-none shadow-xl">
                <CardHeader className="pb-3 border-b border-border/50 bg-primary/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-start gap-3">
                            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (actions.length === 0) {
        return (
            <Card className="glass h-full border-dashed">
                <CardContent className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">No critical actions found. Your pipeline is healthy!</p>
                </CardContent>
            </Card>
        );
    }

    const getTypeStyles = (type: ActionItem['type']) => {
        switch (type) {
            case 'risk': return { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' };
            case 'momentum': return { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
            case 'opportunity': return { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        }
    };

    return (
        <Card className="glass h-full overflow-hidden border-none shadow-xl">
             <CardHeader className="pb-3 border-b border-border/50 bg-primary/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                            <Sparkles className="h-4 w-4" style={{ color: 'hsl(222 28% 5%)' }} />
                        </div>
                        <div>
                            <CardTitle className="text-base" style={{ fontFamily: "'Syne', sans-serif" }}>AI Sales Playbook</CardTitle>
                            <CardDescription className="text-xs">Your priority focus for today</CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-primary border-primary/20">
                        {actions.length} ACTIONS
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                    {actions.map((action, i) => {
                        const styles = getTypeStyles(action.type);
                        const Icon = styles.icon;

                        return (
                            <motion.div
                                key={action.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="group p-4 hover:bg-primary/5 transition-all duration-300 relative"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 p-2 rounded-lg ${styles.bg} ${styles.color} shrink-0`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-1 min-w-0 pr-10">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold tracking-tight">{action.title}</p>
                                            <span className={`text-[10px] font-bold uppercase ${styles.color} opacity-80`}>
                                                {action.type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                            {action.description}
                                        </p>
                                        <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-muted/40 border border-border/50">
                                            <MousePointer2 className="h-3 w-3 text-primary opacity-60" />
                                            <p className="text-[11px] font-medium text-primary italic">
                                                {action.suggestedAction}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground h-8 w-8 rounded-full"
                                    onClick={() => {
                                      const lead = leads.find(l => l.id === action.leadId);
                                      if (lead && onOpenLead) onOpenLead(lead);
                                    }}
                                >
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
