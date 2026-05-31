import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves the dynamic lead table name for a given company.
 * Used in non-hook files (services, background tasks, etc.)
 */
export async function getLeadsTableName(companyId: string): Promise<string> {
  if (!companyId) return 'leads';
  
  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('custom_leads_table, industry')
      .eq('id', companyId)
      .single();

    if (error || !company) {
      console.warn('[getLeadsTableName] Failed to fetch company metadata, defaulting to leads:', error);
      return 'leads';
    }

    let tableName = company.custom_leads_table || 'leads';
    const industry = company.industry?.toLowerCase();

    if (!company.custom_leads_table && industry) {
      if (['real_estate', 'saas', 'healthcare', 'insurance', 'travel'].includes(industry)) {
        tableName = `leads_${industry}`;
      }
    }
    return tableName;
  } catch (err) {
    console.error('[getLeadsTableName] Error resolving leads table name, defaulting to leads:', err);
    return 'leads';
  }
}
