import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface QuotationItem {
  id?: string;
  quotation_id?: string;
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

export interface Quotation {
  id: string;
  company_id: string;
  created_by: string;
  lead_id: string | null;
  lead_table: string | null;
  quotation_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
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
  currency: string;
  notes: string | null;
  terms_and_conditions: string | null;
  valid_until: string | null;
  template_id: string | null;
  converted_to_invoice_id: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
  items?: QuotationItem[];
  creator_name?: string;
}

export interface QuotationInput {
  lead_id?: string | null;
  lead_table?: string | null;
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
  currency?: string;
  notes?: string | null;
  terms_and_conditions?: string | null;
  valid_until?: string | null;
  template_id?: string | null;
  status?: string;
  items: QuotationItem[];
}

// ─── Quotations Hook ────────────────────────────────────────────────────────
export function useQuotations() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { company } = useCompany();
  const { user } = useAuth();
  const companyId = company?.id;

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations', companyId],
    queryFn: async (): Promise<Quotation[]> => {
      const { data, error } = await supabase
        .from('quotations' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!companyId,
  });

  const generateNumber = async (): Promise<string> => {
    // Get settings or use defaults
    const { data: settings } = await supabase
      .from('invoice_settings' as any)
      .select('quotation_prefix, next_quotation_number')
      .eq('company_id', companyId!)
      .maybeSingle();

    const prefix = (settings as any)?.quotation_prefix || 'QUO-';
    const nextNum = (settings as any)?.next_quotation_number || 1;
    const number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    // Increment
    await supabase
      .from('invoice_settings' as any)
      .upsert({
        company_id: companyId!,
        next_quotation_number: nextNum + 1,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'company_id' });

    return number;
  };

  const createQuotation = useMutation({
    mutationFn: async (input: QuotationInput) => {
      const quotationNumber = await generateNumber();
      const { items, ...quotationData } = input;

      const { data: quo, error: quoErr } = await supabase
        .from('quotations' as any)
        .insert({
          ...quotationData,
          company_id: companyId!,
          created_by: user!.id,
          quotation_number: quotationNumber,
          currency: input.currency || company?.default_currency || 'INR',
        } as any)
        .select()
        .single();

      if (quoErr) throw quoErr;

      if (items.length > 0) {
        const itemRows = items.map((item, i) => ({
          ...item,
          quotation_id: (quo as any).id,
          sort_order: i,
          id: undefined,
        }));
        const { error: itemErr } = await supabase
          .from('quotation_items' as any)
          .insert(itemRows as any);
        if (itemErr) throw itemErr;
      }

      return quo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Created', description: 'Quotation created successfully.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateQuotation = useMutation({
    mutationFn: async ({ id, ...input }: QuotationInput & { id: string }) => {
      const { items, ...quotationData } = input;

      const { error: quoErr } = await supabase
        .from('quotations' as any)
        .update({ ...quotationData, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (quoErr) throw quoErr;

      // Replace items: delete all then re-insert
      await supabase.from('quotation_items' as any).delete().eq('quotation_id', id);
      if (items.length > 0) {
        const itemRows = items.map((item, i) => ({
          ...item,
          quotation_id: id,
          sort_order: i,
          id: undefined,
        }));
        const { error: itemErr } = await supabase
          .from('quotation_items' as any)
          .insert(itemRows as any);
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Updated', description: 'Quotation updated successfully.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteQuotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotations' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Deleted', description: 'Quotation deleted.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'sent') updates.issued_at = new Date().toISOString();
      const { error } = await supabase.from('quotations' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: 'Updated', description: 'Status updated.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const fetchQuotationWithItems = async (id: string): Promise<Quotation & { items: QuotationItem[] }> => {
    const { data: quo, error: quoErr } = await supabase
      .from('quotations' as any)
      .select('*')
      .eq('id', id)
      .single();
    if (quoErr) throw quoErr;

    const { data: items, error: itemErr } = await supabase
      .from('quotation_items' as any)
      .select('*')
      .eq('quotation_id', id)
      .order('sort_order');
    if (itemErr) throw itemErr;

    return { ...(quo as any), items: (items || []) as any };
  };

  return {
    quotations,
    isLoading,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    updateStatus,
    fetchQuotationWithItems,
  };
}
