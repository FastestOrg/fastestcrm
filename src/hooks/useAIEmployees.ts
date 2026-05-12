import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';
import { toast } from 'sonner';

export interface AIEmployee {
  id: string;
  company_id: string;
  name: string;
  avatar_url: string | null;
  system_prompt: string | null;
  knowledge_base: string | null;
  outcome_goal: string | null;
  dialer_provider: 'privo' | 'exotel' | null;
  dialer_api_key: string | null;
  dialer_api_secret: string | null;
  dialer_phone_number: string | null;
  whatsapp_account_id: string | null;
  email_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAIEmployees() {
  const { company } = useCompany();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['ai-employees', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('ai_employees' as any)
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AIEmployee[];
    },
    enabled: !!company?.id,
  });

  const createEmployee = useMutation({
    mutationFn: async (newEmployee: Partial<AIEmployee>) => {
      if (!company?.id) throw new Error('Company not found');
      const { data, error } = await supabase
        .from('ai_employees' as any)
        .insert([{ ...newEmployee, company_id: company.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-employees'] });
      toast.success('AI Employee created successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to create AI Employee: ${error.message}`);
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIEmployee> & { id: string }) => {
      const { data, error } = await supabase
        .from('ai_employees' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-employees'] });
      toast.success('AI Employee updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update AI Employee: ${error.message}`);
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_employees' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-employees'] });
      toast.success('AI Employee deleted');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete AI Employee: ${error.message}`);
    },
  });

  return {
    employees,
    isLoading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}
