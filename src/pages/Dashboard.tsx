import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import {
  Users, Brain, TrendingUp, DollarSign, Target, BarChart3, CreditCard,
  Phone, MessageSquare, ExternalLink, ArrowUpRight, Sparkles, Zap, RefreshCw,
  Building2, UserCheck, User
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Lead } from '@/hooks/useLeads';
import { format } from 'date-fns';
import { ActionCenter } from '@/components/dashboard/ActionCenter';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useHierarchy } from '@/hooks/useHierarchy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardAnalytics } from '@/hooks/useDashboardAnalytics';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};

interface TooltipItem {
  name: string;
  value: number | string;
  color?: string;
  fill?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl">
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        {payload.map((item: TooltipItem, index: number) => (
          <p key={index} className="text-xs font-semibold" style={{ color: item.color || item.fill }}>
            {item.name}: {typeof item.value === 'number' && item.name.toLowerCase().includes('revenue') ? `₹${item.value.toLocaleString()}` : item.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { company } = useCompany();
  const { accessibleUserIds, canViewAll, loading: hierarchyLoading } = useHierarchy();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Active team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['dashboard-team-members', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('company_id', company.id)
        .not('full_name', 'is', null);

      if (error) {
        console.error('[Dashboard] Error fetching team members:', error);
        return [];
      }

      const activeProfiles = profiles || [];
      if (activeProfiles.length > 0) {
        const ids = activeProfiles.map(p => p.id);
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('user_id', ids);
        const activeSet = new Set(rolesData?.map(r => r.user_id));
        return activeProfiles.filter(p => activeSet.has(p.id));
      }
      return activeProfiles;
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Filter allowed team members based on hierarchy scoping
  const visibleTeamMembers = useMemo(() => {
    if (canViewAll) return teamMembers;
    if (accessibleUserIds && accessibleUserIds.length > 0) {
      const allowedSet = new Set(accessibleUserIds);
      return teamMembers.filter(m => allowedSet.has(m.id));
    }
    return user?.id ? teamMembers.filter(m => m.id === user.id) : [];
  }, [canViewAll, accessibleUserIds, teamMembers, user?.id]);

  // Selected Scope:
  // Non-admins start on 'my_report' (individual report) and are restricted.
  // Admins start on 'company' and can switch between company & any rep.
  const [selectedScope, setSelectedScope] = useState<string>('my_report');

  // Sync initial scope once hierarchy resolves
  useEffect(() => {
    if (!hierarchyLoading) {
      if (canViewAll) {
        setSelectedScope('company');
      } else {
        setSelectedScope('my_report');
      }
    }
  }, [canViewAll, hierarchyLoading]);

  // Determine effective user ID for analytics scoping
  const effectiveUserId = useMemo(() => {
    if (!canViewAll) {
      // Non-admin can only inspect themselves or accessible subordinates
      if (selectedScope && selectedScope !== 'company' && selectedScope !== 'my_report') {
        if (accessibleUserIds.includes(selectedScope)) {
          return selectedScope;
        }
      }
      return user?.id || null;
    }
    // Admin
    if (selectedScope === 'company') return null;
    if (selectedScope === 'my_report') return user?.id || null;
    return selectedScope;
  }, [canViewAll, selectedScope, user?.id, accessibleUserIds]);

  const isIndividualMode = !canViewAll || selectedScope !== 'company';

  // High-performance pushdown PostgreSQL analytics hook (sub-25ms response, ~1.5KB payload)
  const { 
    kpis, 
    intakeTrend, 
    statusDistribution, 
    recentLeads, 
    actionLeads, 
    isLoading, 
    isFetching,
    refetch 
  } = useDashboardAnalytics({
    userId: effectiveUserId,
    enabled: !hierarchyLoading,
  });

  const selectedMember = useMemo(() => {
    if (!effectiveUserId) return null;
    if (effectiveUserId === user?.id) {
      return {
        id: user.id,
        full_name: profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You',
        isMe: true,
      };
    }
    const found = teamMembers.find(m => m.id === effectiveUserId);
    return found ? { ...found, isMe: false } : null;
  }, [effectiveUserId, user, profile, teamMembers]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const userName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Sales Champ';

  const stats = useMemo(() => [
    { 
      label: isIndividualMode ? 'My Closed Sales' : 'Daily Sales', 
      value: kpis.paid_today.toString(), 
      icon: Target, 
      trend: 'Today' 
    },
    { 
      label: isIndividualMode ? 'My Revenue Today' : 'Revenue Today', 
      value: `₹${kpis.revenue_today.toLocaleString()}`, 
      icon: DollarSign, 
      trend: 'Today' 
    },
    { 
      label: isIndividualMode ? 'My Projected Revenue' : 'Projected Revenue', 
      value: `₹${kpis.projected_revenue.toLocaleString()}`, 
      icon: TrendingUp, 
      trend: 'Total' 
    },
    { 
      label: isIndividualMode ? 'My Lifetime Payments' : 'Lifetime Payments', 
      value: `₹${kpis.total_revenue.toLocaleString()}`, 
      icon: CreditCard, 
      trend: 'Total' 
    },
    { 
      label: isIndividualMode ? 'My Total Revenue' : 'Total Revenue', 
      value: `₹${kpis.total_revenue.toLocaleString()}`, 
      icon: BarChart3, 
      trend: 'Total',
      subLabel: `₹${kpis.total_incentive.toLocaleString()}`,
      subLabelTitle: isIndividualMode ? 'My Incentive' : 'Incentive Share',
    },
    { 
      label: isIndividualMode ? 'My Pipeline Value' : 'Pipeline Value', 
      value: `₹${kpis.pipeline_value.toLocaleString()}`, 
      icon: Brain, 
      trend: 'Forecast' 
    },
  ], [kpis, isIndividualMode]);

  const chartData = intakeTrend;
  const statusChartData = statusDistribution;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-100px] left-[15%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[10%] left-[5%] w-[450px] h-[450px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <header className="sticky top-0 bg-background/60 backdrop-blur-xl border-b border-border/40 px-6 md:px-8 py-4 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>Dashboard</h1>
            <p className="text-muted-foreground text-xs md:text-sm">
              {isIndividualMode ? 'Individual revenue & sales intelligence.' : 'Real-time company pipeline metrics & revenue intelligence.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Selector for Admins and Managers */}
            {(canViewAll || visibleTeamMembers.length > 1) ? (
              <div className="min-w-[190px] sm:min-w-[230px]">
                <Select
                  value={selectedScope}
                  onValueChange={(val) => setSelectedScope(val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-card/60 backdrop-blur-md border-border/50 hover:bg-card/90">
                    <div className="flex items-center gap-1.5 truncate">
                      {selectedScope === 'company' ? (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate font-medium">🏢 Full Company</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate font-medium">
                            {selectedMember?.isMe ? '👤 My Individual Report' : `👤 ${selectedMember?.full_name || 'Individual'}`}
                          </span>
                        </>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent align="end" className="w-[240px]">
                    <SelectGroup>
                      {canViewAll && (
                        <>
                          <SelectItem value="company" className="text-xs font-medium cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>Full Company Report</span>
                            </div>
                          </SelectItem>
                          <SelectSeparator />
                        </>
                      )}
                      <SelectItem value="my_report" className="text-xs font-medium cursor-pointer">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                          <span>My Individual Report</span>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                    {visibleTeamMembers.filter(m => m.id !== user?.id).length > 0 && (
                      <SelectGroup>
                        <SelectSeparator />
                        <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {canViewAll ? 'All Sales Reps' : 'Team Members'}
                        </SelectLabel>
                        {visibleTeamMembers
                          .filter(m => m.id !== user?.id)
                          .map((member) => (
                            <SelectItem key={member.id} value={member.id} className="text-xs cursor-pointer">
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold shrink-0">
                                  {member.full_name ? member.full_name[0].toUpperCase() : 'U'}
                                </span>
                                <span className="truncate">{member.full_name}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserCheck className="w-3.5 h-3.5" />
                <span>My Individual Report</span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 gap-1.5 text-xs bg-card/60 backdrop-blur-md border-border/50 hover:bg-card/90 transition-all duration-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">{isFetching ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live DB
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-8 relative z-10">
        {/* Welcome Premium Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative overflow-hidden p-6 md:p-8 rounded-2xl border border-purple-500/10 bg-gradient-to-r from-purple-950/20 via-indigo-950/10 to-background shadow-lg shadow-purple-500/5"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-32 h-32 text-purple-400 animate-pulse" />
          </div>
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                <Zap className="w-3.5 h-3.5" /> FastestAI Connected
              </span>
              {isIndividualMode ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-3.5 h-3.5" />
                  {selectedMember?.isMe ? 'Personal Sales Report' : `${selectedMember?.full_name}'s Report`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <Building2 className="w-3.5 h-3.5" /> Company-Wide Overview
                </span>
              )}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight mt-2 text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
              {isIndividualMode && !selectedMember?.isMe ? `${selectedMember?.full_name}'s Sales Overview` : `${greeting}, ${userName}!`}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {isIndividualMode
                ? (selectedMember?.isMe
                    ? `Welcome to your personal command center. Here is your individual closed revenue, daily sales, active conversion funnel, and assigned lead pipeline.`
                    : `Showing individual sales and revenue report for ${selectedMember?.full_name}. Collections today stand at ₹${kpis.revenue_today.toLocaleString()}, with ₹${kpis.pipeline_value.toLocaleString()} in active pipeline.`)
                : `Welcome back to your company command center. FastestAI has completed auditing company pipelines. Today's collections stand at ₹${kpis.revenue_today.toLocaleString()}, with a total forecast value of ₹${kpis.pipeline_value.toLocaleString()} waiting in your conversion funnel.`
              }
            </p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {(isLoading ? Array(6).fill({}) : stats).map((stat, i) => {
            const accentColors = [
              'border-l-amber-400/80', 'border-l-emerald-400/80', 'border-l-primary/80', 'border-l-teal-400/80', 'border-l-pink-500/80', 'border-l-violet-400/80'
            ];
            const iconColors = [
              'text-amber-400', 'text-emerald-400', 'text-primary', 'text-teal-400', 'text-pink-400', 'text-violet-400'
            ];
            const bgColors = [
              'bg-amber-400/10', 'bg-emerald-400/10', 'bg-primary/10', 'bg-teal-400/10', 'bg-pink-400/10', 'bg-violet-400/10'
            ];
            const glowColors = [
              'group-hover:shadow-amber-500/5', 'group-hover:shadow-emerald-500/5', 'group-hover:shadow-primary/5', 'group-hover:shadow-teal-500/5', 'group-hover:shadow-pink-500/5', 'group-hover:shadow-violet-500/5'
            ];
            
            return (
              <motion.div key={stat.label || i} variants={itemVariants}>
                <Card className={`glass card-hover border-l-2 ${accentColors[i % accentColors.length]} relative overflow-hidden group transition-all duration-300 ${glowColors[i % glowColors.length]} hover:shadow-xl`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${bgColors[i % bgColors.length]} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        {isLoading ? (
                          <Skeleton className="h-5 w-5" />
                        ) : (
                          <stat.icon className={`h-5 w-5 ${iconColors[i % iconColors.length]}`} />
                        )}
                      </div>
                      {isLoading ? (
                        <Skeleton className="h-3 w-12" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider bg-secondary/50 px-2 py-0.5 rounded-full">{stat.trend}</span>
                      )}
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-8 w-24 mb-2" />
                    ) : (
                      <h3 className="text-2xl font-bold tracking-tight text-card-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>{stat.value}</h3>
                    )}
                    {isLoading ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      <div className="mt-1">
                        <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                        {'subLabel' in stat && stat.subLabel && (
                          <div className="mt-4 pt-3 border-t border-border/20 flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-medium flex items-center gap-1">
                              {'subLabelTitle' in stat && stat.subLabelTitle ? (stat.subLabelTitle as string) : 'Incentive Share'}
                            </span>
                            <span className="font-bold text-emerald-400">₹{stat.subLabel}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Analytics Charts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Lead Intake Trend Chart (2/3 width) */}
          <Card className="glass lg:col-span-2 relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" /> Weekly Intake Trend
                </CardTitle>
                <CardDescription className="text-xs">
                  {isIndividualMode ? 'Your lead intake and daily activity over the last 7 days' : 'Leads and revenue registered over the last 7 days'}
                </CardDescription>
              </div>
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full">
                Live Data
              </span>
            </CardHeader>
            <CardContent className="h-72 pl-0">
              {isLoading ? (
                <div className="w-full h-full flex flex-col justify-end gap-2 p-6 pt-0">
                  <div className="flex items-end gap-3 h-52 w-full justify-between pt-6">
                    {[35, 60, 45, 80, 50, 95, 70, 85].map((heightPct, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <Skeleton className="w-full rounded-t-md opacity-80" style={{ height: `${heightPct}%` }} />
                        <Skeleton className="h-2.5 w-6 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={30} />
                    <ChartTooltip content={<CustomTooltip />} />
                    <Area type="monotone" name="Leads Added" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status Distribution Chart (1/3 width) */}
          <Card className="glass relative overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-400" /> Lead Status Mix
              </CardTitle>
              <CardDescription className="text-xs">
                {isIndividualMode ? 'Status distribution of your assigned leads' : 'Current lead statuses breakdown'}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72 flex items-center justify-center">
              {isLoading ? (
                <div className="w-full h-full flex flex-col justify-center gap-4 p-6 pt-0">
                  {[85, 65, 45, 30, 20].map((widthPct, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-3 w-8 rounded" />
                      </div>
                      <Skeleton className="h-2.5 rounded-full" style={{ width: `${widthPct}%` }} />
                    </div>
                  ))}
                </div>
              ) : statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <XAxis type="number" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} hide />
                    <YAxis dataKey="name" type="category" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={75} />
                    <ChartTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-muted-foreground">No status data available</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Recent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass lg:col-span-2 relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-primary" /> Recent Lead Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  {isIndividualMode ? 'Manage and interact with your recently assigned leads' : 'Manage and interact with recently added leads'}
                </CardDescription>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                View Funnel <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
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
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div 
                      key={lead.id} 
                      className="group/item flex items-center justify-between p-3.5 rounded-xl bg-card/40 border border-border/40 hover:border-primary/20 hover:bg-primary/5 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-extrabold text-sm flex-shrink-0 relative" style={{ color: 'hsl(222 28% 5%)' }}>
                          {lead.name ? lead.name[0].toUpperCase() : 'L'}
                          {lead.status === 'paid' && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.email || lead.phone || 'No contact details'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Interactive contact action quick shortcuts on hover */}
                        <div className="opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 hidden sm:flex">
                          {lead.phone && (
                            <>
                              <a 
                                href={`tel:${lead.phone}`} 
                                className="w-8 h-8 rounded-full bg-background border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all duration-200"
                                title="Call Lead"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a 
                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-full bg-background border border-border/80 text-muted-foreground hover:text-emerald-400 hover:border-emerald-400/40 flex items-center justify-center transition-all duration-200"
                                title="Send WhatsApp Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsDetailsOpen(true);
                            }}
                            className="w-8 h-8 rounded-full bg-background border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all duration-200"
                            title="Inspect Lead"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${
                            lead.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            lead.status === 'interested' ? 'bg-primary/10 text-primary border border-primary/20' :
                            lead.status === 'follow_up' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            lead.status === 'dropped' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-muted/30 text-muted-foreground border border-muted/50'
                          }`}>
                            {lead.status.replace('_', ' ')}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(lead.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">No leads recorded. Add a lead manually or link a form!</p>
                </div>
              )}
            </CardContent>
          </Card>

          <ActionCenter 
            leads={actionLeads} 
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
          onUpdate={() => refetch()}
        />
      )}
    </div>
  );
}
