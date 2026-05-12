import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  Users, Brain, TrendingUp, DollarSign, Target, BarChart3, CreditCard, Loader2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
// DashboardLayout removed
import { useLeads, Lead } from '@/hooks/useLeads';
import { format } from 'date-fns';
import { ActionCenter } from '@/components/dashboard/ActionCenter';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';

export default function Dashboard() {
  const [reportLimit, setReportLimit] = useState<number>(1000);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  // Fetch leads based on limit for accurate revenue calculations
  // Aggregation logic for analytics. Backend optimization planned for v1.1.
  const { data: leadsData, isLoading } = useLeads({ fetchAll: true, limit: reportLimit });
  const leads = leadsData?.leads || [];

  const { leadsToday, revenueToday, totalRevenue, projectedRevenue, pipelineValue, stats } = React.useMemo(() => {
    const today = new Date();
    const isTodayStr = (dateString: string) => {
      const date = new Date(dateString);
      return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
    };

    const leadsToday = leads.filter(lead => isTodayStr(lead.updated_at));
    const paidLeadsTodayCount = leadsToday.filter(lead => lead.status === 'paid').length;

    const revenueToday = leadsToday.reduce((sum, lead) => sum + (Number(lead.revenue_received) || 0), 0);
    const totalRevenue = leads.reduce((sum, lead) => sum + (Number(lead.revenue_received) || 0), 0);
    const projectedRevenue = leads
      .filter(lead => lead.status === 'paid')
      .reduce((sum, lead) => sum + (Number(lead.revenue_projected) || 0), 0);
    const pipelineValue = leads
      .filter(lead => ['interested', 'follow_up'].includes(lead.status))
      .reduce((sum, lead) => sum + (Number(lead.revenue_projected) || 0), 0);

    const stats = [
      { label: 'Daily Sales', value: paidLeadsTodayCount.toString(), icon: Target, trend: 'Today' },
      { label: 'Revenue Today', value: `₹${revenueToday.toLocaleString()}`, icon: DollarSign, trend: 'Today' },
      { label: 'Projected Revenue', value: `₹${projectedRevenue.toLocaleString()}`, icon: TrendingUp, trend: 'Total' },
      { label: 'Lifetime Payments', value: `₹${totalRevenue.toLocaleString()}`, icon: CreditCard, trend: 'Total' },
      { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: BarChart3, trend: 'Total' },
      { label: 'Pipeline Value', value: `₹${pipelineValue.toLocaleString()}`, icon: Brain, trend: 'Forecast' },
    ];

    return { leadsToday, revenueToday, totalRevenue, projectedRevenue, pipelineValue, stats };
  }, [leads]);

  const recentLeads = leads.slice(0, 5);

  return (
    <>
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border px-6 md:px-8 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>Dashboard</h1>
            <p className="text-muted-foreground text-sm">Welcome back! Here's your sales overview.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:inline">Report Range:</span>
            <Select
              value={reportLimit.toString()}
              onValueChange={(value) => setReportLimit(Number(value))}
            >
              <SelectTrigger className="w-[180px] bg-card/50 backdrop-blur-sm border-border/50">
                <SelectValue placeholder="Select limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">Recent 1,000</SelectItem>
                <SelectItem value="10000">Recent 10,000</SelectItem>
                <SelectItem value="50000">Recent 50,000</SelectItem>
                <SelectItem value="1000000">All Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {(isLoading ? Array(6).fill({}) : stats).map((stat, i) => {
            const accentColors = [
              'border-l-amber-400', 'border-l-emerald-400', 'border-l-primary', 'border-l-teal-400', 'border-l-blue-400', 'border-l-violet-400'
            ];
            const iconColors = [
              'text-amber-400', 'text-emerald-400', 'text-primary', 'text-teal-400', 'text-blue-400', 'text-violet-400'
            ];
            const bgColors = [
              'bg-amber-400/10', 'bg-emerald-400/10', 'bg-primary/10', 'bg-teal-400/10', 'bg-blue-400/10', 'bg-violet-400/10'
            ];
            return (
              <Card key={stat.label || i} className={`glass card-hover border-l-2 ${accentColors[i % accentColors.length]}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg ${bgColors[i % bgColors.length]} flex items-center justify-center`}>
                      {isLoading ? (
                        <Skeleton className="h-5 w-5" />
                      ) : (
                        <stat.icon className={`h-5 w-5 ${iconColors[i % iconColors.length]}`} />
                      )}
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-3 w-12" />
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.trend}</span>
                    )}
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 mb-2" />
                  ) : (
                    <p className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{stat.value}</p>
                  )}
                  {isLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Leads</CardTitle>
              <CardDescription>Your latest lead activity</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                        <Skeleton className="h-3 w-24 ml-auto" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentLeads.length > 0 ? (
                <div className="space-y-4">
                  {recentLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-primary/4 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ color: 'hsl(222 28% 5%)' }}>
                          {lead.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.email || lead.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-1 ${lead.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' :
                          lead.status === 'interested' ? 'bg-primary/15 text-primary' :
                            lead.status === 'follow_up' ? 'bg-amber-500/15 text-amber-400' :
                              lead.status === 'dropped' ? 'bg-red-500/15 text-red-400' :
                                'bg-muted text-muted-foreground'
                          }`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(lead.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No leads yet. Add your first lead to get started!</p>
                </div>
              )}
            </CardContent>
          </Card>

          <ActionCenter 
            leads={leads} 
            isLoading={isLoading}
            onOpenLead={(lead) => {
              setSelectedLead(lead);
              setIsDetailsOpen(true);
            }} 
          />
        </div>
      </div>

      {selectedLead && (
        <LeadDetailsDialog
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          lead={selectedLead}
          onUpdate={() => {}} // Placeholder or refresh leads if needed
        />
      )}
    </>
  );
}
