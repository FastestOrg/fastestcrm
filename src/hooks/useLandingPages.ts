import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';
import { useAuth } from './useAuth';
import { useHierarchy } from './useHierarchy';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LandingPage {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  slug: string;
  meta_description: string | null;
  html_content: string;
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  // Joined field (optional)
  profiles?: { full_name: string | null } | null;
}

export interface LandingPageInput {
  title: string;
  slug: string;
  meta_description?: string;
  html_content: string;
  is_published?: boolean;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches all landing pages for the current company.
 * Hierarchy-based access: admins see all, managers see pages from their
 * reports, regular users see only their own pages.
 */
export function useLandingPages() {
  const { company } = useCompany();
  const { accessibleUserIds, canViewAll, loading: hierarchyLoading } = useHierarchy();

  return useQuery({
    queryKey: ['landing-pages', company?.id, canViewAll, accessibleUserIds],
    queryFn: async () => {
      if (!company?.id) return [];

      let query = supabase
        .from('landing_pages' as any)
        .select('*, profiles(full_name)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      // Hierarchy filtering: if not admin, only show pages from accessible users
      if (!canViewAll && accessibleUserIds.length > 0) {
        query = query.in('created_by', accessibleUserIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as LandingPage[]) || [];
    },
    enabled: !!company?.id && !hierarchyLoading,
  });
}

/**
 * Fetches a single landing page by ID (for the editor).
 */
export function useLandingPage(id: string | undefined) {
  return useQuery({
    queryKey: ['landing-page', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('landing_pages' as any)
        .select('*, profiles(full_name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as LandingPage;
    },
    enabled: !!id,
  });
}

/**
 * Creates a new landing page.
 */
export function useCreateLandingPage() {
  const queryClient = useQueryClient();
  const { company } = useCompany();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: LandingPageInput) => {
      if (!company?.id || !user?.id) throw new Error('Missing company or user context');

      const { data, error } = await supabase
        .from('landing_pages' as any)
        .insert({
          company_id: company.id,
          created_by: user.id,
          title: input.title,
          slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          meta_description: input.meta_description || null,
          html_content: input.html_content,
          is_published: input.is_published ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as LandingPage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
    },
  });
}

/**
 * Updates an existing landing page.
 */
export function useUpdateLandingPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<LandingPageInput>) => {
      const payload: any = { ...updates, updated_at: new Date().toISOString() };
      if (updates.slug) {
        payload.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      }

      const { data, error } = await supabase
        .from('landing_pages' as any)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as LandingPage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['landing-page', data.id] });
    },
  });
}

/**
 * Deletes a landing page.
 */
export function useDeleteLandingPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('landing_pages' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
    },
  });
}
