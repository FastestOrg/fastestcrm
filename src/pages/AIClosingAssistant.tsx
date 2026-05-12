import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Sparkles, Zap, MessageSquare, Target, Quote, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';

interface Battlecard {
    objections: { point: string; rebuttal: string; confidence: string }[];
    tactical_tips: string[];
    closing_strategy: string;
    summary_battlecard: string;
}

export default function AIClosingAssistant() {
    const [transcript, setTranscript] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [battlecard, setBattlecard] = useState<Battlecard | null>(null);
    const { company } = useCompany();
    const { toast } = useToast();

    const handleAnalyze = async () => {
        if (!transcript.trim()) {
            toast({
                title: "Incomplete Data",
                description: "Please enter some meeting notes or a transcript snippet.",
                variant: "destructive"
            });
            return;
        }

        setIsAnalyzing(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-closing-orchestrator', {
                body: { 
                    transcript, 
                    companyId: company?.id 
                }
            });

            if (error) throw error;
            setBattlecard(data.battlecard);
            toast({
                title: "Battlecard Generated",
                description: "AI has analyzed the context and prepared your strategy.",
            });
        } catch (err: any) {
            console.error('Analysis Error:', err);
            toast({
                title: "Analysis Failed",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="p-8 h-[calc(100vh-100px)] flex flex-col gap-6 overflow-hidden">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                        <Sparkles className="text-primary h-6 w-6" />
                        AI Closing Assistant
                    </h1>
                    <p className="text-muted-foreground">Real-time meeting intelligence and battlecard generation.</p>
                </div>
                <div className="flex gap-2">
                   <Button variant="outline" size="sm" onClick={() => { setTranscript(''); setBattlecard(null); }} className="gap-2">
                       <RotateCcw className="h-4 w-4" /> Reset
                   </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
                {/* Note Taking Area */}
                <Card className="glass flex flex-col overflow-hidden border-primary/20">
                    <CardHeader className="shrink-0">
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            Meeting Notes / Transcript
                        </CardTitle>
                        <CardDescription>Paste live conversation snippets or manual notes here.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <Textarea 
                            placeholder="Enter the customer's comments, objections, or the whole meeting transcript..."
                            className="flex-1 resize-none bg-background/50 border-primary/10 focus-visible:ring-primary/30"
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                        />
                        <Button 
                            className="gradient-primary w-full h-12 text-lg font-bold"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                        >
                            {isAnalyzing ? (
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            ) : (
                                <Zap className="h-5 w-5 mr-2" />
                            )}
                            {isAnalyzing ? "Analyzing Intent..." : "Generate Live Battlecard"}
                        </Button>
                    </CardContent>
                </Card>

                {/* AI Battlecard Output Area */}
                <Card className="glass overflow-hidden flex flex-col relative border-amber-500/20 shadow-xl shadow-amber-500/5">
                    {!battlecard && !isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-20">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <Target className="h-8 w-8 text-primary opacity-50" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Ready to Win?</h3>
                            <p className="text-muted-foreground max-w-sm">
                                Enter meeting notes on the left to see dynamic AI insights, objection handling, and closing strategies.
                            </p>
                        </div>
                    )}

                    <CardHeader className="shrink-0 bg-amber-500/5 border-b border-amber-500/10">
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-amber-500" />
                            Sales Strategy Battlecard
                        </CardTitle>
                        <CardDescription>AI-generated tactical advice based on current meeting context.</CardDescription>
                    </CardHeader>
                    
                    <ScrollArea className="flex-1 p-6">
                        {battlecard && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500">
                                {/* Summary Section */}
                                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 shadow-inner">
                                    <h4 className="text-xs uppercase font-bold tracking-widest text-primary mb-2 flex items-center gap-2">
                                        <Sparkles className="h-3 w-3" /> Execute Strategy
                                    </h4>
                                    <p className="text-foreground leading-relaxed italic">
                                        "{battlecard.summary_battlecard}"
                                    </p>
                                </div>

                                {/* Objections Section */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-500" /> Objection Handling
                                    </h4>
                                    {battlecard.objections.map((obj, i) => (
                                        <div key={i} className="p-4 rounded-lg bg-background/50 border border-white/5 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <span className="font-semibold text-sm">Target: {obj.point}</span>
                                                <Badge variant="outline" className="text-[10px] uppercase border-amber-500/50 text-amber-500">
                                                    {obj.confidence} Confidence
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                <span className="text-primary font-bold mr-1">REBUTTAL:</span> {obj.rebuttal}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Closing Strategy Section */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold flex items-center gap-2">
                                        <Quote className="h-4 w-4 text-primary" /> Closing Logic
                                    </h4>
                                    <div className="p-5 rounded-xl gradient-primary text-primary-foreground shadow-lg">
                                        <p className="text-sm font-medium leading-relaxed">
                                            {battlecard.closing_strategy}
                                        </p>
                                    </div>
                                </div>

                                {/* Tactical Tips */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold">Tactical Moves</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {battlecard.tactical_tips.map((tip, i) => (
                                            <div key={i} className="flex gap-3 items-start text-xs text-muted-foreground p-2 rounded bg-white/5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                {tip}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
}
