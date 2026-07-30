import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { COMPANY_SIZES, PLAN_TYPES, DEAL_STAGES, LOSS_REASONS } from '../config';
import type { SaaSLead } from './SaaSLeadsTable';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';

const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  company_name: z.string().optional(),
  company_size: z.string().optional(),
  company_website: z.string().optional(),
  job_title: z.string().optional(),
  product_interest: z.string().optional(),
  use_case: z.string().optional(),
  current_solution: z.string().optional(),
  demo_date: z.string().optional(),
  trial_start_date: z.string().optional(),
  trial_end_date: z.string().optional(),
  plan_type: z.string().optional(),
  seats: z.string().optional(),
  monthly_value: z.string().optional(),
  annual_value: z.string().optional(),
  contract_length: z.string().optional(),
  deal_stage: z.string().optional(),
  decision_maker: z.string().optional(),
  champion: z.string().optional(),
  competitors: z.string().optional(),
  loss_reason: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface SaaSEditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: SaaSLead | null;
  onSuccess: () => void;
}

export function SaaSEditLeadDialog({ open, onOpenChange, lead, onSuccess }: SaaSEditLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { statuses } = useLeadStatuses();
  const { orgClient } = useOrgClient();
  const [statusReminderOpen, setStatusReminderOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CompanyLeadStatus | null>(null);
  const [reminderAt, setReminderAt] = useState<Date | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', email: '', phone: '', whatsapp: '',
      company_name: '', company_size: '', company_website: '',
      job_title: '', product_interest: '', use_case: '',
      current_solution: '', demo_date: '', trial_start_date: '',
      trial_end_date: '', plan_type: '', seats: '',
      monthly_value: '', annual_value: '', contract_length: '',
      deal_stage: '', decision_maker: '', champion: '',
      competitors: '', loss_reason: '', notes: '',
      status: 'new', lead_source: '',
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        whatsapp: lead.whatsapp || '',
        company_name: lead.company_name || '',
        company_size: lead.company_size || '',
        company_website: lead.company_website || '',
        job_title: lead.job_title || '',
        product_interest: lead.product_interest || '',
        use_case: lead.use_case || '',
        current_solution: lead.current_solution || '',
        demo_date: lead.demo_date ? new Date(lead.demo_date).toISOString().split('T')[0] : '',
        trial_start_date: lead.trial_start_date || '',
        trial_end_date: lead.trial_end_date || '',
        plan_type: lead.plan_type || '',
        seats: lead.seats?.toString() || '',
        monthly_value: lead.monthly_value?.toString() || '',
        annual_value: lead.annual_value?.toString() || '',
        contract_length: lead.contract_length?.toString() || '',
        deal_stage: lead.deal_stage || '',
        decision_maker: lead.decision_maker || '',
        champion: lead.champion || '',
        competitors: lead.competitors || '',
        loss_reason: lead.loss_reason || '',
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

  const handleReminderConfirm = (date: Date | null) => {
    if (pendingStatus) {
      form.setValue('status', pendingStatus.value);
      setReminderAt(date);
    }
    setStatusReminderOpen(false);
    setPendingStatus(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!lead) return;
    setIsSubmitting(true);
    try {
      const { error } = await orgClient
        .from('leads_saas' as any)
        .update({
          name: values.name,
          email: values.email || null,
          phone: values.phone || null,
          whatsapp: values.whatsapp || null,
          company_name: values.company_name || null,
          company_size: values.company_size || null,
          company_website: values.company_website || null,
          job_title: values.job_title || null,
          product_interest: values.product_interest || null,
          use_case: values.use_case || null,
          current_solution: values.current_solution || null,
          demo_date: values.demo_date || null,
          trial_start_date: values.trial_start_date || null,
          trial_end_date: values.trial_end_date || null,
          plan_type: values.plan_type || null,
          seats: values.seats ? parseInt(values.seats) : null,
          monthly_value: values.monthly_value ? parseFloat(values.monthly_value) : null,
          annual_value: values.annual_value ? parseFloat(values.annual_value) : null,
          contract_length: values.contract_length ? parseInt(values.contract_length) : null,
          deal_stage: values.deal_stage || null,
          decision_maker: values.decision_maker || null,
          champion: values.champion || null,
          competitors: values.competitors || null,
          loss_reason: values.loss_reason || null,
          notes: values.notes || null,
          status: values.status,
          lead_source: values.lead_source || null,
          reminder_at: reminderAt ? reminderAt.toISOString() : null,
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
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit SaaS Lead</DialogTitle>
          <DialogDescription>Update prospect details.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsapp" render={({ field }) => (
                <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Company Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="company_name" render={({ field }) => (
                <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="company_size" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Size</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="company_website" render={({ field }) => (
                <FormItem><FormLabel>Website</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="job_title" render={({ field }) => (
                <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Product & Deal */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="product_interest" render={({ field }) => (
                <FormItem><FormLabel>Product Interest</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="current_solution" render={({ field }) => (
                <FormItem><FormLabel>Current Solution</FormLabel><FormControl><Input placeholder="Competitor" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="use_case" render={({ field }) => (
              <FormItem><FormLabel>Use Case</FormLabel><FormControl><Textarea className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            {/* Deal Intelligence */}
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="deal_stage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Stage</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger></FormControl>
                    <SelectContent>{DEAL_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="decision_maker" render={({ field }) => (
                <FormItem><FormLabel>Decision Maker</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="champion" render={({ field }) => (
                <FormItem><FormLabel>Champion</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="demo_date" render={({ field }) => (
                <FormItem><FormLabel>Demo Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="trial_start_date" render={({ field }) => (
                <FormItem><FormLabel>Trial Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="trial_end_date" render={({ field }) => (
                <FormItem><FormLabel>Trial End</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Subscription */}
            <div className="grid grid-cols-4 gap-4">
              <FormField control={form.control} name="plan_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger></FormControl>
                    <SelectContent>{PLAN_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="seats" render={({ field }) => (
                <FormItem><FormLabel>Seats</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="monthly_value" render={({ field }) => (
                <FormItem><FormLabel>MRR (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contract_length" render={({ field }) => (
                <FormItem><FormLabel>Contract (mo)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Status & Meta */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lead_source" render={({ field }) => (
                <FormItem><FormLabel>Lead Source</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={handleStatusChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {statuses.map(s => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="competitors" render={({ field }) => (
                <FormItem><FormLabel>Competitors</FormLabel><FormControl><Input placeholder="Competing vendors" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="loss_reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Loss Reason</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger></FormControl>
                    <SelectContent>{LOSS_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

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
          onCancel={() => { setStatusReminderOpen(false); setPendingStatus(null); }}
        />
      )}
    </Dialog>
  );
}
