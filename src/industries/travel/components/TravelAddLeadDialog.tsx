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
import { TRIP_TYPES, PACKAGE_TYPES } from '../config';
import { useQueryClient } from '@tanstack/react-query';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
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
  notes: z.string().optional(),
  status: z.string(),
  lead_source: z.string().optional(),
});

interface TravelAddLeadDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function TravelAddLeadDialog({ open: controlledOpen, onOpenChange, trigger }: TravelAddLeadDialogProps = {}) {
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
      name: '', email: '', phone: '', whatsapp: '', destination: '',
      travel_date: '', return_date: '', travelers_count: '', trip_type: '',
      package_type: '', budget: '', special_requests: '', hotel_name: '',
      notes: '', status: 'new', lead_source: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !company) { toast.error('You must be logged in and part of a company'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await orgClient.from('leads_travel' as any).insert({
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        destination: values.destination || null,
        travel_date: values.travel_date || null,
        return_date: values.return_date || null,
        travelers_count: values.travelers_count ? parseInt(values.travelers_count) : null,
        trip_type: values.trip_type || null,
        package_type: values.package_type || null,
        budget: values.budget ? parseFloat(values.budget) : null,
        special_requests: values.special_requests || null,
        hotel_name: values.hotel_name || null,
        notes: values.notes || null,
        status: values.status,
        lead_source: values.lead_source || null,
        created_by_id: user.id,
        sales_owner_id: user.id,
        company_id: company.id,
      });
      if (error) throw error;
      toast.success('Lead added successfully');
      queryClient.invalidateQueries({ queryKey: ['travel-leads'] });
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
          <DialogTitle>Add New Travel Lead</DialogTitle>
          <DialogDescription>Enter guest details for your travel pipeline.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Guest Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john@email.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="destination" render={({ field }) => (
                <FormItem><FormLabel>Destination</FormLabel><FormControl><Input placeholder="Goa, Bali..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="travel_date" render={({ field }) => (
                <FormItem><FormLabel>Travel Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="return_date" render={({ field }) => (
                <FormItem><FormLabel>Return Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="travelers_count" render={({ field }) => (
                <FormItem><FormLabel>Travelers</FormLabel><FormControl><Input type="number" placeholder="2" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="trip_type" render={({ field }) => (
                <FormItem><FormLabel>Trip Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{TRIP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="package_type" render={({ field }) => (
                <FormItem><FormLabel>Package</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{PACKAGE_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="budget" render={({ field }) => (
                <FormItem><FormLabel>Budget (₹)</FormLabel><FormControl><Input type="number" placeholder="50000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="hotel_name" render={({ field }) => (
                <FormItem><FormLabel>Hotel</FormLabel><FormControl><Input placeholder="Hotel name" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="special_requests" render={({ field }) => (
              <FormItem><FormLabel>Special Requests</FormLabel><FormControl><Textarea placeholder="Any special requirements..." className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lead_source" render={({ field }) => (
                <FormItem><FormLabel>Lead Source</FormLabel><FormControl><Input placeholder="e.g., Website" {...field} /></FormControl><FormMessage /></FormItem>
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
