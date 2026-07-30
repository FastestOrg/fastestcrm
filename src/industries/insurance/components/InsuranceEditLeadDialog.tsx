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
import { INSURANCE_TYPES, CONTRIBUTION_FREQUENCIES, GENDERS, NOMINEE_RELATIONS, LOSS_REASONS } from '../config';
import type { InsuranceLead } from './InsuranceLeadsTable';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';

const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  pan_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  occupation: z.string().optional(),
  annual_income: z.string().optional(),
  insurance_type: z.string().optional(),
  plan_name: z.string().optional(),
  sum_insured: z.string().optional(),
  premium_amount: z.string().optional(),
  contribution_frequency: z.string().optional(),
  policy_term: z.string().optional(),
  existing_policies: z.string().optional(),
  nominee_name: z.string().optional(),
  nominee_relation: z.string().optional(),
  agent_name: z.string().optional(),
  policy_number: z.string().optional(),
  policy_start_date: z.string().optional(),
  renewal_date: z.string().optional(),
  loss_reason: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: InsuranceLead | null;
  onSuccess: () => void;
}

export function InsuranceEditLeadDialog({ open, onOpenChange, lead, onSuccess }: Props) {
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
        age: lead.age?.toString() || '', gender: lead.gender || '', pan_number: lead.pan_number || '',
        date_of_birth: lead.date_of_birth || '', occupation: lead.occupation || '',
        annual_income: lead.annual_income?.toString() || '', insurance_type: lead.insurance_type || '',
        plan_name: lead.plan_name || '', sum_insured: lead.sum_insured?.toString() || '',
        premium_amount: lead.premium_amount?.toString() || '', contribution_frequency: lead.contribution_frequency || '',
        policy_term: lead.policy_term?.toString() || '', existing_policies: lead.existing_policies || '',
        nominee_name: lead.nominee_name || '', nominee_relation: lead.nominee_relation || '',
        agent_name: lead.agent_name || '', policy_number: lead.policy_number || '',
        policy_start_date: lead.policy_start_date || '', renewal_date: lead.renewal_date || '',
        loss_reason: lead.loss_reason || '', notes: lead.notes || '', status: lead.status,
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
      const { error } = await orgClient.from('leads_insurance' as any).update({
        name: values.name, email: values.email || null, phone: values.phone || null,
        whatsapp: values.whatsapp || null, age: values.age ? parseInt(values.age) : null,
        gender: values.gender || null, pan_number: values.pan_number || null,
        date_of_birth: values.date_of_birth || null, occupation: values.occupation || null,
        annual_income: values.annual_income ? parseFloat(values.annual_income) : null,
        insurance_type: values.insurance_type || null, plan_name: values.plan_name || null,
        sum_insured: values.sum_insured ? parseFloat(values.sum_insured) : null,
        premium_amount: values.premium_amount ? parseFloat(values.premium_amount) : null,
        contribution_frequency: values.contribution_frequency || null,
        policy_term: values.policy_term ? parseInt(values.policy_term) : null,
        existing_policies: values.existing_policies || null, nominee_name: values.nominee_name || null,
        nominee_relation: values.nominee_relation || null, agent_name: values.agent_name || null,
        policy_number: values.policy_number || null, policy_start_date: values.policy_start_date || null,
        renewal_date: values.renewal_date || null, loss_reason: values.loss_reason || null,
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
        <DialogHeader><DialogTitle>Edit Insurance Lead</DialogTitle><DialogDescription>Update lead details.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="whatsapp" render={({ field }) => (<FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="pan_number" render={({ field }) => (<FormItem><FormLabel>PAN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="date_of_birth" render={({ field }) => (<FormItem><FormLabel>DOB</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="occupation" render={({ field }) => (<FormItem><FormLabel>Occupation</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="annual_income" render={({ field }) => (<FormItem><FormLabel>Annual Income</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="insurance_type" render={({ field }) => (<FormItem><FormLabel>Insurance Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="plan_name" render={({ field }) => (<FormItem><FormLabel>Plan Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <FormField control={form.control} name="sum_insured" render={({ field }) => (<FormItem><FormLabel>Sum Insured</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="premium_amount" render={({ field }) => (<FormItem><FormLabel>Premium</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contribution_frequency" render={({ field }) => (<FormItem><FormLabel>Frequency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Freq" /></SelectTrigger></FormControl><SelectContent>{CONTRIBUTION_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="policy_term" render={({ field }) => (<FormItem><FormLabel>Term (Yr)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nominee_name" render={({ field }) => (<FormItem><FormLabel>Nominee</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="nominee_relation" render={({ field }) => (<FormItem><FormLabel>Relation</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{NOMINEE_RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="agent_name" render={({ field }) => (<FormItem><FormLabel>Agent</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="policy_number" render={({ field }) => (<FormItem><FormLabel>Policy #</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="existing_policies" render={({ field }) => (<FormItem><FormLabel>Existing Policies</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="policy_start_date" render={({ field }) => (<FormItem><FormLabel>Policy Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="renewal_date" render={({ field }) => (<FormItem><FormLabel>Renewal Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={handleStatusChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="loss_reason" render={({ field }) => (<FormItem><FormLabel>Loss Reason</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{LOSS_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
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
