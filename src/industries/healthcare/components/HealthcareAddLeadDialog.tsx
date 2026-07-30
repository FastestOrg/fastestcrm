import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
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
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { Plus } from 'lucide-react';
import { HEALTHCARE_DEPARTMENTS, HEALTHCARE_GENDERS } from '../config';
import { useQueryClient } from '@tanstack/react-query';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
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
  insurance_provider: z.string().optional(),
  insurance_id: z.string().optional(),
  treatment_type: z.string().optional(),
  treatment_cost: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface HealthcareAddLeadDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function HealthcareAddLeadDialog({ open: controlledOpen, onOpenChange, trigger }: HealthcareAddLeadDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { company } = useCompany();
  const { statuses } = useLeadStatuses();
  const { orgClient } = useOrgClient();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', email: '', phone: '', whatsapp: '',
      age: '', gender: '', condition: '', symptoms: '',
      department: '', doctor_preference: '', appointment_date: '',
      appointment_time: '', insurance_provider: '', insurance_id: '',
      treatment_type: '', treatment_cost: '', notes: '',
      status: 'new_enquiry', lead_source: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !company) { toast.error('You must be logged in'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await orgClient.from('leads_healthcare' as any).insert({
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
        insurance_provider: values.insurance_provider || null,
        insurance_id: values.insurance_id || null,
        treatment_type: values.treatment_type || null,
        treatment_cost: values.treatment_cost ? parseFloat(values.treatment_cost) : null,
        notes: values.notes || null,
        status: values.status,
        lead_source: values.lead_source || null,
        created_by_id: user.id,
        sales_owner_id: user.id,
        company_id: company.id,
      });
      if (error) throw error;
      toast.success('Patient lead added');
      queryClient.invalidateQueries({ queryKey: ['healthcare-leads'] });
      setOpen(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Patient</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Patient Lead</DialogTitle>
          <DialogDescription>Enter patient details for your healthcare pipeline.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Patient Name *</FormLabel><FormControl><Input placeholder="Patient name" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="patient@email.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsapp" render={({ field }) => (
                <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input placeholder="WhatsApp number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="age" render={({ field }) => (
                <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>
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
                <FormItem><FormLabel>Condition/Concern</FormLabel><FormControl><Input placeholder="e.g., Back Pain" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="doctor_preference" render={({ field }) => (
                <FormItem><FormLabel>Doctor Preference</FormLabel><FormControl><Input placeholder="Dr. Smith" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="symptoms" render={({ field }) => (
              <FormItem><FormLabel>Symptoms</FormLabel><FormControl><Textarea placeholder="Describe symptoms..." className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="insurance_provider" render={({ field }) => (
                <FormItem><FormLabel>Insurance Provider</FormLabel><FormControl><Input placeholder="Insurance company" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="insurance_id" render={({ field }) => (
                <FormItem><FormLabel>Insurance ID</FormLabel><FormControl><Input placeholder="Policy number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lead_source" render={({ field }) => (
                <FormItem><FormLabel>Lead Source</FormLabel><FormControl><Input placeholder="e.g., Walk-in, Referral" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Add notes..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Patient Lead'}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
