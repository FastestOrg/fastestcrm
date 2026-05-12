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
      const { data: settings, error: settingsError } = await supabase
        .from('invoice_settings' as any)
        .select('*')
        .eq('company_id', (document as any).company_id)
        .single();

      // If settings not found, we fetch the company name from companies table
      let companyData: any = settings || {};
      
      if (settingsError || !settings) {
        const { data: company } = await supabase
          .from('companies' as any)
          .select('name, logo_url, primary_color')
          .eq('id', (document as any).company_id)
          .single();
        
        companyData = {
            ...companyData,
            business_name: company?.name,
            business_logo_url: company?.logo_url,
            primary_color: company?.primary_color
        };
      }

      return {
        type,
        document: document as any,
        items: (items || []) as any,
        company: {
          name: companyData.business_name || 'FastestCRM',
          logo_url: companyData.business_logo_url,
          primary_color: companyData.primary_color || '#3b82f6',
          address: companyData.business_address,
          email: companyData.business_email,
          phone: companyData.business_phone,
          gstin: companyData.business_gstin,
        }
      };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
