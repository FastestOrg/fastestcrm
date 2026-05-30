import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIMemory {
  id: string;
  employee_id: string;
  lead_id: string;
  company_id: string | null;
  memory_data: Array<{
    role: 'user' | 'model';
    parts: Array<{ text?: string; functionCall?: any }>;
  }>;
  summary: string | null;
  lead_context_snapshot: any;
  interaction_count: number;
  last_interaction_at: string;
  created_at: string;
  updated_at: string;
}

export interface AIAction {
  id: string;
  employee_id: string;
  lead_id: string;
  company_id: string | null;
  action_type: string;
  content: string | null;
  metadata: any;
  status: 'pending' | 'completed' | 'failed' | 'pending_approval' | 'rejected';
  error_message: string | null;
  created_at: string;
}

export function useAIAgentMemory(leadId?: string) {
  const queryClient = useQueryClient();

  const { data: memories, isLoading: isLoadingMemory } = useQuery({
    queryKey: ['ai-agent-memory', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('ai_employee_memory' as any)
        .select('*, ai_employees(*)' as any)
        .eq('lead_id', leadId);

      if (error) throw error;
      return data as (AIMemory & { ai_employees?: { name: string; avatar_url: string | null } })[];
    },
    enabled: !!leadId,
  });

  const { data: actions, isLoading: isLoadingActions } = useQuery({
    queryKey: ['ai-agent-actions', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('ai_employee_actions' as any)
        .select('*, ai_employees(*)' as any)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (AIAction & { ai_employees?: { name: string; avatar_url: string | null } })[];
    },
    enabled: !!leadId,
  });

  const clearMemory = useMutation({
    mutationFn: async (employeeId: string) => {
      if (!leadId) throw new Error('Lead ID not specified');
      const { error } = await supabase
        .from('ai_employee_memory' as any)
        .delete()
        .eq('lead_id', leadId)
        .eq('employee_id', employeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-memory', leadId] });
      toast.success('AI Memory cleared successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to clear memory: ${error.message}`);
    },
  });

  return {
    memories,
    actions,
    isLoading: isLoadingMemory || isLoadingActions,
    clearMemory,
  };
}
