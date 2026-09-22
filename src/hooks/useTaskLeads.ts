import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLeadsTable } from './useLeadsTable';
import { useLeadStatuses } from './useLeadStatuses';
import { useOrgClient } from './useOrgClient';

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
    const { orgClient } = useOrgClient();

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

            const targetUrl = (orgClient as any)?.supabaseUrl || 'default';
            const isDefaultHost = targetUrl.includes('api.fastestcrm.com') || targetUrl.includes('uykdyqdeyilpulaqlqip');

            // Fetch all leads with reminder_at set using chunked pagination (PostgREST caps single queries at 1,000 rows)
            let allLeads: any[] = [];
            let from = 0;
            const CHUNK_SIZE = 1000;
            const MAX_CHUNKS = 15; // Safety cap: up to 15,000 tasks
            let chunkIndex = 0;
            let hasMore = true;

            while (hasMore && chunkIndex < MAX_CHUNKS) {
                chunkIndex++;
                let leadQuery = orgClient
                    .from(tableName as any)
                    .select(selectQuery)
                    .not('reminder_at', 'is', null) // Server-side filter — key for performance
                    .order('reminder_at', { ascending: true })
                    .range(from, from + CHUNK_SIZE - 1);

                if (isDefaultHost) {
                    leadQuery = leadQuery.eq('company_id', companyId);
                }

                const { data: chunk, error: leadsError } = await leadQuery;

                if (leadsError) {
                    console.error('[useTaskLeads] Chunk query error:', leadsError);
                    throw leadsError;
                }

                if (chunk && chunk.length > 0) {
                    allLeads.push(...chunk);
                    from += CHUNK_SIZE;
                    if (chunk.length < CHUNK_SIZE) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            // Fetch calendar events/bookings starting from today start to prevent past meetings cluttering tasks
            const { todayStart } = getDateBoundaries();

            const primaryTable = isDefaultHost ? 'calendar_events' : 'calendar_bookings';
            const fallbackTable = isDefaultHost ? 'calendar_bookings' : 'calendar_events';

            let eventsData: any[] = [];
            let eventsFrom = 0;
            let eventsHasMore = true;
            let eventsChunkIndex = 0;
            let usedFallback = false;

            while (eventsHasMore && eventsChunkIndex < 20) {
                eventsChunkIndex++;
                const targetEventTable = usedFallback ? fallbackTable : primaryTable;
                const { data: eData, error: eErr } = await orgClient
                    .from(targetEventTable as any)
                    .select('*')
                    .eq('company_id', companyId)
                    .gte('start_time', todayStart.toISOString())
                    .neq('status', 'cancelled')
                    .order('start_time', { ascending: true })
                    .range(eventsFrom, eventsFrom + CHUNK_SIZE - 1);

                if (eErr && !usedFallback && eventsFrom === 0) {
                    usedFallback = true;
                    eventsChunkIndex = 0;
                    continue;
                }

                if (!eErr && eData && eData.length > 0) {
                    eventsData.push(...eData);
                    eventsFrom += CHUNK_SIZE;
                    if (eData.length < CHUNK_SIZE) {
                        eventsHasMore = false;
                    }
                } else {
                    eventsHasMore = false;
                }
            }

            const mappedLeads: TaskLead[] = allLeads.map((lead: any) => ({
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
        staleTime: 5 * 60 * 1000, // 5 minutes fresh — ensures zero background refetches while navigating between CRM tabs
        gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
        refetchOnWindowFocus: false, // Prevent background refetches when switching browser tabs or windows
        refetchOnReconnect: false,
        retry: 1,
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
