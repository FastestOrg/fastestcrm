import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLeadsTable } from './useLeadsTable';
import { useLeadStatuses } from './useLeadStatuses';

export interface TaskLead {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    status: string;
    reminder_at: string;
    sales_owner_id: string | null;
    sales_owner?: { full_name: string | null } | null;
    company_id: string;
    college: string | null;
    lead_source: string | null;
    product_purchased: string | null;
    created_at: string;
    updated_at: string;
    lead_history?: any[] | null;
    // Meeting fields
    isMeeting?: boolean;
    location?: string | null;
    lead_id?: string | null;
    event_type?: string | null;
}

export type TaskBucket = 'urgent' | 'today' | 'upcoming';

export interface TaskLeadsResult {
    urgent: TaskLead[];
    today: TaskLead[];
    upcoming: TaskLead[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
    totalCount: number;
}

function getDateBoundaries() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { todayStart, todayEnd };
}

export function useTaskLeads(): TaskLeadsResult {
    const { tableName, companyId, loading: tableLoading } = useLeadsTable();
    const { statuses } = useLeadStatuses();

    // Build a set of status values that are date/time derived so we know which
    // leads have actionable reminders. We still show all leads with reminder_at
    // set regardless — the reminder_at field is the source of truth.
    const dateStatusValues = useMemo(
        () =>
            new Set(
                statuses
                    .filter((s) => s.status_type === 'date_derived' || s.status_type === 'time_derived')
                    .map((s) => s.value)
            ),
        [statuses]
    );

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['task-leads', tableName, companyId],
        queryFn: async (): Promise<TaskLead[]> => {
            if (!companyId) return [];

            // Pull only joins for default leads table — custom tables don't have FK
            const selectQuery =
                tableName === 'leads'
                    ? '*, sales_owner:profiles!leads_sales_owner_id_fkey(full_name)'
                    : '*';

            const { data: leadsData, error: leadsError } = await supabase
                .from(tableName as any)
                .select(selectQuery)
                .eq('company_id', companyId)
                .not('reminder_at', 'is', null) // Server-side filter — key for performance
                .order('reminder_at', { ascending: true });

            if (leadsError) throw leadsError;

            // Fetch calendar events starting from today start to prevent past meetings cluttering tasks
            const { todayStart } = getDateBoundaries();
            const { data: eventsData, error: eventsError } = await supabase
                .from('calendar_events' as any)
                .select('*')
                .eq('company_id', companyId)
                .gte('start_time', todayStart.toISOString())
                .neq('status', 'cancelled')
                .order('start_time', { ascending: true });

            if (eventsError) throw eventsError;

            const mappedLeads: TaskLead[] = (leadsData || []).map((lead: any) => ({
                ...lead,
                isMeeting: false,
            }));

            const mappedEvents: TaskLead[] = (eventsData || []).map((event: any) => ({
                id: event.id,
                name: event.title,
                email: event.attendee_email,
                phone: event.attendee_phone,
                whatsapp: null,
                status: 'meeting',
                reminder_at: event.start_time,
                sales_owner_id: event.user_id,
                sales_owner: null,
                company_id: event.company_id,
                college: event.attendee_name ? `Attendee: ${event.attendee_name}` : null,
                lead_source: null,
                product_purchased: null,
                created_at: event.created_at,
                updated_at: event.updated_at,
                lead_history: null,
                isMeeting: true,
                location: event.location,
                lead_id: event.lead_id,
                event_type: event.event_type,
            } as unknown as TaskLead));

            const combined = [...mappedLeads, ...mappedEvents];
            combined.sort((a, b) => new Date(a.reminder_at).getTime() - new Date(b.reminder_at).getTime());

            return combined;
        },
        enabled: !tableLoading && !!companyId,
        staleTime: 30_000, // 30 seconds fresh
        retry: 2,
    });

    // Partition the flat list into buckets — runs only when data changes
    const { urgent, today, upcoming } = useMemo(() => {
        if (!data || data.length === 0) return { urgent: [], today: [], upcoming: [] };

        const { todayStart, todayEnd } = getDateBoundaries();
        const urgent: TaskLead[] = [];
        const today: TaskLead[] = [];
        const upcoming: TaskLead[] = [];

        for (const lead of data) {
            const reminderDate = new Date(lead.reminder_at);

            if (reminderDate < todayStart) {
                urgent.push(lead);
            } else if (reminderDate <= todayEnd) {
                today.push(lead);
            } else {
                upcoming.push(lead);
            }
        }

        // Urgent is sorted newest-first (most overdue first)
        urgent.sort((a, b) => new Date(b.reminder_at).getTime() - new Date(a.reminder_at).getTime());

        return { urgent, today, upcoming };
    }, [data]);

    return {
        urgent,
        today,
        upcoming,
        isLoading: isLoading || tableLoading,
        error: error as Error | null,
        refetch,
        totalCount: (data?.length ?? 0),
    };
}
