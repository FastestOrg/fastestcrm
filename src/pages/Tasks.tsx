import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, isToday, isPast, isFuture } from 'date-fns';
import {
    AlertTriangle,
    Calendar,
    ChevronRight,
    Clock,
    Phone,
    Mail,
    User,
    CheckSquare,
    Video,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaskLeads, TaskLead, TaskBucket } from '@/hooks/useTaskLeads';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { RealEstateEditLeadDialog } from '@/industries/real_estate/components/RealEstateEditLeadDialog';
import { useCompany } from '@/hooks/useCompany';
import { Tables } from '@/integrations/supabase/types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/* ─── Tab config ─────────────────────────────── */
type TabDef = {
    id: TaskBucket;
    label: string;
    icon: React.ElementType;
    emptyText: string;
    emptySubtext: string;
    colorClass: string;
    badgeBg: string;
};

const TABS: TabDef[] = [
    {
        id: 'urgent',
        label: 'Urgent',
        icon: AlertTriangle,
        emptyText: 'No overdue tasks',
        emptySubtext: "You're all caught up! No past-due scheduled leads.",
        colorClass: 'text-red-500',
        badgeBg: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    {
        id: 'today',
        label: 'Today',
        icon: Clock,
        emptyText: 'Nothing scheduled today',
        emptySubtext: 'No calls, meetings, or callbacks scheduled for today.',
        colorClass: 'text-amber-500',
        badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    {
        id: 'upcoming',
        label: 'Upcoming',
        icon: Calendar,
        emptyText: 'No upcoming tasks',
        emptySubtext: 'No future-dated follow-ups scheduled.',
        colorClass: 'text-blue-500',
        badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
];

/* ─── Lead card ─────────────────────────────── */
function formatReminderDate(iso: string): string {
    const d = new Date(iso);
    if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
    return format(d, 'dd MMM yyyy, h:mm a');
}

function LeadTaskCard({
    lead,
    bucket,
    owners = [],
    onView,
    onEdit,
}: {
    lead: TaskLead;
    bucket: TaskBucket;
    owners?: { label: string; value: string }[];
    onView: (lead: TaskLead) => void;
    onEdit: (lead: TaskLead) => void;
}) {
    const { getStatusColor, getStatusLabel } = useLeadStatuses();
    const isMeeting = lead.isMeeting;
    const color = isMeeting ? 'var(--primary)' : getStatusColor(lead.status);
    const label = isMeeting ? 'Meeting' : getStatusLabel(lead.status);

    const timeIndicatorClass =
        bucket === 'urgent'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : bucket === 'today'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-400';

    return (
        <Card
            className="group cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 bg-card border border-border"
            onClick={() => onView(lead)}
        >
            <CardContent className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {lead.name}
                        </h3>
                        {lead.college && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.college}</p>
                        )}
                    </div>
                    {/* Status badge */}
                    <Badge
                        variant="outline"
                        className="shrink-0 text-xs font-medium"
                        style={{ borderColor: color, color: color, backgroundColor: `${color}15` }}
                    >
                        {label}
                    </Badge>
                </div>

                {/* Contact row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                    {lead.phone && (
                        <a
                            href={`tel:${lead.phone}`}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                        </a>
                    )}
                    {lead.email && (
                        <a
                            href={`mailto:${lead.email}`}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[160px]">{lead.email}</span>
                        </a>
                    )}
                </div>

                {isMeeting && lead.location && lead.location.includes('google.com') && (
                    <div className="mt-1 mb-3" onClick={(e) => e.stopPropagation()}>
                        <a
                            href={lead.location}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow transition-all duration-200"
                        >
                            <Video className="h-3.5 w-3.5" />
                            Launch Selection Meet
                        </a>
                    </div>
                )}

                {/* Footer row: time + owner + arrow */}
                <div className="flex items-center justify-between gap-2">
                    <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border ${timeIndicatorClass}`}
                    >
                        <Clock className="h-3 w-3" />
                        {formatReminderDate(lead.reminder_at)}
                    </span>

                    <div className="flex items-center gap-2">
                        {(lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label) && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label}
                            </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Skeleton grid ─────────────────────────────── */
function LeadTaskSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-card border border-border">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-40" />
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-5 w-36 rounded" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

/* ─── Empty state ─────────────────────────────── */
function EmptyState({ tab }: { tab: TabDef }) {
    const Icon = tab.icon;
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
                className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${tab.id === 'urgent'
                    ? 'bg-red-500/10'
                    : tab.id === 'today'
                        ? 'bg-amber-500/10'
                        : 'bg-blue-500/10'
                    }`}
            >
                <Icon
                    className={`h-8 w-8 ${tab.id === 'urgent'
                        ? 'text-red-500'
                        : tab.id === 'today'
                            ? 'text-amber-500'
                            : 'text-blue-500'
                        }`}
                />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">{tab.emptyText}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{tab.emptySubtext}</p>
        </div>
    );
}

