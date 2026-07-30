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
import { HEALTHCARE_DEPARTMENTS, HEALTHCARE_GENDERS } from '../config';
import type { HealthcareLead } from './HealthcareLeadsTable';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';

const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  condition: z.string().optional(),
  symptoms: z.string().optional(),
  department: z.string().optional(),
  doctor_preference: z.string().optional(),
  appointment_date: z.string().optional(),
  appointment_time: z.string().optional(),
  referral_source: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_id: z.string().optional(),
  treatment_type: z.string().optional(),
  treatment_cost: z.string().optional(),
  treatment_date: z.string().optional(),
  follow_up_date: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface HealthcareEditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: HealthcareLead | null;
  onSuccess: () => void;
}

export function HealthcareEditLeadDialog({ open, onOpenChange, lead, onSuccess }: HealthcareEditLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { statuses } = useLeadStatuses();
  const { orgClient } = useOrgClient();
  const [statusReminderOpen, setStatusReminderOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CompanyLeadStatus | null>(null);
  const [reminderAt, setReminderAt] = useState<Date | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', email: '', phone: '', whatsapp: '', age: '', gender: '',
      condition: '', symptoms: '', department: '', doctor_preference: '',
      appointment_date: '', appointment_time: '', referral_source: '',
      insurance_provider: '', insurance_id: '', treatment_type: '',
      treatment_cost: '', treatment_date: '', follow_up_date: '',
      notes: '', status: 'new_enquiry', lead_source: '',
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        whatsapp: lead.whatsapp || '',
        age: lead.age?.toString() || '',
        gender: lead.gender || '',
        condition: lead.condition || '',
        symptoms: lead.symptoms || '',
        department: lead.department || '',
        doctor_preference: lead.doctor_preference || '',
        appointment_date: lead.appointment_date ? new Date(lead.appointment_date).toISOString().split('T')[0] : '',
        appointment_time: lead.appointment_time || '',
        referral_source: lead.referral_source || '',
        insurance_provider: lead.insurance_provider || '',
        insurance_id: lead.insurance_id || '',
        treatment_type: lead.treatment_type || '',
        treatment_cost: lead.treatment_cost?.toString() || '',
        treatment_date: lead.treatment_date || '',
        follow_up_date: lead.follow_up_date || '',
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
      const { error } = await orgClient.from('leads_healthcare' as any).update({
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        age: values.age ? parseInt(values.age) : null,
        gender: values.gender || null,
        condition: values.condition || null,
        symptoms: values.symptoms || null,
        department: values.department || null,
        doctor_preference: values.doctor_preference || null,
        appointment_date: values.appointment_date || null,
        appointment_time: values.appointment_time || null,
        referral_source: values.referral_source || null,
        insurance_provider: values.insurance_provider || null,
        insurance_id: values.insurance_id || null,
        treatment_type: values.treatment_type || null,
        treatment_cost: values.treatment_cost ? parseFloat(values.treatment_cost) : null,
        treatment_date: values.treatment_date || null,
        follow_up_date: values.follow_up_date || null,
        notes: values.notes || null,
        status: values.status,
        lead_source: values.lead_source || null,
        reminder_at: reminderAt ? reminderAt.toISOString() : null,
      }).eq('id', lead.id);
      if (error) throw error;
      toast.success('Lead updated');
      onSuccess();
      onOpenChange(false);
    } catch { toast.error('Failed to update'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Healthcare Lead</DialogTitle>
          <DialogDescription>Update patient details.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="age" render={({ field }) => (
                <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem><FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{HEALTHCARE_GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{HEALTHCARE_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="condition" render={({ field }) => (
                <FormItem><FormLabel>Condition</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="doctor_preference" render={({ field }) => (
                <FormItem><FormLabel>Doctor Preference</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="symptoms" render={({ field }) => (
              <FormItem><FormLabel>Symptoms</FormLabel><FormControl><Textarea className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="appointment_date" render={({ field }) => (
                <FormItem><FormLabel>Appointment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="appointment_time" render={({ field }) => (
                <FormItem><FormLabel>Appointment Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="insurance_provider" render={({ field }) => (
                <FormItem><FormLabel>Insurance Provider</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="insurance_id" render={({ field }) => (
                <FormItem><FormLabel>Insurance ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="treatment_type" render={({ field }) => (
                <FormItem><FormLabel>Treatment Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="treatment_cost" render={({ field }) => (
                <FormItem><FormLabel>Treatment Cost (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="treatment_date" render={({ field }) => (
                <FormItem><FormLabel>Treatment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="follow_up_date" render={({ field }) => (
                <FormItem><FormLabel>Follow-up Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="referral_source" render={({ field }) => (
                <FormItem><FormLabel>Referral Source</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lead_source" render={({ field }) => (
                <FormItem><FormLabel>Lead Source</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={handleStatusChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update Lead'}</Button>
          </form>
        </Form>
      </DialogContent>
      {pendingStatus && (
        <StatusReminderDialog open={statusReminderOpen} onOpenChange={setStatusReminderOpen} status={pendingStatus}
          onConfirm={handleReminderConfirm} onCancel={() => { setStatusReminderOpen(false); setPendingStatus(null); }} />
      )}
    </Dialog>
  );
}
