import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id: string | null;
  description: string;
  hsn_sac_code: string | null;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  tax_ids: string[];
  tax_amount: number;
  line_total: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  company_id: string;
  created_by: string;
  lead_id: string | null;
  lead_table: string | null;
  quotation_id: string | null;
  invoice_number: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_gstin: string | null;
  subject: string | null;
  subtotal: number;
  discount_type: 'flat' | 'percentage' | null;
  discount_value: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  notes: string | null;
  terms_and_conditions: string | null;
  payment_terms: string | null;
  due_date: string | null;
  template_id: string | null;
  payment_link: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  company_id: string;
  amount: number;
  payment_method: string | null;
  payment_reference: string | null;
  razorpay_payment_id: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

export interface InvoiceInput {
  lead_id?: string | null;
  lead_table?: string | null;
  quotation_id?: string | null;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  client_gstin?: string | null;
  subject?: string | null;
  subtotal: number;
  discount_type?: 'flat' | 'percentage' | null;
  discount_value?: number;
  discount_amount?: number;
  tax_amount?: number;
  total: number;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  notes?: string | null;
  terms_and_conditions?: string | null;
  payment_terms?: string | null;
  due_date?: string | null;
  template_id?: string | null;
  payment_link?: string | null;
  status?: string;
  items: InvoiceItem[];
}

// ─── Invoices Hook ──────────────────────────────────────────────────────────
export function useInvoices() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { company } = useCompany();
  const { user } = useAuth();
  const companyId = company?.id;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from('invoices' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!companyId,
  });

  const generateNumber = async (): Promise<string> => {
    const { data: settings } = await supabase
      .from('invoice_settings' as any)
      .select('invoice_prefix, next_invoice_number')
      .eq('company_id', companyId!)
      .maybeSingle();

    const prefix = (settings as any)?.invoice_prefix || 'INV-';
    const nextNum = (settings as any)?.next_invoice_number || 1;
    const number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    await supabase
      .from('invoice_settings' as any)
      .upsert({
        company_id: companyId!,
        next_invoice_number: nextNum + 1,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'company_id' });

    return number;
  };

  const createInvoice = useMutation({
    mutationFn: async (input: InvoiceInput) => {
      const invoiceNumber = await generateNumber();
      const { items, ...invoiceData } = input;

      const { data: inv, error: invErr } = await supabase
        .from('invoices' as any)
        .insert({
          ...invoiceData,
          company_id: companyId!,
          created_by: user!.id,
          invoice_number: invoiceNumber,
          currency: input.currency || company?.default_currency || 'INR',
          amount_due: (input.total || 0) - (input.amount_paid || 0),
        } as any)
        .select()
        .single();

      if (invErr) throw invErr;

      if (items.length > 0) {
        const itemRows = items.map((item, i) => ({
          ...item,
          invoice_id: (inv as any).id,
          sort_order: i,
          id: undefined,
        }));
        const { error: itemErr } = await supabase
          .from('invoice_items' as any)
          .insert(itemRows as any);
        if (itemErr) throw itemErr;
      }

      // If created from a quotation, mark the quotation as converted
      if (input.quotation_id) {
        await supabase
          .from('quotations' as any)
          .update({
            status: 'converted',
            converted_to_invoice_id: (inv as any).id,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', input.quotation_id);
      }

      return inv;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Created', description: 'Invoice created successfully.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...input }: InvoiceInput & { id: string }) => {
      const { items, ...invoiceData } = input;

      const { error: invErr } = await supabase
        .from('invoices' as any)
        .update({
          ...invoiceData,
          amount_due: (invoiceData.total || 0) - (invoiceData.amount_paid || 0),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (invErr) throw invErr;

      // Replace items
      await supabase.from('invoice_items' as any).delete().eq('invoice_id', id);
      if (items.length > 0) {
        const itemRows = items.map((item, i) => ({
          ...item,
          invoice_id: id,
          sort_order: i,
          id: undefined,
        }));
        const { error: itemErr } = await supabase
          .from('invoice_items' as any)
          .insert(itemRows as any);
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Updated', description: 'Invoice updated successfully.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Deleted', description: 'Invoice deleted.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const recordPayment = useMutation({
    mutationFn: async ({ invoice_id, amount, payment_method, payment_reference, notes }: {
      invoice_id: string;
      amount: number;
      payment_method?: string;
      payment_reference?: string;
      notes?: string;
    }) => {
      // Insert payment record
      const { error: payErr } = await supabase
        .from('invoice_payments' as any)
        .insert({
          invoice_id,
          company_id: companyId!,
          amount,
          payment_method,
          payment_reference,
          notes,
          paid_at: new Date().toISOString(),
        } as any);
      if (payErr) throw payErr;

      // Get current invoice
      const { data: inv } = await supabase
        .from('invoices' as any)
        .select('total, amount_paid')
        .eq('id', invoice_id)
        .single();

      const newPaid = ((inv as any)?.amount_paid || 0) + amount;
      const total = (inv as any)?.total || 0;
      const newDue = total - newPaid;
      const newStatus = newDue <= 0 ? 'paid' : 'partially_paid';

      const updates: any = {
        amount_paid: newPaid,
        amount_due: Math.max(0, newDue),
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'paid') updates.paid_at = new Date().toISOString();

      const { error: updErr } = await supabase
        .from('invoices' as any)
        .update(updates)
        .eq('id', invoice_id);
      if (updErr) throw updErr;

      // Auto-decrement product inventory
      const { data: invItems } = await supabase
        .from('invoice_items' as any)
        .select('product_id, quantity')
        .eq('invoice_id', invoice_id);

      if (newStatus === 'paid' && invItems) {
        for (const item of invItems as any[]) {
          if (item.product_id) {
            const { data: prod } = await supabase
              .from('products')
              .select('quantity_available')
              .eq('id', item.product_id)
              .single();

            if (prod && prod.quantity_available !== null) {
              await supabase
                .from('products')
                .update({
                  quantity_available: Math.max(0, (prod.quantity_available || 0) - item.quantity),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.product_id);
            }
          }
        }
        qc.invalidateQueries({ queryKey: ['products'] });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-payments'] });
      toast({ title: 'Payment Recorded', description: 'Payment has been recorded successfully.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const fetchInvoiceWithItems = async (id: string): Promise<Invoice & { items: InvoiceItem[] }> => {
    const { data: inv, error: invErr } = await supabase
      .from('invoices' as any)
      .select('*')
      .eq('id', id)
      .single();
    if (invErr) throw invErr;

    const { data: items, error: itemErr } = await supabase
      .from('invoice_items' as any)
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order');
    if (itemErr) throw itemErr;

    return { ...(inv as any), items: (items || []) as any };
  };

  const fetchPayments = async (invoiceId: string): Promise<InvoicePayment[]> => {
    const { data, error } = await supabase
      .from('invoice_payments' as any)
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false });
    if (error) throw error;
    return (data || []) as any;
  };

  return {
    invoices,
    isLoading,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
    fetchInvoiceWithItems,
    fetchPayments,
  };
}