/* ─── Main page ─────────────────────────────── */
export default function Tasks() {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab') as TaskBucket | null;
    const activeTabId: TaskBucket = rawTab && ['urgent', 'today', 'upcoming'].includes(rawTab) ? rawTab : 'today';

    const [viewingLead, setViewingLead] = useState<TaskLead | null>(null);
    const [editingLead, setEditingLead] = useState<TaskLead | null>(null);
    const { company } = useCompany();

    const { data: owners } = useQuery({
        queryKey: ['profiles', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('company_id', company.id)
                .not('full_name', 'is', null);
            return (data || []).map((p) => ({ label: p.full_name || 'Unknown', value: p.id }));
        },
        enabled: !!company?.id,
        staleTime: 5 * 60 * 1000,
    });

    const { urgent, today, upcoming, isLoading, error, refetch } = useTaskLeads();

    const handleViewLead = async (lead: TaskLead) => {
        if (lead.isMeeting) {
            const leadId = lead.lead_id;
            if (leadId) {
                try {
                    const { data, error } = await supabase
                        .from('leads')
                        .select('*, sales_owner:profiles!leads_sales_owner_id_fkey(full_name)')
                        .eq('id', leadId)
                        .single();
                    if (error) throw error;
                    if (data) {
                        setViewingLead(data as unknown as TaskLead);
                    }
                } catch (err) {
                    console.error("Error fetching lead for meeting:", err);
                    toast.error("Could not load associated lead details");
                }
            } else {
                toast("Meeting not linked to a specific lead");
            }
        } else {
            setViewingLead(lead);
        }
    };

    const counts: Record<TaskBucket, number> = {
        urgent: urgent.length,
        today: today.length,
        upcoming: upcoming.length,
    };

    const activeBucketLeads: Record<TaskBucket, TaskLead[]> = { urgent, today, upcoming };
    const currentLeads = activeBucketLeads[activeTabId];
    const currentTab = TABS.find((t) => t.id === activeTabId)!;

    const setTab = (tab: TaskBucket) => {
        setSearchParams({ tab }, { replace: true });
    };

    return (
        <div className="space-y-5 pb-20 md:pb-0">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
                    <CheckSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Tasks</h1>
                    <p className="text-sm text-muted-foreground">
                        Leads with scheduled actions — callbacks, meetings & follow-ups
                    </p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-2 flex-wrap">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.id === activeTabId;
                    const count = counts[tab.id];
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${isActive
                                ? tab.id === 'urgent'
                                    ? 'bg-red-500/15 border-red-500/40 text-red-400'
                                    : tab.id === 'today'
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                                        : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                                : 'bg-card border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                            {!isLoading && count > 0 && (
                                <span
                                    className={`ml-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive
                                        ? tab.id === 'urgent'
                                            ? 'bg-red-500 text-white'
                                            : tab.id === 'today'
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-blue-500 text-white'
                                        : 'bg-muted text-muted-foreground'
                                        }`}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {isLoading ? (
                <LeadTaskSkeleton />
            ) : error ? (
                <div className="flex flex-col items-center py-16 text-center">
                    <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
                    <p className="text-sm text-destructive font-medium">Failed to load tasks</p>
                    <button
                        onClick={() => refetch()}
                        className="mt-2 text-xs text-primary underline"
                    >
                        Retry
                    </button>
                </div>
            ) : currentLeads.length === 0 ? (
                <EmptyState tab={currentTab} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentLeads.map((lead) => (
                        <LeadTaskCard
                            key={lead.id}
                            lead={lead}
                            bucket={activeTabId}
                            owners={owners || []}
                            onView={handleViewLead}
                            onEdit={setEditingLead}
                        />
                    ))}
                </div>
            )}

            {/* Dialogs */}
            {viewingLead && (
                <LeadDetailsDialog
                    open={!!viewingLead}
                    onOpenChange={(open) => !open && setViewingLead(null)}
                    lead={viewingLead as unknown as Tables<'leads'>}
                    owners={owners || []}
                    onEdit={(lead) => {
                        setViewingLead(null);
                        setEditingLead(lead);
                    }}
                    onUpdate={() => {
                        refetch();
                    }}
                />
            )}
            {editingLead && company?.industry === 'real_estate' && (
                <RealEstateEditLeadDialog
                    open={!!editingLead}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditingLead(null);
                        }
                    }}
                    lead={editingLead as any}
                    onSuccess={() => {
                        refetch();
                        setEditingLead(null);
                    }}
                />
            )}
            {editingLead && company?.industry !== 'real_estate' && (
                <EditLeadDialog
                    open={!!editingLead}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditingLead(null);
                            refetch();
                        }
                    }}
                    lead={editingLead as unknown as Tables<'leads'>}
                />
            )}
        </div>
    );
}
