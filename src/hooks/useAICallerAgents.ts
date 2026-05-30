import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';

export interface AICallerAgent {
    id: string;
    name: string;
    system_prompt: string;
    voice: string;
    language: string;
    phone_number: string;
    max_duration_minutes: number;
    is_active: boolean;
    created_at: string;
}

export interface CreateAgentParams {
    name: string;
    system_prompt: string;
    voice: string;
    language: string;
    phone_number: string;
    max_duration_minutes: number;
    is_active: boolean;
}

const SERVICE_PREFIX = 'ai_caller_agent';

function parseAgentRow(row: any): AICallerAgent {
    const config = typeof row.api_key === 'string' ? JSON.parse(row.api_key) : row.api_key;
    return {
        id: row.id,
        name: config.name,
        system_prompt: config.system_prompt,
        voice: config.voice ?? 'Aoede',
        language: config.language ?? 'en-US',
        phone_number: config.phone_number ?? '',
        max_duration_minutes: config.max_duration_minutes ?? 10,
        is_active: row.is_active ?? true,
        created_at: row.created_at,
    };
}

export function useAICallerAgents() {
    const { user } = useAuth();
    const { company } = useCompany();
    const queryClient = useQueryClient();

    const { data: agents = [], isLoading } = useQuery({
        queryKey: ['ai-caller-agents', company?.id],
        queryFn: async (): Promise<AICallerAgent[]> => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from('integration_api_keys')
                .select('id, api_key, is_active, created_at')
                .eq('company_id', company.id)
                .eq('service_name', SERVICE_PREFIX)
                .order('created_at', { ascending: false }) as any;
            if (error) throw error;
            return (data || []).map(parseAgentRow);
        },
        enabled: !!company?.id,
    });

    const createMutation = useMutation({
        mutationFn: async (params: CreateAgentParams) => {
            const { error } = await supabase
                .from('integration_api_keys')
                .insert({
                    user_id: user?.id,
                    company_id: company?.id,
                    service_name: SERVICE_PREFIX,
                    api_key: JSON.stringify(params),
                    is_active: params.is_active,
                } as any);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-caller-agents'] }),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, params }: { id: string; params: Partial<CreateAgentParams> }) => {
            // Fetch existing config first
            const { data: existing } = await supabase
                .from('integration_api_keys')
                .select('api_key')
                .eq('id', id)
                .single() as any;
            const current = typeof existing?.api_key === 'string' ? JSON.parse(existing.api_key) : existing?.api_key ?? {};
            const merged = { ...current, ...params };

            const { error } = await supabase
                .from('integration_api_keys')
                .update({
                    api_key: JSON.stringify(merged),
                    is_active: params.is_active ?? current.is_active,
                } as any)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-caller-agents'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('integration_api_keys')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-caller-agents'] }),
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase
                .from('integration_api_keys')
                .update({ is_active } as any)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-caller-agents'] }),
    });

    // Helper to get Vobiz config for this company
    const getVobizConfig = async () => {
        const { data } = await supabase
            .from('integration_api_keys')
            .select('api_key, is_active')
            .eq('company_id', company?.id)
            .eq('service_name', 'vobiz')
            .eq('is_active', true)
            .maybeSingle() as any;
        if (!data) return null;
        return typeof data.api_key === 'string' ? JSON.parse(data.api_key) : data.api_key;
    };

    return {
        agents,
        isLoading,
        createAgent: createMutation.mutateAsync,
        updateAgent: updateMutation.mutateAsync,
        deleteAgent: deleteMutation.mutateAsync,
        toggleAgent: toggleMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        getVobizConfig,
    };
}
