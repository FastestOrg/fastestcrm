import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Quotation, QuotationItem } from './useQuotations';
import { Invoice, InvoiceItem } from './useInvoices';

export type PublicDocumentData = {
  type: 'quotation' | 'invoice';
  document: Quotation | Invoice;
  items: (QuotationItem | InvoiceItem)[];
  company: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    gstin: string | null;
  };
};

export function usePublicDocument(type: 'quotation' | 'invoice', id: string | undefined) {
  return useQuery({
    queryKey: ['public-document', type, id],
    queryFn: async (): Promise<PublicDocumentData | null> => {
      if (!id) return null;

      // 1. Fetch document and items
      const table = type === 'quotation' ? 'quotations' : 'invoices';
      const itemTable = type === 'quotation' ? 'quotation_items' : 'invoice_items';
      const idField = type === 'quotation' ? 'quotation_id' : 'invoice_id';

      // Attempt public fetch. Note: This requires RLS to be configured or an edge function.
      // For now, we'll use direct DB query and suggest the user to open RLS.
      const { data: document, error: docError } = await supabase
        .from(table as any)
        .select('*')
        .eq('id', id)
        .single();

      if (docError) throw docError;

      const { data: items, error: itemError } = await supabase
        .from(itemTable as any)
        .select('*')
        .eq(idField, id)
        .order('sort_order');

      if (itemError) throw itemError;

      // 2. Fetch company settings for branding
      const { data: settings } = await supabase
        .from('invoice_settings' as any)
        .select('*')
        .eq('company_id', (document as any).company_id)
        .maybeSingle();

      // 3. Fetch default template if exists
      const { data: defaultTemplate } = await supabase
        .from('invoice_templates' as any)
        .select('*')
        .eq('company_id', (document as any).company_id)
        .eq('is_default', true)
        .maybeSingle();

      // 4. Fetch the company profile from companies table
      const { data: companyInfo } = await supabase
        .from('companies' as any)
        .select('name, logo_url, primary_color')
        .eq('id', (document as any).company_id)
        .maybeSingle();

      return {
        type,
        document: document as any,
        items: (items || []) as any,
        company: {
          name: settings?.business_name || companyInfo?.name || 'FastestCRM',
          logo_url: settings?.business_logo_url || companyInfo?.logo_url || null,
          primary_color: defaultTemplate?.color_scheme?.primary || companyInfo?.primary_color || '#3b82f6',
          address: settings?.business_address || null,
          email: settings?.business_email || null,
          phone: settings?.business_phone || null,
          gstin: settings?.business_gstin || null,
          pan: settings?.business_pan || null,
          bank_name: settings?.bank_details?.bank || '',
          account_number: settings?.bank_details?.account || '',
          ifsc_code: settings?.bank_details?.ifsc || '',
          upi_id: settings?.bank_details?.upi || '',
          show_bank_details: defaultTemplate?.show_bank_details ?? true,
          show_logo: defaultTemplate?.show_logo ?? true,
        }
      };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
