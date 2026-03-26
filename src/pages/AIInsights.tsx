import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Brain, 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle2, 
    Lightbulb, 
    User, 
    Zap, 
    ShieldCheck, 
    BarChart3, 
    ArrowRight,
    Loader2,
    RefreshCw,
    Frown,
    Smile
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface AIInsightsData {
    data_strength: {
        percentage: number;
        explanation: string;
    };
    next_actionable_steps: string[];
    bottleneck: string;
    employee_insights: {
        inefficient_employee: string;
        urgent_leads_not_catering: string;
        improvement_advice: string;
        motivation: string;
    };
}

export default function AIInsights() {
    const { company } = useCompany();
    const { toast } = useToast();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { data: insights, isLoading, refetch, isRefetching } = useQuery<AIInsightsData>({
        queryKey: ['ai-insights', company?.id],
        queryFn: async () => {
            if (!company?.id) return null as any;
            
            const { data, error } = await supabase.functions.invoke('generate-ai-insights', {
                body: { company_id: company.id }
            });

            if (error) throw error;
            return data as AIInsightsData;
        },
        enabled: !!company?.id,
        staleTime: 1000 * 60 * 30, // 30 minutes
    });

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refetch();
            toast({
                title: "Insights Updated",
                description: "Gemini has analyzed your latest CRM data.",
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Failed to refresh",
                description: error.message || "An unexpected error occurred.",
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading && !isRefreshing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-t-2 border-primary animate-spin" />
                    <Brain className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Gemini is Thinking...</h2>
                    <p className="text-muted-foreground animate-pulse">Analyzing all leads and task performance data</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <Brain className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight">AI Insights</h1>
                    </div>
                    <p className="text-muted-foreground ml-11">
                        Advanced lead analysis powered by <span className="text-primary font-semibold">Gemini 2.0 Flash Lite</span>
                    </p>
                </div>
                <Button 
                    onClick={handleRefresh} 
                    disabled={isRefreshing || isRefetching}
                    className="gap-2 gradient-primary shadow-lg shadow-primary/20 transition-all hover:scale-105"
                >
                    {isRefreshing || isRefetching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh Insights
                </Button>
            </div>

            {insights ? (
                <>
                    {/* Top Stats Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Data Strength Gauge */}
                        <Card className="glass relative overflow-hidden group border-primary/20">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ShieldCheck className="h-16 w-16" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Data Strength</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end gap-4">
                                    <div className="relative h-20 w-20">
                                        <svg className="h-20 w-20 -rotate-90">
                                            <circle
                                                cx="40"
                                                cy="40"
                                                r="36"
                                                fill="transparent"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                className="text-secondary"
                                            />
                                            <circle
                                                cx="40"
                                                cy="40"
                                                r="36"
                                                fill="transparent"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                strokeDasharray={226}
                                                strokeDashoffset={226 - (226 * insights.data_strength.percentage) / 100}
                                                className="text-primary transition-all duration-1000 ease-out"
                                            />
                                        </svg>
                                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold">
                                            {insights.data_strength.percentage}%
                                        </span>
                                    </div>
                                    <p className="text-sm leading-tight pb-2">{insights.data_strength.explanation}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Next Actionable Steps */}
                        <Card className="glass lg:col-span-2 border-primary/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-yellow-500" />
                                    Next Actionable Steps
                                </CardTitle>
                                <CardDescription>Recommended high-impact actions for your sales team</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {insights.next_actionable_steps.map((step, idx) => (
                                        <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10 hover:border-primary/30 transition-colors">
                                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                            <span className="text-sm font-medium">{step}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Secondary Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bottleneck Analysis */}
                        <Card className="glass border-orange-500/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-orange-500">
                                    <AlertTriangle className="h-5 w-5" />
                                    Bottleneck Identified
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                    <p className="text-foreground font-medium leading-relaxed italic">
                                        "{insights.bottleneck}"
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                    Solving this could increase conversion by up to 15%
                                </div>
                            </CardContent>
                        </Card>

                        {/* Employee Insights */}
                        <Card className="glass border-primary/20 overflow-hidden">
                            <CardHeader className="bg-primary/5">
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    Team Performance Insights
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 rounded-full bg-red-500/10">
                                            <Frown className="h-5 w-5 text-red-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-red-500 uppercase">Non-Efficient Employee</h4>
                                            <p className="text-sm font-medium">{insights.employee_insights.inefficient_employee}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 rounded-full bg-amber-500/10">
                                            <Clock className="h-5 w-5 text-amber-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-500 uppercase">Urgent Task Gap</h4>
                                            <p className="text-sm font-medium">{insights.employee_insights.urgent_leads_not_catering}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-blue-500 mb-2">
                                        <Lightbulb className="h-4 w-4" />
                                        IMPROVEMENT PLAN
                                    </h4>
                                    <p className="text-sm mb-3">{insights.employee_insights.improvement_advice}</p>
                                    <div className="flex items-center gap-3 pt-3 border-t border-blue-500/10">
                                        <Smile className="h-5 w-5 text-blue-500 shrink-0" />
                                        <p className="text-xs italic text-muted-foreground">"{insights.employee_insights.motivation}"</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center glass rounded-2xl border-dashed border-2">
                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                        <BarChart3 className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Ready for Insights?</h3>
                    <p className="text-muted-foreground max-w-sm mb-6">
                        Click the button below to have Gemini analyze your entire CRM database and provide strategic recommendations.
                    </p>
                    <Button onClick={handleRefresh} className="gap-2 gradient-primary">
                        <Zap className="h-4 w-4 fill-current" />
                        Generate First Insight
                    </Button>
                </div>
            )}
        </div>
    );
}
