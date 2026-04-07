import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { proxifySupabaseUrl } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  total_licenses: number;
  used_licenses: number;
  is_active: boolean;
  custom_leads_table?: string | null;
  admin_id: string;
  industry: string | null;
  mask_leads?: boolean;
  features?: Record<string, any> | null;
  default_currency?: string | null;
}

async function fetchCompanyData(userId: string): Promise<Company | null> {
  // Step 1: Get company_id from profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.company_id) return null;

  // Step 2: Get company details
  const { data: companyData, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', profile.company_id)
    .single();

  if (companyError) {
    console.error('[useCompany] Error fetching company:', companyError);
    return null;
  }

  const company = companyData as Company;
  if (company) {
    company.logo_url = proxifySupabaseUrl(company.logo_url);
  }

  return company;
}

export function useCompany() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: company = null,
    isLoading: loading,
  } = useQuery({
    queryKey: ['company', user?.id],
    queryFn: () => fetchCompanyData(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,  // Cache for 5 minutes — shared across all hook callers
    gcTime: 1000 * 60 * 10,    // Keep in memory for 10 minutes
    retry: 2,
  });

  const isCompanyAdmin = company ? company.admin_id === user?.id : false;

  const canAddTeamMember = () => {
    if (!company) return false;
    return company.used_licenses < company.total_licenses;
  };

  const availableLicenses = () => {
    if (!company) return 0;
    return company.total_licenses - company.used_licenses;
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['company', user?.id] });
  };

  return {
    company,
    loading,
    isCompanyAdmin,
    canAddTeamMember,
    availableLicenses,
    refetch,
  };
}
