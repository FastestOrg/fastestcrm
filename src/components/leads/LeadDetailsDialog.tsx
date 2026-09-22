import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import {
    Mail,
    Phone,
    Building,
    Calendar,
    User,
    CreditCard,
    Link as LinkIcon,
    MapPin,
    Home,
    DollarSign,
    Megaphone,
    Globe,
    Layers,
    CalendarClock,
    Pencil,
    Save,
    Shield,
    Brain,
    MessageSquare,
    Clock,
    CheckCircle2,
    Copy,
    Check,
    Tag,
    ChevronRight,
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { MaskedValue } from '@/components/ui/MaskedValue';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { LeadTimeline } from './LeadTimeline';
import { OmnichannelLeadChat } from './OmnichannelLeadChat';
import { useUpdateLead } from '@/hooks/useLeads';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { StatusReminderDialog } from './StatusReminderDialog';
import { toast } from 'sonner';
import { PriorityBadge } from './PriorityBadge';
import { CompetitorBattleCard } from './CompetitorBattleCard';
import { useLeadScoring } from '@/hooks/useLeadScoring';
import { useCompany } from '@/hooks/useCompany';
import { AICallerCallButton } from '@/components/ai-caller/AICallerCallButton';
import { AIAgentHistoryTab } from './AIAgentHistoryTab';
import { useCustomColumns } from '@/hooks/useCustomColumns';

type Lead = Tables<'leads'> & Partial<Tables<'leads_real_estate'>> & {
    sales_owner?: {
        full_name: string | null;
    } | null;
};

interface LeadDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lead: any;
    owners: { label: string; value: string }[];
    maskLeads?: boolean;
    onEdit?: (lead: any) => void;
    onUpdate?: () => void;
}

