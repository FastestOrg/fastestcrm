import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { toast } from '@/components/ui/sonner';

export function useCalendarConnection() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['calendar-connection', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('calendar_connections' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

export function useCalendarEvents(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['calendar-events', user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('calendar_events' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (startDate) query = query.gte('start_time', startDate.toISOString());
      if (endDate) query = query.lte('start_time', endDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useBookingPage() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['booking-page', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('booking_pages' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

export function useCreateBookingPage() {
  const { user } = useAuth();
  const { company } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: { title: string; description?: string; durations: number[]; availability: any; slug: string; bufferMinutes?: number; id?: string }) => {
      if (!user?.id || !company?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('booking_pages' as any)
        .upsert({
          id: config.id, // Primary key for matching
          user_id: user.id,
          company_id: company.id,
          title: config.title,
          description: config.description,
          durations: config.durations,
          availability: config.availability,
          slug: config.slug,
          buffer_minutes: config.bufferMinutes,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-page'] });
      toast('Booking page saved!');
    },
    onError: (e: any) => toast(e.message || 'Failed to save booking page'),
  });
}

export function useConnectGoogleCalendar() {
  const { user } = useAuth();
  const { company } = useCompany();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id || !company?.id) throw new Error('Not authenticated');
      const redirectUri = `${window.location.origin}/dashboard/calendar`;
      const { data, error } = await supabase.functions.invoke('calendar-oauth', {
        body: { action: 'get_auth_url', userId: user.id, companyId: company.id, redirectUri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.authUrl) window.location.href = data.authUrl;
      return data;
    },
  });
}

export function useExchangeCalendarCode() {
  const { user } = useAuth();
  const { company } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!user?.id || !company?.id) throw new Error('Not authenticated');
      const redirectUri = `${window.location.origin}/dashboard/calendar`;
      const { data, error } = await supabase.functions.invoke('calendar-oauth', {
        body: { action: 'exchange_code', code, userId: user.id, companyId: company.id, redirectUri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connection'] });
      toast('Google Calendar connected!');
    },
    onError: (e: any) => toast(e.message || 'Failed to connect Google Calendar'),
  });
}
