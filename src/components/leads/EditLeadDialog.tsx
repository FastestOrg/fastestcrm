import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    SelectGroup,
    SelectLabel,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateLead } from '@/hooks/useLeads';
import { useProducts } from '@/hooks/useProducts';
import { Constants } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { StatusReminderDialog } from './StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { Label } from '@/components/ui/label';
import { useCustomColumns } from '@/hooks/useCustomColumns';

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

    // Get unique categories
    const categories = Array.from(new Set(products?.map(p => p.category) || [])).sort();

    // Filter products based on selected category matches UI requirements
    const selectedCategory = lead?.product_category; // Initial value helper if needed, but form controls it

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
    const filteredProducts = products?.filter(p => p.category === watchedCategory) || [];

    useEffect(() => {
        if (lead) {
            form.reset({
                name: lead.name,
                email: lead.email || '',
                phone: lead.phone || '',
                college: lead.college || '',
                status: lead.status,
                lead_source: lead.lead_source || 'Others',
                product_category: (lead as any).product_category || '', // Cast because type might not be updated yet
                product_purchased: lead.product_purchased || '',
                notes: lead.notes || '',
            });
            setReminderAt((lead as any).reminder_at ? new Date((lead as any).reminder_at) : null);

            // Populate custom fields
            const initialCustomValues: Record<string, string> = {};
            customColumns.forEach(col => {
                initialCustomValues[col.id] = lead[col.id] || '';
            });
            setCustomFieldValues(initialCustomValues);
        }
    }, [lead, form, customColumns]);

    const handleStatusChange = (newStatusValue: string) => {
        const newStatus = statuses?.find(s => s.value === newStatusValue);

        if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived')) {
            setPendingStatus(newStatus);
            setStatusReminderOpen(true);
            // Don't update form yet
        } else {
            form.setValue('status', newStatusValue);
            setReminderAt(null); // Clear reminder if switch to simple status? Or keep? Let's clear for now to avoid stale reminders.
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
        // Form status remains unchanged
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
                product_purchased: values.product_purchased || null, // This stores the Product Name
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
            <DialogContent className="sm:max-w-[450px] max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="px-1">
                    <DialogTitle>Edit Lead</DialogTitle>
                    <DialogDescription>
                        Update the details of the lead here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="john@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+91 98765 43210" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="college"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>College</FormLabel>
                                        <FormControl>
                                            <Input placeholder="IIT Delhi" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="lead_source"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Lead Source</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Website, Referral, etc." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select
                                            onValueChange={handleStatusChange}
                                            value={field.value}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {statuses.map((status) => (
                                                    <SelectItem key={status.id} value={status.value} className="capitalize">
                                                        {status.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="product_category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Product Category</FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                form.setValue('product_purchased', '');
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories.map((cat) => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {watchedCategory && (
                                <FormField
                                    control={form.control}
                                    name="product_purchased"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Product (Optional)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Product" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none_selected_placeholder" className="hidden">Select Product</SelectItem>
                                                    {filteredProducts.map((prod) => (
                                                        <SelectItem key={prod.id} value={prod.name}>
                                                            {prod.name} (₹{prod.price})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Add any notes about this lead..."
                                                className="min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {customColumns.map((col) => (
                                <div key={col.id} className="space-y-2">
                                    <Label htmlFor={`custom-${col.id}`} className="text-sm font-medium">{col.label}</Label>
                                    <Input
                                        id={`custom-${col.id}`}
                                        placeholder={`Enter ${col.label}`}
                                        value={customFieldValues[col.id] || ''}
                                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [col.id]: e.target.value }))}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t mt-4 px-1">
                            <Button type="submit" className="w-full" disabled={updateLead.isPending}>
                                {updateLead.isPending ? 'Updating...' : 'Update Lead'}
                            </Button>
                        </div>
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
