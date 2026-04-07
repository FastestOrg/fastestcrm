import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface InvoiceSettings {
  company_id: string;
  business_name: string | null;
  business_address: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_gstin: string | null;
  business_pan: string | null;
  business_logo_url: string | null;
  invoice_prefix: string;
  quotation_prefix: string;
  next_invoice_number: number;
  next_quotation_number: number;
  default_currency: string;
  default_payment_terms: string | null;
  default_notes: string | null;
  bank_details: { bank?: string; account?: string; ifsc?: string; upi?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceTax {
  id: string;
  company_id: string;
  name: string;
  rate: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceTemplate {
  id: string;
  company_id: string;
  name: string;
  template_type: 'quotation' | 'invoice' | 'both';
  header_html: string | null;
  footer_html: string | null;
  color_scheme: { primary: string; accent: string; text: string };
  show_logo: boolean;
  show_bank_details: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Settings Hook ──────────────────────────────────────────────────────────
export function useInvoiceSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { company } = useCompany();
  const companyId = company?.id;

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['invoice-settings', companyId],
    queryFn: async (): Promise<InvoiceSettings | null> => {
      const { data, error } = await supabase
        .from('invoice_settings' as any)
        .select('*')
        .eq('company_id', companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!companyId,
  });

  const upsertSettings = useMutation({
    mutationFn: async (updates: Partial<InvoiceSettings>) => {
      const { data, error } = await supabase
        .from('invoice_settings' as any)
        .upsert({ company_id: companyId!, ...updates, updated_at: new Date().toISOString() } as any, { onConflict: 'company_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-settings'] });
      toast({ title: 'Saved', description: 'Invoice settings updated.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return { settings, settingsLoading, upsertSettings };
}

// ─── Taxes Hook ─────────────────────────────────────────────────────────────
export function useInvoiceTaxes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { company } = useCompany();
  const companyId = company?.id;

  const { data: taxes = [], isLoading: taxesLoading } = useQuery({
    queryKey: ['invoice-taxes', companyId],
    queryFn: async (): Promise<InvoiceTax[]> => {
      const { data, error } = await supabase
        .from('invoice_taxes' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('name');
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!companyId,
  });

  const createTax = useMutation({
    mutationFn: async (tax: Partial<InvoiceTax>) => {
      const { data, error } = await supabase
        .from('invoice_taxes' as any)
        .insert({ ...tax, company_id: companyId! } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-taxes'] });
      toast({ title: 'Created', description: 'Tax created.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateTax = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceTax> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoice_taxes' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-taxes'] });
      toast({ title: 'Updated', description: 'Tax updated.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTax = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_taxes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-taxes'] });
      toast({ title: 'Deleted', description: 'Tax deleted.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return { taxes, taxesLoading, createTax, updateTax, deleteTax };
}

// ─── Templates Hook ─────────────────────────────────────────────────────────
export function useInvoiceTemplates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { company } = useCompany();
  const companyId = company?.id;

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['invoice-templates', companyId],
    queryFn: async (): Promise<InvoiceTemplate[]> => {
      const { data, error } = await supabase
        .from('invoice_templates' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('name');
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!companyId,
  });

  const createTemplate = useMutation({
    mutationFn: async (tpl: Partial<InvoiceTemplate>) => {
      const { data, error } = await supabase
        .from('invoice_templates' as any)
        .insert({ ...tpl, company_id: companyId! } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast({ title: 'Created', description: 'Template created.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoice_templates' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast({ title: 'Updated', description: 'Template updated.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast({ title: 'Deleted', description: 'Template deleted.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return { templates, templatesLoading, createTemplate, updateTemplate, deleteTemplate };
}
