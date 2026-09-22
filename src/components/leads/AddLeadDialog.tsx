import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useCreateLead } from '@/hooks/useLeads';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import {
    Plus,
    User,
    Mail,
    Phone,
    Building,
    Globe,
    Layers,
    UserPlus,
    Save,
    Loader2,
    Sparkles,
} from 'lucide-react';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { StatusReminderDialog } from './StatusReminderDialog';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { Label } from '@/components/ui/label';
import { useCustomColumns } from '@/hooks/useCustomColumns';

const formSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
    college: z.string().optional(),
    status: z.string(),
    lead_source: z.string().optional(),
});

interface AddLeadDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function AddLeadDialog({ open: controlledOpen, onOpenChange, trigger }: AddLeadDialogProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;
    const { user } = useAuth();
    const { company } = useCompany();
    const createLead = useCreateLead();
    const { tableName } = useLeadsTable();
    const { statuses } = useLeadStatuses();
    const [statusReminderOpen, setStatusReminderOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<CompanyLeadStatus | null>(null);
    const [reminderAt, setReminderAt] = useState<Date | null>(null);
    const [sendWebPush, setSendWebPush] = useState(false);
    const { customColumns } = useCustomColumns();
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            college: '',
            status: 'new',
            lead_source: 'Others',
        },
    });

    const handleStatusChange = (newStatusValue: string) => {
        const newStatus = statuses?.find((s) => s.value === newStatusValue);

        if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived')) {
            setPendingStatus(newStatus);
            setStatusReminderOpen(true);
        } else {
            form.setValue('status', newStatusValue);
            setReminderAt(null);
        }
    };

    const handleReminderConfirm = (date: Date | null, sendNotification: boolean) => {
        if (pendingStatus) {
            form.setValue('status', pendingStatus.value);
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

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user || !company) {
            toast.error('You must be logged in and part of a company to add a lead');
            return;
        }

        try {
            const payload: any = {
                name: values.name,
                email: values.email || null,
                phone: values.phone || null,
                status: values.status as any,
                lead_source: values.lead_source || null,
                created_by_id: user.id,
                sales_owner_id: user.id,
                company_id: company.id,
                reminder_at: reminderAt ? reminderAt.toISOString() : null,
                ...customFieldValues,
            };

            // Only add industry-specific fields if supported
            if (tableName === 'leads' || tableName === 'leads_weskill') {
                payload.college = values.college || null;
            }

            // Only add 'send_web_push' if supported
            if (reminderAt && sendWebPush && tableName === 'leads') {
                payload.send_web_push = true;
            }

            try {
                await createLead.mutateAsync(payload);
                toast.success('Lead added successfully');
                setOpen(false);
                form.reset();
                setCustomFieldValues({});
                setReminderAt(null);
            } catch (firstErr: any) {
                if (
                    firstErr?.code === 'PGRST204' &&
                    (firstErr?.message?.includes('lead_source') || firstErr?.message?.includes('column'))
                ) {
                    try {
                        const fallbackPayload = { ...payload };
                        delete fallbackPayload.lead_source;
                        if (values.lead_source) fallbackPayload.source = values.lead_source;
                        await createLead.mutateAsync(fallbackPayload);
                        toast.success('Lead added successfully');
                        setOpen(false);
                        form.reset();
                        setCustomFieldValues({});
                        setReminderAt(null);
                        return;
                    } catch (retryErr: any) {
                        throw retryErr;
                    }
                }
                throw firstErr;
            }
        } catch (error: any) {
            console.error('Detailed Error adding lead:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                raw: error,
            });
            toast.error(error.message || 'Failed to add lead. Please check the console for details.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger !== undefined ? (
                trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button className="gradient-primary shadow-sm gap-2">
                        <Plus className="h-4 w-4" />
                        Add Lead
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col overflow-hidden p-0 bg-background border border-border shadow-2xl rounded-2xl">
                {/* ─── Modern Dialog Header ─── */}
                <DialogHeader className="px-6 py-4 border-b bg-card/70 backdrop-blur-md shrink-0 pr-12">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                                Add New Lead
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Create a new lead profile, configure pipeline stage, and capture initial details
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* ─── Form Body ─── */}
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                            {/* Section 1: Contact Information */}
                            <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3.5 shadow-sm">
                                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5" /> Contact Details
                                    </h3>
                                    <span className="text-[11px] text-muted-foreground">Primary identity</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">
                                                    Full Name <span className="text-destructive">*</span>
                                                </FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                                                        <Input className="pl-9 h-9 text-xs" placeholder="e.g. John Doe" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[11px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Email Address</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                                                        <Input className="pl-9 h-9 text-xs" placeholder="name@example.com" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[11px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Phone Number</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                                                        <Input className="pl-9 h-9 text-xs" placeholder="e.g. +91 9876543210" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[11px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="college"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">College / Organization</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                                                        <Input className="pl-9 h-9 text-xs" placeholder="e.g. IIT Delhi" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[11px]" />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 2: Pipeline & Source */}
                            <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3.5 shadow-sm">
                                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                        <Layers className="h-3.5 w-3.5" /> Pipeline & Source
                                    </h3>
                                    <span className="text-[11px] text-muted-foreground">Initial workflow stage & channel</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">
                                                    Initial Status <span className="text-destructive">*</span>
                                                </FormLabel>
                                                <Select onValueChange={handleStatusChange} value={field.value} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-9 text-xs">
                                                            <SelectValue placeholder="Select Status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="max-h-60">
                                                        {statuses.map((status) => (
                                                            <SelectItem key={status.id} value={status.value} className="text-xs capitalize">
                                                                {status.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-[11px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="lead_source"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Lead Source</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                                                        <Input className="pl-9 h-9 text-xs" placeholder="e.g. Website, Referral, Cold Outreach" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[11px]" />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 3: Custom Columns / Additional Fields */}
                            {customColumns.length > 0 && (
                                <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3.5 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5" /> Additional Attributes ({customColumns.length})
                                        </h3>
                                        <span className="text-[11px] text-muted-foreground">Custom company fields</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {customColumns.map((col) => (
                                            <div key={col.id} className="space-y-1.5">
                                                <Label htmlFor={`custom-add-${col.id}`} className="text-xs font-semibold text-muted-foreground">
                                                    {col.label}
                                                </Label>
                                                <Input
                                                    id={`custom-add-${col.id}`}
                                                    placeholder={`Enter ${col.label}`}
                                                    value={customFieldValues[col.id] || ''}
                                                    onChange={(e) =>
                                                        setCustomFieldValues((prev) => ({
                                                            ...prev,
                                                            [col.id]: e.target.value,
                                                        }))
                                                    }
                                                    className="h-9 text-xs"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ─── Modern Action Footer ─── */}
                        <DialogFooter className="px-6 py-3.5 border-t bg-muted/20 shrink-0 flex flex-row items-center justify-between gap-3 sm:space-x-0">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 text-xs font-medium"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="h-9 gap-1.5 px-5 text-xs font-semibold shadow-sm gradient-primary"
                                disabled={createLead.isPending}
                            >
                                {createLead.isPending ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Creating Lead...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-3.5 w-3.5" />
                                        Create Lead
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
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
