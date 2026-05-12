import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, ShieldAlert, Target, MessageSquareCode, Sparkles, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateBattleCard, BattleCard } from '@/services/competitorAIService';
import { useAuth } from '@/hooks/useAuth';

interface CompetitorBattleCardProps {
    leadId: string;
    initialCompetitor?: string;
}

export function CompetitorBattleCard({ leadId, initialCompetitor }: CompetitorBattleCardProps) {
    const [competitorName, setCompetitorName] = useState(initialCompetitor || '');
    const [loading, setLoading] = useState(false);
    const [card, setCard] = useState<BattleCard | null>(null);
    const { user } = useAuth();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleGenerate = async () => {
        if (!competitorName || !user?.company_id) return;
        setLoading(true);
        try {
            const data = await generateBattleCard({
                companyId: user.company_id,
                leadId,
                competitorName
            });
            setCard(data);
        } catch (error) {
            console.error('Failed to generate battle card', error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate if initialCompetitor is provided
    useEffect(() => {
        if (initialCompetitor && !card && !loading) {
            handleGenerate();
        }
    }, [initialCompetitor]);

    const containerStyle = {
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px'
    };

    return (
        <Card className="border-none shadow-xl overflow-hidden" style={containerStyle}>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Target className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-xl font-bold tracking-tight">Competitor Battle Card</CardTitle>
                    </div>
                    {card && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                            AI Generated
                        </Badge>
                    )}
                </div>
                <CardDescription>
                    Get instant strategic advantages and objection handling scripts against any competitor.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {!card && !loading && (
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Enter competitor name (e.g. Salesforce)" 
                            value={competitorName}
                            onChange={(e) => setCompetitorName(e.target.value)}
                            className="bg-muted/30 border-muted"
                        />
                        <Button onClick={handleGenerate} disabled={!competitorName}>
                            Generate
                        </Button>
                    </div>
                )}

                {loading && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                        <div className="relative">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-yellow-400 animate-pulse" />
                        </div>
                        <p className="text-sm text-muted-foreground animate-pulse">Analyzing competitor weaknesses and our edge...</p>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {card && !loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <Tabs defaultValue="overview" className="w-full">
                                <TabsList className="grid grid-cols-3 bg-muted/20 p-1 mb-6">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="objections">Kill Scripts</TabsTrigger>
                                    <TabsTrigger value="edge">Our Edge</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                                                <Zap className="h-4 w-4" /> Quick Pitch
                                            </h4>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 px-2 text-[10px] gap-1.5 opacity-60 hover:opacity-100"
                                                onClick={() => copyToClipboard(card.quick_pitch.join('\n'), 'pitch')}
                                            >
                                                {copiedId === 'pitch' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                {copiedId === 'pitch' ? 'Copied' : 'Copy All'}
                                            </Button>
                                        </div>
                                        <ul className="space-y-2">
                                            {card.quick_pitch.map((p, i) => (
                                                <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                                    <span className="text-primary mt-1">•</span> {p}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="p-4 bg-destructive/5 rounded-xl border border-destructive/10">
                                        <h4 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                                            <ShieldAlert className="h-4 w-4" /> Competitor Flaws
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {card.their_flaws.map((f, i) => (
                                                <Badge key={i} variant="secondary" className="bg-destructive/10 text-destructive border-none">
                                                    {f}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="objections" className="space-y-4">
                                    {card.objections.map((obj, i) => (
                                        <div key={i} className="group p-4 bg-muted/40 rounded-xl border border-muted-foreground/10 hover:border-primary/30 transition-all duration-300 relative">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                               <MessageSquareCode className="h-3 w-3" /> Objection
                                            </p>
                                            <p className="text-sm font-semibold mb-3">"{obj.trigger}"</p>
                                            <div className="p-3 bg-background/50 rounded-lg border border-primary/10 relative pr-10">
                                                <p className="text-sm text-primary/90 italic leading-relaxed">
                                                    {obj.response}
                                                </p>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => copyToClipboard(obj.response, `obj-${i}`)}
                                                >
                                                    {copiedId === `obj-${i}` ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </TabsContent>

                                <TabsContent value="edge" className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3">
                                        {card.our_edge.map((edge, i) => (
                                            <div key={i} className="flex items-center gap-4 p-4 bg-secondary/10 rounded-xl border border-secondary/20">
                                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <span className="font-medium text-sm">{edge}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => setCard(null)}>
                                        Analyze Different Competitor
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

function CheckCircle2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}
