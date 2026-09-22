import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useUpdateLead } from '@/hooks/useLeads';
import { useProducts } from '@/hooks/useProducts';
import { toast } from 'sonner';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { StatusReminderDialog } from './StatusReminderDialog';
import { Label } from '@/components/ui/label';
import { useCustomColumns } from '@/hooks/useCustomColumns';
import {
    User,
    Mail,
    Phone,
    Building,
    Globe,
    Layers,
    Tag,
    Package,
    FileText,
    Pencil,
    Save,
    Loader2,
    Sparkles,
    Calendar,
    Clock,
} from 'lucide-react';
import { format } from 'date-fns';

const formSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
    college: z.string().optional(),
    status: z.string(),
    lead_source: z.string().optional(),
    product_category: z.string().optional(),
    product_purchased: z.string().optional(),
    notes: z.string().optional(),
});

interface EditLeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lead: any;
}

export function EditLeadDialog({ open, onOpenChange, lead }: EditLeadDialogProps) {
    const updateLead = useUpdateLead();
    const { products } = useProducts();
    const { statuses } = useLeadStatuses();
    const [statusReminderOpen, setStatusReminderOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<CompanyLeadStatus | null>(null);
    const [reminderAt, setReminderAt] = useState<Date | null>(null);
    const [sendWebPush, setSendWebPush] = useState(false);
    const { customColumns } = useCustomColumns();
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

    // Unique categories from products
    const categories = Array.from(new Set(products?.map((p) => p.category) || [])).sort();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            college: '',
            status: 'new',
            lead_source: 'Others',
            product_category: '',
            product_purchased: '',
            notes: '',
        },
    });

    const watchedCategory = form.watch('product_category');
    const filteredProducts = products?.filter((p) => p.category === watchedCategory) || [];

    useEffect(() => {
        if (lead) {
            let initialCategory = (lead as any).product_category || '';
            if (!initialCategory && lead.product_purchased && products?.length) {
                const matchedProd = products.find((p) => p.name === lead.product_purchased);
                if (matchedProd) {
                    initialCategory = matchedProd.category;
                }
            }

            form.reset({
                name: lead.name || '',
                email: lead.email || '',
                phone: lead.phone || '',
                college: lead.college || '',
                status: lead.status || 'new',
                lead_source: lead.lead_source || 'Others',
                product_category: initialCategory,
                product_purchased: lead.product_purchased || '',
                notes: lead.notes || '',
            });
            setReminderAt((lead as any).reminder_at ? new Date((lead as any).reminder_at) : null);

            // Populate custom fields
            const initialCustomValues: Record<string, string> = {};
            customColumns.forEach((col) => {
                initialCustomValues[col.id] = lead[col.id] || '';
            });
            setCustomFieldValues(initialCustomValues);
        }
    }, [lead, form, customColumns, products]);

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
        if (!lead) return;

        try {
            await updateLead.mutateAsync({
                id: lead.id,
                name: values.name,
                email: values.email || null,
                phone: values.phone || null,
                college: values.college || null,
                status: values.status as any,
                lead_source: values.lead_source || null,
                product_category: values.product_category || null,
                product_purchased: values.product_purchased || null,
                notes: values.notes || null,
                reminder_at: reminderAt ? reminderAt.toISOString() : null,
                ...(reminderAt && sendWebPush ? { send_web_push: true, last_notification_sent_at: null } : {}),
                ...customFieldValues,
            });
            toast.success('Lead updated successfully');
            onOpenChange(false);
        } catch (error) {
            toast.error('Failed to update lead');
            console.error(error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col overflow-hidden p-0 bg-background border border-border shadow-2xl rounded-2xl">
                {/* ─── Modern Dialog Header ─── */}
                <DialogHeader className="px-6 py-4 border-b bg-card/70 backdrop-blur-md shrink-0 pr-12">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                                <Pencil className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                                        Edit Lead
                                    </DialogTitle>
                                    {lead?.status && (
                                        <Badge
                                            variant="outline"
                                            className="bg-primary/5 text-primary border-primary/20 text-[10px] font-semibold uppercase tracking-wider hidden sm:inline-flex"
                                        >
                                            {lead.status.replace(/_/g, ' ')}
                                        </Badge>
                                    )}
                                </div>
                                <DialogDescription className="text-xs text-muted-foreground truncate">
                                    Update contact profile, pipeline stage, and lead metadata for{' '}
                                    <span className="font-semibold text-foreground">{lead?.name || 'this lead'}</span>
                                </DialogDescription>
                            </div>
                        </div>

                        {reminderAt && (
                            <div className="hidden md:flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg shrink-0">
                                <Clock className="h-3.5 w-3.5" />
                                <span>
                                    {(() => {
                                        try {
                                            return format(reminderAt, 'dd MMM, h:mm a');
                                        } catch (_) {
                                            return 'Scheduled';
                                        }
                                    })()}
                                </span>
                            </div>
                        )}
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
                                    <span className="text-[11px] text-muted-foreground">Primary information</span>
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
                                    <span className="text-[11px] text-muted-foreground">Workflow status & acquisition</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">
                                                    Lead Status <span className="text-destructive">*</span>
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
                                                        <Input className="pl-9 h-9 text-xs" placeholder="e.g. Website, Referral, Campaign" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[11px]" />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 3: Product Interest (Conditionally shown if categories available) */}
                            {categories.length > 0 && (
                                <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3.5 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                            <Package className="h-3.5 w-3.5" /> Product Interest
                                        </h3>
                                        <span className="text-[11px] text-muted-foreground">Catalog offering</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="product_category"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-semibold text-muted-foreground">Product Category</FormLabel>
                                                    <Select
                                                        onValueChange={(val) => {
                                                            field.onChange(val);
                                                            form.setValue('product_purchased', '');
                                                        }}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="h-9 text-xs">
                                                                <SelectValue placeholder="Select Category" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {categories.map((cat) => (
                                                                <SelectItem key={cat} value={cat} className="text-xs">
                                                                    {cat}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage className="text-[11px]" />
                                                </FormItem>
                                            )}
                                        />

                                        {watchedCategory ? (
                                            <FormField
                                                control={form.control}
                                                name="product_purchased"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground">Selected Product</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-9 text-xs">
                                                                    <SelectValue placeholder="Select Product" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="none_selected_placeholder" className="hidden">
                                                                    Select Product
                                                                </SelectItem>
                                                                {filteredProducts.map((prod) => (
                                                                    <SelectItem key={prod.id} value={prod.name} className="text-xs">
                                                                        {prod.name} (₹{prod.price})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage className="text-[11px]" />
                                                    </FormItem>
                                                )}
                                            />
                                        ) : (
                                            <div className="flex items-center text-xs text-muted-foreground/70 italic pt-6">
                                                Select a category first to choose a specific product.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section 4: Custom Columns / Additional Fields */}
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
                                                <Label htmlFor={`custom-${col.id}`} className="text-xs font-semibold text-muted-foreground">
                                                    {col.label}
                                                </Label>
                                                <Input
                                                    id={`custom-${col.id}`}
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

                            {/* Section 5: Follow-up Notes */}
                            <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" /> Notes & Follow-up Log
                                    </h3>
                                    <span className="text-[11px] text-muted-foreground">Internal comments</span>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Add relevant notes, conversation highlights, or next steps for this lead..."
                                                    className="min-h-[100px] text-xs leading-relaxed resize-none bg-background/50 focus:bg-background"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* ─── Modern Action Footer ─── */}
                        <DialogFooter className="px-6 py-3.5 border-t bg-muted/20 shrink-0 flex flex-row items-center justify-between gap-3 sm:space-x-0">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 text-xs font-medium"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="h-9 gap-1.5 px-5 text-xs font-semibold shadow-sm"
                                disabled={updateLead.isPending}
                            >
                                {updateLead.isPending ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-3.5 w-3.5" />
                                        Save Changes
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
