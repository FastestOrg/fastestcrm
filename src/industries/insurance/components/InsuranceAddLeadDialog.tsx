import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { Plus } from 'lucide-react';
import { INSURANCE_TYPES, CONTRIBUTION_FREQUENCIES, GENDERS, NOMINEE_RELATIONS } from '../config';
import { useQueryClient } from '@tanstack/react-query';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
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
  nominee_name: z.string().optional(),
  nominee_relation: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface InsuranceAddLeadDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function InsuranceAddLeadDialog({ open: controlledOpen, onOpenChange, trigger }: InsuranceAddLeadDialogProps = {}) {
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
      name: '', email: '', phone: '', whatsapp: '', age: '', gender: '',
      pan_number: '', date_of_birth: '', occupation: '', annual_income: '',
      insurance_type: '', plan_name: '', sum_insured: '', premium_amount: '',
      contribution_frequency: '', policy_term: '', nominee_name: '', nominee_relation: '',
      notes: '', status: 'new', lead_source: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !company) { toast.error('You must be logged in and part of a company'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await orgClient.from('leads_insurance' as any).insert({
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        age: values.age ? parseInt(values.age) : null,
        gender: values.gender || null,
        pan_number: values.pan_number || null,
        date_of_birth: values.date_of_birth || null,
        occupation: values.occupation || null,
        annual_income: values.annual_income ? parseFloat(values.annual_income) : null,
        insurance_type: values.insurance_type || null,
        plan_name: values.plan_name || null,
        sum_insured: values.sum_insured ? parseFloat(values.sum_insured) : null,
        premium_amount: values.premium_amount ? parseFloat(values.premium_amount) : null,
        contribution_frequency: values.contribution_frequency || null,
        policy_term: values.policy_term ? parseInt(values.policy_term) : null,
        nominee_name: values.nominee_name || null,
        nominee_relation: values.nominee_relation || null,
        notes: values.notes || null,
        status: values.status,
        lead_source: values.lead_source || null,
        created_by_id: user.id,
        sales_owner_id: user.id,
        company_id: company.id,
      });
      if (error) throw error;
      toast.success('Lead added successfully');
      queryClient.invalidateQueries({ queryKey: ['insurance-leads'] });
      setOpen(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add lead');
    } finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>) : (
        <DialogTrigger asChild><Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Lead</Button></DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Insurance Lead</DialogTitle>
          <DialogDescription>Enter prospect details for your insurance pipeline.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Personal Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john@email.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="age" render={({ field }) => (
                <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" placeholder="35" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem><FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="pan_number" render={({ field }) => (
                <FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input placeholder="ABCDE1234F" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="occupation" render={({ field }) => (
                <FormItem><FormLabel>Occupation</FormLabel><FormControl><Input placeholder="Software Engineer" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="annual_income" render={({ field }) => (
                <FormItem><FormLabel>Annual Income (₹)</FormLabel><FormControl><Input type="number" placeholder="1200000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Insurance Details */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="insurance_type" render={({ field }) => (
                <FormItem><FormLabel>Insurance Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="plan_name" render={({ field }) => (
                <FormItem><FormLabel>Plan Name</FormLabel><FormControl><Input placeholder="Term Plan 1Cr" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="premium_amount" render={({ field }) => (
                <FormItem><FormLabel>Premium (₹)</FormLabel><FormControl><Input type="number" placeholder="15000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contribution_frequency" render={({ field }) => (
                <FormItem><FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{CONTRIBUTION_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="policy_term" render={({ field }) => (
                <FormItem><FormLabel>Term (Years)</FormLabel><FormControl><Input type="number" placeholder="20" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Nominee */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nominee_name" render={({ field }) => (
                <FormItem><FormLabel>Nominee Name</FormLabel><FormControl><Input placeholder="Nominee" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nominee_relation" render={({ field }) => (
                <FormItem><FormLabel>Nominee Relation</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Relation" /></SelectTrigger></FormControl>
                    <SelectContent>{NOMINEE_RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lead_source" render={({ field }) => (
                <FormItem><FormLabel>Lead Source</FormLabel><FormControl><Input placeholder="e.g., Referral" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Add any notes..." className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Lead'}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
