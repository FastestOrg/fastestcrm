import { useCompany } from './useCompany';

export function useLeadsTable() {
    const { company, loading } = useCompany();

    // Default to 'leads' if no custom table is set or if loading
    let tableName = company?.custom_leads_table || 'leads';

    const industry = (company as any)?.industry?.toLowerCase();

    // Special case for industry-specific tables
    if (!company?.custom_leads_table && industry === 'real_estate') {
        tableName = 'leads_real_estate';
    }
    if (!company?.custom_leads_table && industry === 'saas') {
        tableName = 'leads_saas';
    }
    if (!company?.custom_leads_table && industry === 'healthcare') {
        tableName = 'leads_healthcare';
    }
    if (!company?.custom_leads_table && industry === 'insurance') {
        tableName = 'leads_insurance';
    }
    if (!company?.custom_leads_table && industry === 'travel') {
        tableName = 'leads_travel';
    }


    return {
        tableName,
        companyId: company?.id,
        loading
    };
}
