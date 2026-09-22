import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, isToday, isPast, isFuture } from 'date-fns';
import {
    AlertTriangle,
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Phone,
    Mail,
    User,
    UserPlus,
    CheckSquare,
    Video,
    Search,
    X,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaskLeads, TaskLead, TaskBucket } from '@/hooks/useTaskLeads';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';

const LeadDetailsDialog = lazy(() => import('@/components/leads/LeadDetailsDialog').then(m => ({ default: m.LeadDetailsDialog })));
const EditLeadDialog = lazy(() => import('@/components/leads/EditLeadDialog').then(m => ({ default: m.EditLeadDialog })));
const RealEstateEditLeadDialog = lazy(() => import('@/industries/real_estate/components/RealEstateEditLeadDialog').then(m => ({ default: m.RealEstateEditLeadDialog })));
const AssignLeadsDialog = lazy(() => import('@/components/leads/AssignLeadsDialog').then(m => ({ default: m.AssignLeadsDialog })));
const RealEstateAssignLeadsDialog = lazy(() => import('@/industries/real_estate/components/RealEstateAssignLeadsDialog').then(m => ({ default: m.RealEstateAssignLeadsDialog })));
const SaaSAssignLeadsDialog = lazy(() => import('@/industries/saas/components/SaaSAssignLeadsDialog').then(m => ({ default: m.SaaSAssignLeadsDialog })));
const HealthcareAssignLeadsDialog = lazy(() => import('@/industries/healthcare/components/HealthcareAssignLeadsDialog').then(m => ({ default: m.HealthcareAssignLeadsDialog })));
const InsuranceAssignLeadsDialog = lazy(() => import('@/industries/insurance/components/InsuranceAssignLeadsDialog').then(m => ({ default: m.InsuranceAssignLeadsDialog })));
const TravelAssignLeadsDialog = lazy(() => import('@/industries/travel/components/TravelAssignLeadsDialog').then(m => ({ default: m.TravelAssignLeadsDialog })));
const RescheduleTaskDialog = lazy(() => import('@/components/leads/RescheduleTaskDialog').then(m => ({ default: m.RescheduleTaskDialog })));
import { useCompany } from '@/hooks/useCompany';
import { useLeadsTable } from '@/hooks/useLeadsTable';
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
    isSelected = false,
    selectable = false,
    onToggleSelect,
    onView,
    onEdit,
    onAssign,
    onReschedule,
}: {
    lead: TaskLead;
    bucket: TaskBucket;
    owners?: { label: string; value: string }[];
    isSelected?: boolean;
    selectable?: boolean;
    onToggleSelect?: (lead: TaskLead) => void;
    onView: (lead: TaskLead) => void;
    onEdit: (lead: TaskLead) => void;
    onAssign: (lead: TaskLead) => void;
    onReschedule: (lead: TaskLead) => void;
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

    const showAssign = !lead.isMeeting || !!lead.lead_id;

    return (
        <Card
            className={cn(
                "group cursor-pointer hover:shadow-lg transition-all duration-200 bg-card border",
                isSelected
                    ? "border-primary ring-1 ring-primary/40 bg-primary/[0.04]"
                    : "border-border hover:border-primary/50"
            )}
            onClick={() => onView(lead)}
        >
            <CardContent className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {selectable && showAssign && (
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={isSelected}
                                aria-label={`Select ${lead.name}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect?.(lead);
                                }}
                                className="pt-0.5 shrink-0 p-1 -m-1 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group/select"
                            >
                                <div
                                    className={cn(
                                        "h-4 w-4 rounded-full border transition-all flex items-center justify-center",
                                        isSelected
                                            ? "bg-primary border-primary text-primary-foreground shadow-xs"
                                            : "border-muted-foreground/40 group-hover/select:border-primary group-hover/select:bg-muted/40"
                                    )}
                                >
                                    {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </div>
                            </button>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {lead.name}
                            </h3>
                            {lead.college && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.college}</p>
                            )}
                        </div>
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
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onReschedule(lead);
                        }}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border cursor-pointer hover:bg-muted/30 transition-all ${timeIndicatorClass}`}
                        title="Reschedule Task"
                    >
                        <Clock className="h-3 w-3" />
                        {formatReminderDate(lead.reminder_at)}
                    </button>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {showAssign ? (
                            (lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label) ? (
                                <button
                                    onClick={() => onAssign(lead)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                    title="Assign Lead"
                                >
                                    <User className="h-3 w-3" />
                                    {lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label}
                                </button>
                            ) : (
                                <button
                                    onClick={() => onAssign(lead)}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    title="Assign Lead"
                                >
                                    <UserPlus className="h-3 w-3" />
                                    Assign
                                </button>
                            )
                        ) : (
                            (lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label) && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    {lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label}
                                </span>
                            )
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
    const [assigningLead, setAssigningLead] = useState<TaskLead | null>(null);
    const [reschedulingLead, setReschedulingLead] = useState<TaskLead | null>(null);
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

    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number | 'all'>(48);
    const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);

    const setTab = (tab: TaskBucket) => {
        setSearchParams({ tab }, { replace: true });
        setPage(1);
        setSelectedLeadIds(new Set());
    };

    const getLeadTargetId = (lead: TaskLead) => {
        return lead.isMeeting ? (lead.lead_id || null) : lead.id;
    };

    const handleToggleSelect = (lead: TaskLead) => {
        const targetId = getLeadTargetId(lead);
        if (!targetId) {
            toast.info("Meeting not linked to a lead cannot be assigned");
            return;
        }
        setSelectedLeadIds((prev) => {
            const next = new Set(prev);
            if (next.has(targetId)) {
                next.delete(targetId);
            } else {
                next.add(targetId);
            }
            return next;
        });
    };

    const handleSelectAllFiltered = () => {
        const next = new Set<string>();
        filteredLeads.forEach((l) => {
            const targetId = getLeadTargetId(l);
            if (targetId) next.add(targetId);
        });
        setSelectedLeadIds(next);
    };

    const handleClearSelection = () => {
        setSelectedLeadIds(new Set());
    };

    const handleSingleAssign = (lead: TaskLead) => {
        const targetId = getLeadTargetId(lead);
        if (targetId) {
            setSelectedLeadIds(new Set([targetId]));
            setAssignDialogOpen(true);
        } else {
            toast.error("Meeting not linked to a lead cannot be assigned");
        }
    };

    const handleBulkAssign = () => {
        if (selectedLeadIds.size === 0) {
            toast.error("Please select at least one lead to assign");
            return;
        }
        setAssignDialogOpen(true);
    };

    const activeSelectedIds = useMemo(() => Array.from(selectedLeadIds), [selectedLeadIds]);

    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) return currentLeads;
        const q = searchQuery.toLowerCase().trim();
        return currentLeads.filter((lead) => {
            return (
                (lead.name && lead.name.toLowerCase().includes(q)) ||
                (lead.phone && lead.phone.includes(q)) ||
                (lead.email && lead.email.toLowerCase().includes(q)) ||
                (lead.college && lead.college.toLowerCase().includes(q))
            );
        });
    }, [currentLeads, searchQuery]);

    const totalFiltered = filteredLeads.length;
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(page, totalPages);

    const displayedLeads = useMemo(() => {
        if (pageSize === 'all') return filteredLeads;
        const start = (safePage - 1) * pageSize;
        return filteredLeads.slice(start, start + pageSize);
    }, [filteredLeads, safePage, pageSize]);

    const selectableDisplayedLeads = useMemo(() => {
        return displayedLeads.filter((l) => !l.isMeeting || !!l.lead_id);
    }, [displayedLeads]);

    const isAllPageSelected =
        selectableDisplayedLeads.length > 0 &&
        selectableDisplayedLeads.every((l) => {
            const tid = getLeadTargetId(l);
            return tid ? selectedLeadIds.has(tid) : false;
        });

    const isSomePageSelected =
        !isAllPageSelected &&
        selectableDisplayedLeads.some((l) => {
            const tid = getLeadTargetId(l);
            return tid ? selectedLeadIds.has(tid) : false;
        });

    const handleToggleSelectAllPage = () => {
        setSelectedLeadIds((prev) => {
            const next = new Set(prev);
            const allSelected =
                selectableDisplayedLeads.length > 0 &&
                selectableDisplayedLeads.every((l) => {
                    const tid = getLeadTargetId(l);
                    return tid ? next.has(tid) : false;
                });

            if (allSelected) {
                selectableDisplayedLeads.forEach((l) => {
                    const tid = getLeadTargetId(l);
                    if (tid) next.delete(tid);
                });
            } else {
                selectableDisplayedLeads.forEach((l) => {
                    const tid = getLeadTargetId(l);
                    if (tid) next.add(tid);
                });
            }
            return next;
        });
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

            {/* Controls row: Tab bar + Search input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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

                {/* Search input */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="pl-9 pr-8 h-9 text-xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk actions bar for Urgent tab */}
            {activeTabId === 'urgent' && totalFiltered > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="select-all-page"
                            checked={
                                isAllPageSelected
                                    ? true
                                    : isSomePageSelected
                                    ? 'indeterminate'
                                    : false
                            }
                            onCheckedChange={() => handleToggleSelectAllPage()}
                            className="cursor-pointer"
                        />
                        <label
                            htmlFor="select-all-page"
                            className="text-xs font-medium text-foreground cursor-pointer select-none"
                        >
                            Select page ({selectableDisplayedLeads.length})
                        </label>

                        {selectedLeadIds.size > 0 && (
                            <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                                {selectedLeadIds.size} selected
                            </Badge>
                        )}

                        {selectedLeadIds.size > 0 && selectedLeadIds.size < filteredLeads.length && (
                            <button
                                onClick={handleSelectAllFiltered}
                                className="text-xs text-primary hover:underline font-medium cursor-pointer"
                            >
                                Select all {filteredLeads.length} urgent tasks
                            </button>
                        )}
                    </div>

                    {selectedLeadIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                onClick={handleBulkAssign}
                                className="h-8 text-xs gap-1.5 font-medium shadow-sm"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                Assign {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'Lead' : 'Leads'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearSelection}
                                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                            >
                                Clear
                            </Button>
                        </div>
                    )}
                </div>
            )}

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
            ) : filteredLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                    <h3 className="text-base font-semibold text-foreground mb-1">No tasks matching "{searchQuery}"</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">Try searching with a different name, phone, or email.</p>
                    <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setPage(1); }}>
                        Clear Search
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedLeads.map((lead) => {
                            const targetId = getLeadTargetId(lead);
                            return (
                                <LeadTaskCard
                                    key={lead.id}
                                    lead={lead}
                                    bucket={activeTabId}
                                    owners={owners || []}
                                    selectable={activeTabId === 'urgent'}
                                    isSelected={!!(targetId && selectedLeadIds.has(targetId))}
                                    onToggleSelect={handleToggleSelect}
                                    onView={handleViewLead}
                                    onEdit={setEditingLead}
                                    onAssign={handleSingleAssign}
                                    onReschedule={setReschedulingLead}
                                />
                            );
                        })}
                    </div>

                    {/* Pagination footer */}
                    {totalFiltered > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-border mt-6">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div>
                                    Showing {pageSize === 'all' ? 1 : (safePage - 1) * pageSize + 1} to{' '}
                                    {pageSize === 'all' ? totalFiltered : Math.min(safePage * pageSize, totalFiltered)} of {totalFiltered} tasks
                                    {totalFiltered !== currentLeads.length && ` (filtered from ${currentLeads.length})`}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span>Per page:</span>
                                    <Select
                                        value={pageSize.toString()}
                                        onValueChange={(val) => {
                                            setPageSize(val === 'all' ? 'all' : Number(val));
                                            setPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="h-7 w-[72px] text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="24">24</SelectItem>
                                            <SelectItem value="48">48</SelectItem>
                                            <SelectItem value="96">96</SelectItem>
                                            <SelectItem value="240">240</SelectItem>
                                            <SelectItem value="all">All</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {pageSize !== 'all' && totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                        className="h-8 text-xs"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                                        Previous
                                    </Button>
                                    <div className="text-xs font-medium px-2 text-muted-foreground">
                                        Page <span className="text-foreground font-semibold">{safePage}</span> of {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={safePage >= totalPages}
                                        className="h-8 text-xs"
                                    >
                                        Next
                                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Dialogs */}
            <Suspense fallback={null}>
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
            {assignDialogOpen && company?.industry?.toLowerCase() === 'real_estate' && (
                <RealEstateAssignLeadsDialog
                    open={assignDialogOpen}
                    onOpenChange={(open) => !open && setAssignDialogOpen(false)}
                    selectedLeadIds={activeSelectedIds}
                    onSuccess={() => {
                        refetch();
                        setSelectedLeadIds(new Set());
                        setAssignDialogOpen(false);
                    }}
                />
            )}
            {assignDialogOpen && company?.industry?.toLowerCase() === 'saas' && (
                <SaaSAssignLeadsDialog
                    open={assignDialogOpen}
                    onOpenChange={(open) => !open && setAssignDialogOpen(false)}
                    selectedLeadIds={activeSelectedIds}
                    onSuccess={() => {
                        refetch();
                        setSelectedLeadIds(new Set());
                        setAssignDialogOpen(false);
                    }}
                />
            )}
            {assignDialogOpen && company?.industry?.toLowerCase() === 'healthcare' && (
                <HealthcareAssignLeadsDialog
                    open={assignDialogOpen}
                    onOpenChange={(open) => !open && setAssignDialogOpen(false)}
                    selectedLeadIds={activeSelectedIds}
                    onSuccess={() => {
                        refetch();
                        setSelectedLeadIds(new Set());
                        setAssignDialogOpen(false);
                    }}
                />
            )}
            {assignDialogOpen && company?.industry?.toLowerCase() === 'insurance' && (
                <InsuranceAssignLeadsDialog
                    open={assignDialogOpen}
                    onOpenChange={(open) => !open && setAssignDialogOpen(false)}
                    selectedLeadIds={activeSelectedIds}
                    onSuccess={() => {
                        refetch();
                        setSelectedLeadIds(new Set());
                        setAssignDialogOpen(false);
                    }}
                />
            )}
            {assignDialogOpen && company?.industry?.toLowerCase() === 'travel' && (
                <TravelAssignLeadsDialog
                    open={assignDialogOpen}
                    onOpenChange={(open) => !open && setAssignDialogOpen(false)}
                    selectedLeadIds={activeSelectedIds}
                    onSuccess={() => {
                        refetch();
                        setSelectedLeadIds(new Set());
                        setAssignDialogOpen(false);
                    }}
                />
            )}
            {assignDialogOpen && !['real_estate', 'saas', 'healthcare', 'insurance', 'travel'].includes(company?.industry?.toLowerCase() || '') && (
                <AssignLeadsDialog
                    open={assignDialogOpen}
                    onOpenChange={(open) => !open && setAssignDialogOpen(false)}
                    selectedLeadIds={activeSelectedIds}
                    onSuccess={() => {
                        refetch();
                        setSelectedLeadIds(new Set());
                        setAssignDialogOpen(false);
                    }}
                />
            )}
            {reschedulingLead && (
                <RescheduleTaskDialog
                    open={!!reschedulingLead}
                    onOpenChange={(open) => !open && setReschedulingLead(null)}
                    lead={reschedulingLead}
                    onSuccess={() => {
                        refetch();
                        setReschedulingLead(null);
                    }}
                />
            )}
            </Suspense>
        </div>
    );
}
