import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Constants } from '@/integrations/supabase/types';

export type AppRole = typeof Constants.public.Enums.app_role[number];

export interface HierarchyUser {
    id: string;
    manager_id: string | null;
    role: AppRole;
}

export function useHierarchy() {
    const { user } = useAuth();

    const query = useQuery({
        queryKey: ['hierarchy', user?.id],
        queryFn: async () => {
            if (!user?.id) {
                return { accessibleUserIds: [], canViewAll: false };
            }

            // 1. Fetch current user's role and company details safely
            const [myProfileResult, myRoleResult] = await Promise.all([
                supabase.from('profiles').select('company_id').eq('id', user.id).single(),
                supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
            ]);

            const myCompanyId = myProfileResult.data?.company_id;
            let myRole = (myRoleResult.data?.role as AppRole) || null;

            // Fallback: If no role record but has company_id (likely Admin/Owner), default to 'company'
            if (!myRole && myCompanyId) {
                myRole = 'company';
            }

            // If regular user and no company, return empty
            if (!myCompanyId && myRole !== 'platform_admin') {
                return { accessibleUserIds: [user.id], canViewAll: false };
            }

            // If Admin/Company Admin, they can view everything
            if (myRole === 'company' || myRole === 'company_subadmin' || myRole === 'platform_admin') {
                return { accessibleUserIds: [], canViewAll: true };
            }

            // 2. Fetch profiles for THIS company to build hierarchy
            // We only need id and manager_id
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, manager_id')
                .eq('company_id', myCompanyId);

            if (profilesError) throw profilesError;

            // 3. Build adjacency list for the tree: manager_id -> [direct_reports]
            const reportsMap = new Map<string, string[]>();
            profiles?.forEach(p => {
                if (p.manager_id) {
                    if (!reportsMap.has(p.manager_id)) {
                        reportsMap.set(p.manager_id, []);
                    }
                    reportsMap.get(p.manager_id)?.push(p.id);
                }
            });

            // 4. DFS to find all descendants
            const descendants = new Set<string>();
            const queue = [user.id];
            descendants.add(user.id);

            while (queue.length > 0) {
                const currentId = queue.shift()!;
                const directReports = reportsMap.get(currentId) || [];

                for (const reportId of directReports) {
                    if (!descendants.has(reportId)) {
                        descendants.add(reportId);
                        queue.push(reportId);
                    }
                }
            }

            return {
                accessibleUserIds: Array.from(descendants),
                canViewAll: false
            };
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    return {
        accessibleUserIds: query.data?.accessibleUserIds ?? [],
        canViewAll: query.data?.canViewAll ?? false,
        loading: query.isLoading
    };
}
