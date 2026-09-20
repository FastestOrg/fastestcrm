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
  features?: Record<string, unknown> | null;
  default_currency?: string | null;
  ai_calling_button_active?: boolean;
}

async function fetchCompanyData(userId: string): Promise<Company | null> {
  // Step 1: Get company joined with profile in a single network round-trip
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, company:companies(*)')
    .eq('id', userId)
    .single();

  if (profileError) return null;

  let company = (profile as unknown as Record<string, unknown>)?.company as Company | null;

  // Fallback for platform_admin or unjoined company
  if (!company) {
    const companyId = profile?.company_id;

    if (!companyId) {
      const { data: isPrivileged } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (isPrivileged) {
        // Find the 'fastestcrm' company to default to
        const { data: defaultCompany } = await supabase
          .from('companies')
          .select('*')
          .eq('slug', 'fastestcrm')
          .maybeSingle();

        if (defaultCompany) {
          company = defaultCompany as Company;
        }
      }
    } else {
      // Direct fetch if relational join was empty due to specific RLS
      const { data: directCompany, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (!companyError && directCompany) {
        company = directCompany as Company;
      }
    }
  }

  if (company) {
    company.logo_url = proxifySupabaseUrl(company.logo_url);
  }

  return company;
}

export function useCompany() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const initialCompany = profile?.company ? (profile.company as unknown as Company) : undefined;

  const {
    data: company = null,
    isLoading: loading,
  } = useQuery({
    queryKey: ['company', user?.id],
    queryFn: () => fetchCompanyData(user!.id),
    initialData: initialCompany,
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