export function LeadDetailsDialog({
    open,
    onOpenChange,
    lead,
    owners,
    maskLeads = false,
    onEdit,
    onUpdate,
}: LeadDetailsDialogProps) {
    const updateLead = useUpdateLead();
    const { statuses } = useLeadStatuses();
    const { company } = useCompany();
    const [quickStatus, setQuickStatus] = useState(lead?.status || 'new');
    const [quickNotes, setQuickNotes] = useState(lead?.notes || '');
    const [isSaving, setIsSaving] = useState(false);
    const [statusReminderOpen, setStatusReminderOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<CompanyLeadStatus | null>(null);
    const [reminderAt, setReminderAt] = useState<Date | null>(null);
    const [sendWebPush, setSendWebPush] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const { score, level, breakdown } = useLeadScoring(lead);
    const { customColumns } = useCustomColumns();

    useEffect(() => {
        if (lead) {
            setQuickStatus(lead.status || 'new');
            setQuickNotes(lead.notes || '');
        }
    }, [lead]);

    if (!lead) return null;

    const copyToClipboard = (text: string, key: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        toast.success(`Copied ${label} to clipboard`);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleStatusChange = (newStatusValue: string) => {
        const newStatus = statuses?.find((s) => s.value === newStatusValue);

        if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived')) {
            setPendingStatus(newStatus);
            setStatusReminderOpen(true);
        } else {
            setQuickStatus(newStatusValue);
            setReminderAt(null);
        }
    };

    const handleReminderConfirm = (date: Date | null, sendNotification: boolean) => {
        if (pendingStatus) {
            setQuickStatus(pendingStatus.value);
            setReminderAt(date);
            setSendWebPush(sendNotification);
        }
        setStatusReminderOpen(false);
        setPendingStatus(null);
    };

    const handleReminderCancel = () => {
        setStatusReminderOpen(false);
        setPendingStatus(null);
    };

    const handleQuickSave = async () => {
        setIsSaving(true);
        try {
            await updateLead.mutateAsync({
                id: lead.id,
                status: quickStatus as any,
                notes: quickNotes,
                reminder_at: reminderAt ? reminderAt.toISOString() : (lead.status === quickStatus ? lead.reminder_at : null),
                ...(reminderAt && sendWebPush ? { send_web_push: true, last_notification_sent_at: null } : {}),
            });
            toast.success('Lead updated successfully');
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error('Failed to update lead');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    // Currency Formatter
    const formatCurrency = (amount: number | null) => {
        if (!amount) return 'N/A';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Date Formatters
    const formatDate = (isoString?: string | null) => {
        if (!isoString) return 'N/A';
        try {
            return format(new Date(isoString), 'PPP p');
        } catch (_) {
            return 'N/A';
        }
    };

    const formatShortDate = (isoString?: string | null) => {
        if (!isoString) return 'N/A';
        try {
            return format(new Date(isoString), 'PPP');
        } catch (_) {
            return 'N/A';
        }
    };

    // Helpers to check field groups
    const hasRealEstateData =
        lead.property_name ||
        lead.property_type ||
        lead.budget_min ||
        lead.budget_max ||
        lead.preferred_location ||
        lead.possession_timeline ||
        lead.purpose ||
        lead.site_visit_date ||
        lead.broker_name ||
        lead.unit_number ||
        lead.deal_value;

    const hasMarketingData =
        lead.utm_source ||
        lead.utm_medium ||
        lead.utm_campaign ||
        lead.lead_source ||
        lead.ca_name;

    const customColumnsWithValues = customColumns.filter((col) => {
        const val = lead[col.id];
        return val !== undefined && val !== null && val !== '';
    });

    const ownerName =
        lead.sales_owner?.full_name ||
        owners.find((o) => o.value === lead.sales_owner_id)?.label ||
        'Unassigned';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[95vw] h-[88vh] max-h-[88vh] p-0 flex flex-col overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
                {/* ─── Compact Header ─── */}
                <DialogHeader className="px-5 sm:px-6 py-3.5 border-b bg-card/80 backdrop-blur-sm shrink-0 pr-12">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                                    {lead.name}
                                </DialogTitle>
                                <PriorityBadge level={level} score={score} showScore />
                                <Badge
                                    variant="outline"
                                    className="bg-primary/5 text-primary border-primary/20 text-xs font-semibold uppercase tracking-wider"
                                >
                                    {lead.status?.replace(/_/g, ' ') || 'New'}
                                </Badge>
                            </div>

                            <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {lead.email && (
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(lead.email, 'email', 'Email')}
                                        className="group inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                                        title="Click to copy email"
                                    >
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <MaskedValue value={lead.email} type="email" enabled={maskLeads} />
                                        {copiedKey === 'email' ? (
                                            <Check className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                                        )}
                                    </button>
                                )}
                                {lead.phone && (
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(lead.phone, 'phone', 'Phone')}
                                        className="group inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                                        title="Click to copy phone"
                                    >
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <MaskedValue value={lead.phone} type="phone" enabled={maskLeads} />
                                        {copiedKey === 'phone' ? (
                                            <Check className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                                        )}
                                    </button>
                                )}
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
                                    <User className="h-3.5 w-3.5" />
                                    <span>Owner: {ownerName}</span>
                                </span>
                            </DialogDescription>
                        </div>

                        {/* Top Right Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            {company?.ai_calling_button_active && lead.phone && company.id && (
                                <AICallerCallButton
                                    leadId={lead.id}
                                    leadPhone={lead.phone}
                                    leadName={lead.name}
                                    companyId={company.id}
                                    size="sm"
                                />
                            )}
                            {onEdit && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs font-medium"
                                    onClick={() => onEdit(lead)}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span>Edit</span>
                                </Button>
                            )}
                            <div className="hidden md:flex flex-col text-right pl-2.5 border-l border-border/60">
                                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                                    Score Breakdown
                                </span>
                                <span className="text-xs font-bold text-foreground">
                                    P: {breakdown.profile} • E: {breakdown.engagement}
                                </span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* ─── Tabs Container ─── */}
                <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="px-5 sm:px-6 border-b bg-muted/20 shrink-0">
                        <TabsList className="h-10 w-full sm:w-auto inline-flex justify-start bg-transparent p-0 gap-1 overflow-x-auto">
                            <TabsTrigger
                                value="details"
                                className="h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-none px-4 text-xs font-semibold transition-all"
                            >
                                Lead Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="timeline"
                                className="h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-none px-4 text-xs font-semibold transition-all"
                            >
                                Activity Feed
                            </TabsTrigger>
                            <TabsTrigger
                                value="conversations"
                                className="h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-none px-4 text-xs font-semibold transition-all gap-1.5"
                            >
                                <MessageSquare className="h-3.5 w-3.5" /> Conversations
                            </TabsTrigger>
                            <TabsTrigger
                                value="competitor"
                                className="h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-none px-4 text-xs font-semibold transition-all gap-1.5"
                            >
                                <Shield className="h-3.5 w-3.5" /> Competitive Edge
                            </TabsTrigger>
                            <TabsTrigger
                                value="ai-agent"
                                className="h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-none px-4 text-xs font-semibold transition-all gap-1.5"
                            >
                                <Brain className="h-3.5 w-3.5" /> AI Agent History
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* ─── TAB 1: Lead Details (2-Column Single Screen Layout) ─── */}
                    <TabsContent
                        value="details"
                        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 focus-visible:outline-none"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                            {/* Left Pane: Information Sections (7 cols on lg, 8 on xl) */}
                            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                                {/* Contact & Core Details Card */}
                                <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" /> Contact Information
                                        </h3>
                                        <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground border-border/60">
                                            Primary Profile
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
                                        <div className="space-y-1">
                                            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                <User className="h-3 w-3 text-muted-foreground/80" /> Name
                                            </span>
                                            <p className="font-semibold text-foreground truncate">{lead.name}</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                <Mail className="h-3 w-3 text-muted-foreground/80" /> Email
                                            </span>
                                            <div className="font-medium truncate">
                                                <MaskedValue value={lead.email} type="email" enabled={maskLeads} />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                <Phone className="h-3 w-3 text-muted-foreground/80" /> Phone
                                            </span>
                                            <div className="font-medium truncate">
                                                <MaskedValue value={lead.phone} type="phone" enabled={maskLeads} />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                <User className="h-3 w-3 text-muted-foreground/80" /> Assigned Owner
                                            </span>
                                            <p className="font-medium text-foreground truncate">{ownerName}</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3 text-muted-foreground/80" /> Created Date
                                            </span>
                                            <p className="font-medium text-foreground truncate">{formatDate(lead.created_at)}</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                <Tag className="h-3 w-3 text-muted-foreground/80" /> Current Status
                                            </span>
                                            <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold border-border/80 bg-secondary text-secondary-foreground capitalize truncate max-w-full">
                                                {lead.status?.replace(/_/g, ' ') || 'New'}
                                            </div>
                                        </div>

                                        {lead.college && (
                                            <div className="space-y-1 sm:col-span-2">
                                                <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                                                    <Building className="h-3 w-3 text-muted-foreground/80" /> College / Institution
                                                </span>
                                                <p className="font-medium text-foreground">{lead.college}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Custom Columns / Custom Attributes Card */}
                                {customColumnsWithValues.length > 0 && (
                                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                                <Layers className="h-3.5 w-3.5" /> Additional Attributes ({customColumnsWithValues.length})
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                            {customColumnsWithValues.map((col) => (
                                                <div
                                                    key={col.id}
                                                    className="rounded-lg bg-muted/30 border border-border/50 p-2.5 space-y-0.5 transition-colors hover:border-primary/30"
                                                >
                                                    <span className="text-[11px] font-medium text-muted-foreground block truncate" title={col.label}>
                                                        {col.label}
                                                    </span>
                                                    <p className="text-xs font-semibold text-foreground truncate" title={String(lead[col.id])}>
                                                        {String(lead[col.id])}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Marketing & Attribution Card */}
                                {hasMarketingData && (
                                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                                <Globe className="h-3.5 w-3.5" /> Marketing & Attribution
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                            {lead.lead_source && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Globe className="h-3 w-3" /> Lead Source
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.lead_source}</p>
                                                </div>
                                            )}
                                            {lead.utm_source && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Megaphone className="h-3 w-3" /> UTM Source
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.utm_source}</p>
                                                </div>
                                            )}
                                            {lead.utm_medium && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Layers className="h-3 w-3" /> UTM Medium
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.utm_medium}</p>
                                                </div>
                                            )}
                                            {lead.utm_campaign && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Megaphone className="h-3 w-3" /> UTM Campaign
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.utm_campaign}</p>
                                                </div>
                                            )}
                                            {lead.ca_name && !lead.utm_source && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <User className="h-3 w-3" /> CA / Source
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.ca_name}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Real Estate Details Card */}
                                {hasRealEstateData && (
                                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                                <Home className="h-3.5 w-3.5" /> Real Estate Requirements
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                            {lead.property_name && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Home className="h-3 w-3" /> Property
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.property_name}</p>
                                                </div>
                                            )}
                                            {lead.property_type && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Layers className="h-3 w-3" /> Type
                                                    </span>
                                                    <p className="font-semibold text-foreground capitalize truncate">{lead.property_type.replace(/_/g, ' ')}</p>
                                                </div>
                                            )}
                                            {(lead.budget_min || lead.budget_max) && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <DollarSign className="h-3 w-3" /> Budget
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">
                                                        {lead.budget_min ? formatCurrency(lead.budget_min) : '0'} - {lead.budget_max ? formatCurrency(lead.budget_max) : 'Any'}
                                                    </p>
                                                </div>
                                            )}
                                            {lead.preferred_location && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <MapPin className="h-3 w-3" /> Location
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.preferred_location}</p>
                                                </div>
                                            )}
                                            {lead.possession_timeline && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <CalendarClock className="h-3 w-3" /> Possession
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.possession_timeline}</p>
                                                </div>
                                            )}
                                            {lead.purpose && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <User className="h-3 w-3" /> Purpose
                                                    </span>
                                                    <p className="font-semibold text-foreground capitalize truncate">{lead.purpose}</p>
                                                </div>
                                            )}
                                            {lead.unit_number && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Home className="h-3 w-3" /> Unit No.
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.unit_number}</p>
                                                </div>
                                            )}
                                            {lead.deal_value && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <DollarSign className="h-3 w-3" /> Deal Value
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{formatCurrency(lead.deal_value)}</p>
                                                </div>
                                            )}
                                            {lead.broker_name && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <User className="h-3 w-3" /> Broker
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{lead.broker_name}</p>
                                                </div>
                                            )}
                                            {lead.site_visit_date && (
                                                <div className="space-y-0.5">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        <Calendar className="h-3 w-3" /> Site Visit
                                                    </span>
                                                    <p className="font-semibold text-foreground truncate">{formatShortDate(lead.site_visit_date)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Product Details Card */}
                                {(lead.product_purchased || (lead as any).product_category || lead.payment_link) && (
                                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                                <CreditCard className="h-3.5 w-3.5" /> Product Details
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div className="space-y-1">
                                                <p><span className="text-muted-foreground">Category:</span> {(lead as any).product_category || 'N/A'}</p>
                                                <p><span className="text-muted-foreground">Product:</span> {lead.product_purchased || 'N/A'}</p>
                                            </div>
                                            {lead.payment_link && (
                                                <div className="space-y-1">
                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                        <LinkIcon className="h-3 w-3" /> Payment Link
                                                    </span>
                                                    <a
                                                        href={lead.payment_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                                                    >
                                                        Open Payment Link <ChevronRight className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Pane: Quick Action & Update Hub (5 cols on lg, 4 on xl) */}
                            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                                <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4 lg:sticky lg:top-0">
                                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                            <Save className="h-3.5 w-3.5 text-primary" /> Quick Update
                                        </h3>
                                        {lead.reminder_at && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                                <Clock className="h-3 w-3" />
                                                {(() => {
                                                    try {
                                                        return format(new Date(lead.reminder_at), 'dd MMM, h:mm a');
                                                    } catch (_) {
                                                        return 'Scheduled';
                                                    }
                                                })()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Status Selector */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                                            <span>Update Status</span>
                                            <span className="text-[10px] text-muted-foreground/60 font-normal">Triggers workflow</span>
                                        </label>
                                        <Select value={quickStatus} onValueChange={handleStatusChange}>
                                            <SelectTrigger className="w-full h-9 text-xs font-medium">
                                                <SelectValue placeholder="Select Status" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                {statuses.map((status) => (
                                                    <SelectItem key={status.id} value={status.value} className="text-xs">
                                                        {status.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Quick Notes Textarea */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">
                                            Notes & Follow-up Log
                                        </label>
                                        <Textarea
                                            value={quickNotes}
                                            onChange={(e) => setQuickNotes(e.target.value)}
                                            placeholder="Write quick notes or update next steps about this lead..."
                                            className="min-h-[110px] text-xs leading-relaxed resize-none bg-background/50 focus:bg-background"
                                        />
                                    </div>

                                    {/* Save Button */}
                                    <Button
                                        className="w-full h-9 text-xs font-semibold shadow-sm"
                                        onClick={handleQuickSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            'Saving changes...'
                                        ) : (
                                            <>
                                                <Save className="mr-1.5 h-3.5 w-3.5" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>

                                    {/* Quick Connect / Communication Shortcuts */}
                                    <div className="pt-2 border-t border-border/60">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                                            Quick Connect
                                        </span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {lead.phone && (
                                                <a
                                                    href={`tel:${lead.phone}`}
                                                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg border border-border bg-muted/20 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-center"
                                                >
                                                    <Phone className="h-3.5 w-3.5 text-primary" /> Call
                                                </a>
                                            )}
                                            {lead.phone && (
                                                <a
                                                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all text-center"
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                                                </a>
                                            )}
                                            {lead.email && (
                                                <a
                                                    href={`mailto:${lead.email}`}
                                                    className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg border border-border bg-muted/20 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-center ${lead.phone ? 'col-span-2' : 'col-span-2'}`}
                                                >
                                                    <Mail className="h-3.5 w-3.5 text-primary" /> Send Email
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ─── TAB 2: Activity Feed ─── */}
                    <TabsContent value="timeline" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 focus-visible:outline-none">
                        <LeadTimeline
                            leadId={lead.id}
                            email={lead.email}
                            phone={lead.phone}
                            leadHistory={lead.lead_history || []}
                        />
                    </TabsContent>

                    {/* ─── TAB 3: Conversations (Omnichannel Chat) ─── */}
                    <TabsContent value="conversations" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 focus-visible:outline-none">
                        <OmnichannelLeadChat lead={lead} />
                    </TabsContent>

                    {/* ─── TAB 4: Competitive Edge ─── */}
                    <TabsContent value="competitor" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 focus-visible:outline-none">
                        <CompetitorBattleCard
                            leadId={lead.id}
                            initialCompetitor={(lead as any).competitors || (lead as any).current_solution}
                        />
                    </TabsContent>

                    {/* ─── TAB 5: AI Agent History ─── */}
                    <TabsContent value="ai-agent" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 focus-visible:outline-none">
                        <AIAgentHistoryTab leadId={lead.id} />
                    </TabsContent>
                </Tabs>
            </DialogContent>

            {pendingStatus && (
                <StatusReminderDialog
                    open={statusReminderOpen}
                    onOpenChange={setStatusReminderOpen}
                    status={pendingStatus}
                    onConfirm={handleReminderConfirm}
                    onCancel={handleReminderCancel}
                />
            )}
        </Dialog>
    );
}
