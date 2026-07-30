import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { TRIP_TYPES, PACKAGE_TYPES } from '../config';
import type { TravelLead } from './TravelLeadsTable';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';

const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  destination: z.string().optional(),
  travel_date: z.string().optional(),
  return_date: z.string().optional(),
  travelers_count: z.string().optional(),
  trip_type: z.string().optional(),
  package_type: z.string().optional(),
  budget: z.string().optional(),
  special_requests: z.string().optional(),
  hotel_name: z.string().optional(),
  flight_details: z.string().optional(),
  package_cost: z.string().optional(),
  advance_paid: z.string().optional(),
  balance_due: z.string().optional(),
  booking_id: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: TravelLead | null;
  onSuccess: () => void;
}

export function TravelEditLeadDialog({ open, onOpenChange, lead, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { statuses } = useLeadStatuses();
  const { orgClient } = useOrgClient();
  const [statusReminderOpen, setStatusReminderOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CompanyLeadStatus | null>(null);
  const [reminderAt, setReminderAt] = useState<Date | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', phone: '', status: 'new' },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name, email: lead.email || '', phone: lead.phone || '', whatsapp: lead.whatsapp || '',
        destination: lead.destination || '', travel_date: lead.travel_date || '', return_date: lead.return_date || '',
        travelers_count: lead.travelers_count?.toString() || '', trip_type: lead.trip_type || '',
        package_type: lead.package_type || '', budget: lead.budget?.toString() || '',
        special_requests: lead.special_requests || '', hotel_name: lead.hotel_name || '',
        flight_details: lead.flight_details || '', package_cost: lead.package_cost?.toString() || '',
        advance_paid: lead.advance_paid?.toString() || '', balance_due: lead.balance_due?.toString() || '',
        booking_id: lead.booking_id || '', notes: lead.notes || '', status: lead.status,
        lead_source: lead.lead_source || '',
      });
      setReminderAt(lead.reminder_at ? new Date(lead.reminder_at) : null);
    }
  }, [lead, form]);

  const handleStatusChange = (newStatusValue: string) => {
    const newStatus = statuses?.find(s => s.value === newStatusValue);
    if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived')) {
      setPendingStatus(newStatus); setStatusReminderOpen(true);
    } else { form.setValue('status', newStatusValue); setReminderAt(null); }
  };

  const handleReminderConfirm = (date: Date | null) => {
    if (pendingStatus) { form.setValue('status', pendingStatus.value); setReminderAt(date); }
    setStatusReminderOpen(false); setPendingStatus(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!lead) return;
    setIsSubmitting(true);
    try {
      const { error } = await orgClient.from('leads_travel' as any).update({
        name: values.name, email: values.email || null, phone: values.phone || null,
        whatsapp: values.whatsapp || null, destination: values.destination || null,
        travel_date: values.travel_date || null, return_date: values.return_date || null,
        travelers_count: values.travelers_count ? parseInt(values.travelers_count) : null,
        trip_type: values.trip_type || null, package_type: values.package_type || null,
        budget: values.budget ? parseFloat(values.budget) : null,
        special_requests: values.special_requests || null, hotel_name: values.hotel_name || null,
        flight_details: values.flight_details || null,
        package_cost: values.package_cost ? parseFloat(values.package_cost) : null,
        advance_paid: values.advance_paid ? parseFloat(values.advance_paid) : null,
        balance_due: values.balance_due ? parseFloat(values.balance_due) : null,
        booking_id: values.booking_id || null,
        notes: values.notes || null, status: values.status, lead_source: values.lead_source || null,
        reminder_at: reminderAt ? reminderAt.toISOString() : null,
      }).eq('id', lead.id);
      if (error) throw error;
      toast.success('Lead updated successfully'); onSuccess(); onOpenChange(false);
    } catch { toast.error('Failed to update lead'); } finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Travel Lead</DialogTitle><DialogDescription>Update guest details.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Guest Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="whatsapp" render={({ field }) => (<FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="destination" render={({ field }) => (<FormItem><FormLabel>Destination</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="hotel_name" render={({ field }) => (<FormItem><FormLabel>Hotel</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="travel_date" render={({ field }) => (<FormItem><FormLabel>Travel Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="return_date" render={({ field }) => (<FormItem><FormLabel>Return Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="travelers_count" render={({ field }) => (<FormItem><FormLabel>Travelers</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="trip_type" render={({ field }) => (<FormItem><FormLabel>Trip Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{TRIP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="package_type" render={({ field }) => (<FormItem><FormLabel>Package</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{PACKAGE_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="budget" render={({ field }) => (<FormItem><FormLabel>Budget</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="package_cost" render={({ field }) => (<FormItem><FormLabel>Package Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="booking_id" render={({ field }) => (<FormItem><FormLabel>Booking ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="advance_paid" render={({ field }) => (<FormItem><FormLabel>Advance Paid</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="balance_due" render={({ field }) => (<FormItem><FormLabel>Balance Due</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="flight_details" render={({ field }) => (<FormItem><FormLabel>Flight Details</FormLabel><FormControl><Input placeholder="Flight info" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="special_requests" render={({ field }) => (<FormItem><FormLabel>Special Requests</FormLabel><FormControl><Textarea className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={handleStatusChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="lead_source" render={({ field }) => (<FormItem><FormLabel>Lead Source</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update Lead'}</Button>
          </form>
        </Form>
      </DialogContent>
      {pendingStatus && <StatusReminderDialog open={statusReminderOpen} onOpenChange={setStatusReminderOpen} status={pendingStatus} onConfirm={handleReminderConfirm} onCancel={() => { setStatusReminderOpen(false); setPendingStatus(null); }} />}
    </Dialog>
  );
}
