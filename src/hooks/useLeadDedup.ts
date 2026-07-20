import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from './useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useLeadDedup() {
    const { company, isCompanyAdmin } = useCompany();
    const queryClient = useQueryClient();

    // Fetch current unique constraints from the company record
    const { data: uniqueConstraints = [], isLoading, refetch } = useQuery({
        queryKey: ['lead-dedup-config', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from('companies')
                .select('unique_constraints')
                .eq('id', company.id)
                .single();
            if (error) {
                console.error('Error fetching dedup config:', error);
                return [];
            }
            return (data?.unique_constraints as string[]) || [];
        },
        enabled: !!company?.id && isCompanyAdmin,
    });

    // Toggle a unique identifier (phone or email)
    const toggleMutation = useMutation({
        mutationFn: async ({ attribute, enabled }: { attribute: string; enabled: boolean }) => {
            if (!company?.id) throw new Error('No company');
            const { data, error } = await supabase.rpc('toggle_lead_unique_constraint' as any, {
                input_company_id: company.id,
                attribute_name: attribute,
                is_unique: enabled,
            });
            if (error) throw error;
            const result = data as any;
            if (!result.success) throw new Error(result.message);
            return result;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['company'] });
        },
        onError: (error: any) => {
            toast.error('Failed: ' + error.message);
        },
    });

    // Merge existing duplicates
    const mergeMutation = useMutation({
        mutationFn: async () => {
            if (!company?.id) throw new Error('No company');
            const { data, error } = await supabase.rpc('merge_duplicate_leads' as any, {
                input_company_id: company.id,
            });
            if (error) throw error;
            const result = data as any;
            if (!result.success) throw new Error(result.message);
            return result;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ['leads'] });
        },
        onError: (error: any) => {
            toast.error('Failed to merge duplicates: ' + error.message);
        },
    });

    return {
        uniqueConstraints,
        isLoading,
        isPhoneUnique: uniqueConstraints.includes('phone'),
        isEmailUnique: uniqueConstraints.includes('email'),
        toggleUniqueIdentifier: toggleMutation.mutate,
        isToggling: toggleMutation.isPending,
        mergeDuplicates: mergeMutation.mutate,
        isMerging: mergeMutation.isPending,
        mergeResult: mergeMutation.data,
    };
}
