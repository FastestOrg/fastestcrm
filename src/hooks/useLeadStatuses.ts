import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';
import { useOrgClient } from './useOrgClient';

export interface CompanyLeadStatus {
    id: string;
    company_id: string;
    label: string;
    value: string;
    color: string;
    category: 'new' | 'paid' | 'interested' | 'other';
    sub_statuses: string[];
    order_index: number;
    is_active: boolean;
    status_type: 'simple' | 'date_derived' | 'time_derived';
    web_push_enabled: boolean;
}

const missingTablesCache = new Set<string>();

export function useLeadStatuses() {
    const { company } = useCompany();
    const { orgClient, isBYOSLoading } = useOrgClient();

    const { data: statuses, isLoading, error } = useQuery({
        queryKey: ['lead-statuses', (orgClient as any)?.supabaseUrl || 'default', company?.id],
        queryFn: async (): Promise<CompanyLeadStatus[]> => {
            if (!company?.id) return [];

            const targetUrl = (orgClient as any)?.supabaseUrl || 'default';
            const isDefaultHost = targetUrl.includes('api.fastestcrm.com') || targetUrl.includes('uykdyqdeyilpulaqlqip');

            // Default Supabase host has company_lead_statuses; BYOS hosts prefer lead_statuses
            const primaryTable = isDefaultHost ? 'company_lead_statuses' : 'lead_statuses';
            const fallbackTable = isDefaultHost ? 'lead_statuses' : 'company_lead_statuses';

            const cacheKeyMissingPrimary = `${targetUrl}_missing_${primaryTable}`;

            try {
                if (!missingTablesCache.has(cacheKeyMissingPrimary)) {
                    const { data, error } = await orgClient
                        .from(primaryTable as any)
                        .select('*')
                        .eq('company_id', company.id)
                        .order(primaryTable === 'company_lead_statuses' ? 'order_index' : 'sort_order', { ascending: true });

                    if (!error && data && data.length > 0) {
                        return data.map((s: any) => ({
                            id: s.id,
                            company_id: s.company_id,
                            label: s.label || s.name || 'Status',
                            value: s.value || (s.name || s.label || 'status').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                            color: s.color || '#3B82F6',
                            category: s.category || s.status_type || 'other',
                            sub_statuses: s.sub_statuses || [],
                            order_index: s.order_index ?? s.sort_order ?? 0,
                            is_active: s.is_active !== undefined ? s.is_active : true,
                            status_type: s.status_type || 'simple',
                            web_push_enabled: s.web_push_enabled || false
                        }));
                    }

                    if (error) {
                        missingTablesCache.add(cacheKeyMissingPrimary);
                    }
                }

                // Fallback table
                const { data: fbData, error: fbErr } = await orgClient
                    .from(fallbackTable as any)
                    .select('*')
                    .eq('company_id', company.id)
                    .order(fallbackTable === 'company_lead_statuses' ? 'order_index' : 'sort_order', { ascending: true });

                if (!fbErr && fbData) {
                    return fbData.map((s: any) => ({
                        id: s.id,
                        company_id: s.company_id,
                        label: s.label || s.name || 'Status',
                        value: s.value || (s.name || s.label || 'status').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                        color: s.color || '#3B82F6',
                        category: s.category || s.status_type || 'other',
                        sub_statuses: s.sub_statuses || [],
                        order_index: s.order_index ?? s.sort_order ?? 0,
                        is_active: s.is_active !== undefined ? s.is_active : true,
                        status_type: s.status_type || 'simple',
                        web_push_enabled: s.web_push_enabled || false
                    }));
                }

                return [];
            } catch (e) {
                return [];
            }
        },
        enabled: !!company?.id && !isBYOSLoading,
        // Cache for a bit to avoid constant refetching on every dropdown open
        staleTime: 1000 * 60 * 5,
    });

    // Helper to get color for a status value
    const getStatusColor = (value: string) => {
        const status = statuses?.find(s => s.value === value);
        return status?.color || '#6B7280'; // Default gray
    };

    // Helper to get label
    const getStatusLabel = (value: string) => {
        const status = statuses?.find(s => s.value === value);
        return status?.label || value.replace(/_/g, ' ');
    };

    return {
        statuses: statuses || [],
        isLoading,
        error,
        getStatusColor,
        getStatusLabel
    };
}
