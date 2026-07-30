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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { REAL_ESTATE_PROPERTY_TYPES, REAL_ESTATE_PURPOSES } from '../config';
import type { RealEstateLead } from './RealEstateLeadsTable';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  property_type: z.string().optional(),
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  preferred_location: z.string().optional(),
  property_size: z.string().optional(),
  purpose: z.string().optional(),
  possession_timeline: z.string().optional(),
  broker_name: z.string().optional(),
  property_name: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface RealEstateEditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: RealEstateLead | null;
  onSuccess: () => void;
}

export function RealEstateEditLeadDialog({
  open,
  onOpenChange,
  lead,
  onSuccess
}: RealEstateEditLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { statuses } = useLeadStatuses();
  const { orgClient } = useOrgClient();
  const [statusReminderOpen, setStatusReminderOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CompanyLeadStatus | null>(null);
  const [reminderAt, setReminderAt] = useState<Date | null>(null);
  const [sendWebPush, setSendWebPush] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      property_type: '',
      budget_min: '',
      budget_max: '',
      preferred_location: '',
      property_size: '',
      purpose: '',
      possession_timeline: '',
      broker_name: '',
      property_name: '',
      notes: '',
      status: 'new',
      lead_source: '',
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        whatsapp: lead.whatsapp || '',
        property_type: lead.property_type || '',
        budget_min: lead.budget_min?.toString() || '',
        budget_max: lead.budget_max?.toString() || '',
        preferred_location: lead.preferred_location || '',
        property_size: lead.property_size || '',
        purpose: lead.purpose || '',
        possession_timeline: lead.possession_timeline || '',
        broker_name: lead.broker_name || '',
        property_name: lead.property_name || '',
        notes: lead.notes || '',
        status: lead.status,
        lead_source: lead.lead_source || '',
      });
      setReminderAt(lead.reminder_at ? new Date(lead.reminder_at) : null);
    }
  }, [lead, form]);

  const handleStatusChange = (newStatusValue: string) => {
    const newStatus = statuses?.find(s => s.value === newStatusValue);

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

    setIsSubmitting(true);
    try {
      const { error } = await orgClient
        .from('leads_real_estate')
        .update({
          name: values.name,
          email: values.email || null,
          phone: values.phone || null,
          whatsapp: values.whatsapp || null,
          property_type: values.property_type || null,
          budget_min: values.budget_min ? parseFloat(values.budget_min) : null,
          budget_max: values.budget_max ? parseFloat(values.budget_max) : null,
          preferred_location: values.preferred_location || null,
          property_size: values.property_size || null,
          purpose: values.purpose || null,
          possession_timeline: values.possession_timeline || null,
          broker_name: values.broker_name || null,
          property_name: values.property_name || null,
          notes: values.notes || null,
          status: values.status,
          lead_source: values.lead_source || null,
          reminder_at: reminderAt ? reminderAt.toISOString() : null,
          ...(reminderAt && sendWebPush ? { send_web_push: true, last_notification_sent_at: null } : {}),
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success('Lead updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Failed to update lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>
            Update real estate lead details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Full Name" {...field} />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="property_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REAL_ESTATE_PROPERTY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REAL_ESTATE_PURPOSES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budget_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Budget (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Budget (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="preferred_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Bandra, Mumbai" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Size</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2 BHK or 1500 sq ft" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="possession_timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Possession Timeline</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Immediate, 6 months" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Lodha World Towers" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="broker_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Broker/Agent Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Referral source" {...field} />
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
                      <Input placeholder="e.g., 99acres, MagicBricks" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={handleStatusChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.id} value={status.value}>
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Lead'}
            </Button>
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
    </Dialog >
  );
}
