import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from './useCompany';
import { supabase } from '@/integrations/supabase/client';
import { useOrgClient } from './useOrgClient';
import { toast } from 'sonner';

export function useLeadDedup() {
    const { company, isCompanyAdmin } = useCompany();
    const { orgClient } = useOrgClient();
    const queryClient = useQueryClient();
    const [progressMsg, setProgressMsg] = useState<string | null>(null);
    const [mergedStats, setMergedStats] = useState<{ batchCount: number; mergedGroups: number; deletedRecords: number }>({
        batchCount: 0,
        mergedGroups: 0,
        deletedRecords: 0,
    });
    const abortRef = useRef<boolean>(false);

    // Fetch current unique constraints from the company record (platform-scoped)
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
            const { data, error } = await orgClient.rpc('toggle_lead_unique_constraint' as any, {
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

    // Cancel / Abort active merge
    const cancelMerge = () => {
        if (mergeMutation.isPending) {
            abortRef.current = true;
            setProgressMsg('Canceling merge after current batch...');
        }
    };

    // Merge existing duplicates iteratively in high-speed micro-batches of 100
    const mergeMutation = useMutation({
        mutationFn: async () => {
            if (!company?.id) throw new Error('No company');

            abortRef.current = false;
            let totalMergedGroups = 0;
            let totalDeletedRecords = 0;
            let hasMore = true;
            let batchCount = 0;
            const BATCH_SIZE = 100; // Optimal sweet spot: sub-500ms execution per batch, zero 500 timeouts

            while (hasMore) {
                if (abortRef.current) {
                    break;
                }

                batchCount++;
                setProgressMsg(`Processing batch ${batchCount}... (${totalMergedGroups} groups merged, ${totalDeletedRecords} leads cleaned)`);
                setMergedStats({ batchCount, mergedGroups: totalMergedGroups, deletedRecords: totalDeletedRecords });

                const { data, error } = await orgClient.rpc('merge_duplicate_leads' as any, {
                    input_company_id: company.id,
                    batch_limit: BATCH_SIZE,
                });

                if (error) throw error;
                const result = data as any;
                if (!result.success) throw new Error(result.message);

                const mergedInBatch = result.merged_groups || 0;
                const deletedInBatch = result.deleted_records || 0;

                totalMergedGroups += mergedInBatch;
                totalDeletedRecords += deletedInBatch;
                setMergedStats({ batchCount, mergedGroups: totalMergedGroups, deletedRecords: totalDeletedRecords });

                if (mergedInBatch === 0 || result.has_more === false) {
                    hasMore = false;
                }
            }

            setProgressMsg(null);
            const wasAborted = abortRef.current;
            abortRef.current = false;

            return {
                success: true,
                message: wasAborted
                    ? `Merge stopped by user. Cleaned ${totalMergedGroups} duplicate group(s) (${totalDeletedRecords} redundant records).`
                    : totalMergedGroups > 0
                        ? `Merged ${totalMergedGroups} duplicate group(s), removed ${totalDeletedRecords} redundant record(s).`
                        : 'No duplicates found — your leads are clean!',
                merged_groups: totalMergedGroups,
                deleted_records: totalDeletedRecords,
                wasAborted,
            };
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['travel-leads'] });
            queryClient.invalidateQueries({ queryKey: ['real-estate-leads'] });
            queryClient.invalidateQueries({ queryKey: ['saas-leads'] });
            queryClient.invalidateQueries({ queryKey: ['insurance-leads'] });
            queryClient.invalidateQueries({ queryKey: ['healthcare-leads'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
            queryClient.invalidateQueries({ queryKey: ['company-analytics'] });
        },
        onError: (error: any) => {
            setProgressMsg(null);
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
        cancelMerge,
        mergeResult: mergeMutation.data,
        progressMsg,
        mergedStats,
    };
}

