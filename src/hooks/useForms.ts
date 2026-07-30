import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useLeadsTable } from './useLeadsTable';

export type Form = Tables<'forms'>;
export type FormInsert = TablesInsert<'forms'>;
export type FormUpdate = TablesUpdate<'forms'>;

export function useForms() {
  const { orgClient, isBYOSLoading } = useOrgClient();
  return useQuery({
    queryKey: ['forms', (orgClient as any)?.supabaseUrl || 'default'],
    queryFn: async () => {
      const { data, error } = await orgClient
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        name: f.name || f.title || 'Untitled Form',
        title: f.title || f.name || 'Untitled Form',
        status: f.status || (f.is_active !== false ? 'active' : 'inactive'),
        is_active: f.is_active !== undefined ? f.is_active : (f.status === 'active')
      }));
    },
    enabled: !isBYOSLoading,
  });
}

export function useForm(id: string | undefined) {
  const { orgClient, isBYOSLoading } = useOrgClient();
  return useQuery({
    queryKey: ['form', (orgClient as any)?.supabaseUrl || 'default', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await orgClient
        .from('forms')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return null;
      const f = data as any;
      return {
        ...f,
        name: f.name || f.title || 'Untitled Form',
        title: f.title || f.name || 'Untitled Form',
        status: f.status || (f.is_active !== false ? 'active' : 'inactive'),
        is_active: f.is_active !== undefined ? f.is_active : (f.status === 'active')
      };
    },
    enabled: !!id && !isBYOSLoading,
  });
}

export function usePublicForm(id: string | undefined) {
  const { orgClient } = useOrgClient();
  return useQuery({
    queryKey: ['public-form', id],
    queryFn: async () => {
      if (!id) return null;

      try {
        const { data, error } = await supabase.functions.invoke('get-public-form', {
          body: { formId: id }
        });

        if (error) throw error;

        return data as Form;
      } catch (e) {
        console.warn('Edge function failed, falling back to direct DB query:', e);

        const { data: dbData, error: dbError } = await orgClient
          .from('forms')
          .select('*')
          .eq('id', id)
          .single();

        if (dbError) throw dbError;

        return dbData;
      }
    },
    enabled: !!id,
    retry: 1
  });
}

export function useCreateForm() {
  const queryClient = useQueryClient();
  const { orgClient } = useOrgClient();

  return useMutation({
    mutationFn: async (newForm: any) => {
      // Tier 1: Platform standard schema (name, created_by_id, status)
      const p1: any = {
        name: newForm.name || newForm.title,
        description: newForm.description,
        fields: newForm.fields,
        created_by_id: newForm.created_by_id || newForm.created_by,
        status: newForm.status || 'active',
      };
      if (newForm.company_id) p1.company_id = newForm.company_id;

      const { data: d1, error: e1 } = await orgClient
        .from('forms')
        .insert(p1)
        .select()
        .single();

      if (!e1 && d1) return d1;

      // Tier 2: BYOS legacy schema (title, created_by, is_active)
      const p2: any = {
        title: newForm.name || newForm.title,
        description: newForm.description,
        fields: newForm.fields,
        created_by: newForm.created_by_id || newForm.created_by,
        is_active: newForm.is_active !== undefined ? newForm.is_active : true,
      };
      if (newForm.company_id) p2.company_id = newForm.company_id;

      const { data: d2, error: e2 } = await orgClient
        .from('forms')
        .insert(p2)
        .select()
        .single();

      if (!e2 && d2) return d2;

      // Tier 3: Minimal fallback (name, created_by)
      const p3: any = {
        name: newForm.name || newForm.title,
        description: newForm.description,
        fields: newForm.fields,
        created_by: newForm.created_by_id || newForm.created_by,
      };
      if (newForm.company_id) p3.company_id = newForm.company_id;

      const { data: d3, error: e3 } = await orgClient
        .from('forms')
        .insert(p3)
        .select()
        .single();

      if (!e3 && d3) return d3;

      // Throw clearest error
      throw e1 || e2 || e3;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });
}

export function useUpdateForm() {
  const queryClient = useQueryClient();
  const { orgClient } = useOrgClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & any) => {
      // Tier 1: name, status
      const p1: any = {
        name: updates.name || updates.title,
        description: updates.description,
        fields: updates.fields,
        status: updates.status || 'active',
      };

      const { data: d1, error: e1 } = await orgClient
        .from('forms')
        .update(p1)
        .eq('id', id)
        .select()
        .single();

      if (!e1 && d1) return d1;

      // Tier 2: title, is_active
      const p2: any = {
        title: updates.name || updates.title,
        description: updates.description,
        fields: updates.fields,
        is_active: updates.is_active !== undefined ? updates.is_active : true,
      };

      const { data: d2, error: e2 } = await orgClient
        .from('forms')
        .update(p2)
        .eq('id', id)
        .select()
        .single();

      if (!e2 && d2) return d2;

      // Tier 3: minimal name update
      const p3: any = {
        name: updates.name || updates.title,
        description: updates.description,
        fields: updates.fields,
      };

      const { data: d3, error: e3 } = await orgClient
        .from('forms')
        .update(p3)
        .eq('id', id)
        .select()
        .single();

      if (!e3 && d3) return d3;

      throw e1 || e2 || e3;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['form', data?.id] });
    },
  });
}

export function useDeleteForm() {
  const queryClient = useQueryClient();
  const { orgClient } = useOrgClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await orgClient
        .from('forms')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) throw error;
      if (count === 0) {
        throw new Error('Permission denied or form not found');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });
}

export interface LeadResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  form_id: string | null;
  [key: string]: any;
}

export function useFormResponses(formId: string | undefined) {
  const { tableName, companyId } = useLeadsTable();
  const { orgClient } = useOrgClient();

  return useQuery({
    queryKey: ['form-responses', formId, tableName, companyId],
    queryFn: async (): Promise<LeadResponse[]> => {
      if (!formId) return [];

      let query = orgClient
        .from(tableName as any)
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });

      if (tableName === 'leads' && companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as unknown as LeadResponse[]) || [];
    },
    enabled: !!formId,
  });
}

export function useFormResponseCounts() {
  const { tableName, companyId } = useLeadsTable();
  const { orgClient } = useOrgClient();

  return useQuery({
    queryKey: ['form-response-counts', tableName, companyId],
    queryFn: async () => {
      let query = orgClient
        .from(tableName as any)
        .select('form_id');

      if (tableName === 'leads' && companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregating counts
      const counts: Record<string, number> = {};
      data?.forEach((row: any) => {
        if (row.form_id) {
          counts[row.form_id] = (counts[row.form_id] || 0) + 1;
        }
      });

      return counts;
    },
  });
}
