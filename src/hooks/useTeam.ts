import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Constants } from '@/integrations/supabase/types';

export type AppRole = typeof Constants.public.Enums.app_role[number];

export interface TeamMember {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  manager_id: string | null;
  created_at: string;
  role: AppRole;
  is_deactivated?: boolean;
  is_pending?: boolean;
  incentive_percent?: number | null;
  manager?: {
    id: string;
    full_name: string | null;
  };
}

const DEFAULT_ROLE_LABELS: Record<AppRole, string> = {
  platform_admin: 'Platform Admin',
  company: 'Company Admin',
  company_subadmin: 'Company SubAdmin',
  cbo: 'CBO',
  vp: 'VP',
  avp: 'AVP',
  dgm: 'DGM',
  agm: 'AGM',
  sm: 'Sales Manager',
  tl: 'Team Lead',
  bde: 'BDE',
  intern: 'Intern',
  ca: 'Campus Ambassador',
  level_3: 'CBO',
  level_4: 'VP',
  level_5: 'AVP',
  level_6: 'DGM',
  level_7: 'AGM',
  level_8: 'Sales Manager',
  level_9: 'Team Lead',
  level_10: 'BDE',
  level_11: 'Intern',
  level_12: 'Campus Ambassador',
  level_13: 'Level 13',
  level_14: 'Level 14',
  level_15: 'Level 15',
  level_16: 'Level 16',
  level_17: 'Level 17',
  level_18: 'Level 18',
  level_19: 'Level 19',
  level_20: 'Level 20',
};

const ROLE_LEVELS: Record<AppRole, number> = {
  platform_admin: 0,
  company: 1,
  company_subadmin: 2,
  cbo: 3,
  vp: 4,
  avp: 5,
  dgm: 6,
  agm: 7,
  sm: 8,
  tl: 9,
  bde: 10,
  intern: 11,
  ca: 12,
  level_3: 3,
  level_4: 4,
  level_5: 5,
  level_6: 6,
  level_7: 7,
  level_8: 8,
  level_9: 9,
  level_10: 10,
  level_11: 11,
  level_12: 12,
  level_13: 13,
  level_14: 14,
  level_15: 15,
  level_16: 16,
  level_17: 17,
  level_18: 18,
  level_19: 19,
  level_20: 20,
};

export function useTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole | null>(null);
  const [roleLabels, setRoleLabels] = useState<Record<AppRole, string>>(DEFAULT_ROLE_LABELS);
  const { user } = useAuth();

  const fetchTeam = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch current user's role and company details safely
      const [myProfileResult, myRoleResult] = await Promise.all([
        supabase.from('profiles').select('company_id').eq('id', user.id).single(),
        supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
      ]);

      const myCompanyId = myProfileResult.data?.company_id;
      let myRole = (myRoleResult.data?.role as AppRole) || null;

      // Fallback: If no role record but has company_id (likely Admin/Owner), default to 'company'
      if (!myRole && myCompanyId) {
        // Verify if they are actually the admin of the company? 
        // For frontend simplicity, if they have a company_id in profile but no role, they are likely the owner initiated via register-company
        // or we can just default to 'company' safely as a fallback for the UI.
        myRole = 'company';
      }

      if (myRole) {
        setCurrentUserRole(myRole);
      }

      // If regular user and no company, return empty
      if (!myCompanyId && myRole !== 'platform_admin') {
        setMembers([]);
        setLoading(false);
        return;
      }

      // 1.5 Fetch Company Hierarchy if available
      if (myCompanyId) {
        const { data: hierarchyData } = await supabase
          .from('company_hierarchies')
          .select('*')
          .eq('company_id', myCompanyId)
          .single();

        if (hierarchyData) {
          const newLabels = { ...DEFAULT_ROLE_LABELS };
          // Map dynamic names - Allow empty strings to override defaults
          if (hierarchyData.level_1 !== null) newLabels.company = hierarchyData.level_1;
          if (hierarchyData.level_2 !== null) newLabels.company_subadmin = hierarchyData.level_2;
          if (hierarchyData.level_3 !== null) { newLabels.level_3 = hierarchyData.level_3; newLabels.cbo = hierarchyData.level_3; }
          if (hierarchyData.level_4 !== null) { newLabels.level_4 = hierarchyData.level_4; newLabels.vp = hierarchyData.level_4; }
          if (hierarchyData.level_5 !== null) { newLabels.level_5 = hierarchyData.level_5; newLabels.avp = hierarchyData.level_5; }
          if (hierarchyData.level_6 !== null) { newLabels.level_6 = hierarchyData.level_6; newLabels.dgm = hierarchyData.level_6; }
          if (hierarchyData.level_7 !== null) { newLabels.level_7 = hierarchyData.level_7; newLabels.agm = hierarchyData.level_7; }
          if (hierarchyData.level_8 !== null) { newLabels.level_8 = hierarchyData.level_8; newLabels.sm = hierarchyData.level_8; }
          if (hierarchyData.level_9 !== null) { newLabels.level_9 = hierarchyData.level_9; newLabels.tl = hierarchyData.level_9; }
          if (hierarchyData.level_10 !== null) { newLabels.level_10 = hierarchyData.level_10; newLabels.bde = hierarchyData.level_10; }
          if (hierarchyData.level_11 !== null) { newLabels.level_11 = hierarchyData.level_11; newLabels.intern = hierarchyData.level_11; }
          if (hierarchyData.level_12 !== null) { newLabels.level_12 = hierarchyData.level_12; newLabels.ca = hierarchyData.level_12; }
          if (hierarchyData.level_13 !== null) newLabels.level_13 = hierarchyData.level_13;
          if (hierarchyData.level_14 !== null) newLabels.level_14 = hierarchyData.level_14;
          if (hierarchyData.level_15 !== null) newLabels.level_15 = hierarchyData.level_15;
          if (hierarchyData.level_16 !== null) newLabels.level_16 = hierarchyData.level_16;
          if (hierarchyData.level_17 !== null) newLabels.level_17 = hierarchyData.level_17;
          if (hierarchyData.level_18 !== null) newLabels.level_18 = hierarchyData.level_18;
          if (hierarchyData.level_19 !== null) newLabels.level_19 = hierarchyData.level_19;
          if (hierarchyData.level_20 !== null) newLabels.level_20 = hierarchyData.level_20;

          setRoleLabels(newLabels);
        }
      }

      // 2. Fetch profiles for THIS company
      let profilesQuery = supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, manager_id, created_at, is_deactivated, incentive_percent')
        .order('created_at', { ascending: true });

      if (myCompanyId) {
        profilesQuery = profilesQuery.eq('company_id', myCompanyId);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError) throw profilesError;

      // 3. Fetch roles ONLY for these profiles
      const memberIds = profiles?.map(p => p.id) || [];
      let rolesData: { user_id: string; role: string }[] = [];

      if (memberIds.length > 0) {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', memberIds);

        if (rolesError) throw rolesError;
        rolesData = roles || [];
      }

      // 4. Map roles for easy lookup
      const roleMap = new Map<string, AppRole>();
      rolesData.forEach(r => {
        if (r.user_id && r.role) {
          roleMap.set(r.user_id, r.role as AppRole);
        }
      });

      // 5. Build initial TeamMember list
      const allMembersMap = new Map<string, TeamMember>();
      const allMembers: TeamMember[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
        manager_id: profile.manager_id,
        created_at: profile.created_at,
        role: roleMap.get(profile.id) || 'bde',
        is_deactivated: (profile as any).is_deactivated ?? false,
        incentive_percent: (profile as any).incentive_percent ?? null,
      }));

      // Populate valid manager objects
      allMembers.forEach(m => {
        allMembersMap.set(m.id, m);
      });

      allMembers.forEach(m => {
        if (m.manager_id && allMembersMap.has(m.manager_id)) {
          const mgr = allMembersMap.get(m.manager_id)!;
          m.manager = {
            id: mgr.id,
            full_name: mgr.full_name
          };
        }
      });

      // 5. Filter based on Hierarchy
      //    If Company Admin => See everyone
      //    Else => See self + all descendants
      let visibleMembers: TeamMember[] = [];

      if (myRole === 'company') {
        visibleMembers = allMembers;
      } else {
        // Build adjacency list for the tree: manager_id -> [direct_reports]
        const reportsMap = new Map<string, string[]>();
        allMembers.forEach(m => {
          if (m.manager_id) {
            if (!reportsMap.has(m.manager_id)) {
              reportsMap.set(m.manager_id, []);
            }
            reportsMap.get(m.manager_id)?.push(m.id);
          }
        });

        // DFS to find all descendants
        const descendants = new Set<string>();
        const queue = [user.id];

        // Also include self
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

        // Filter and ensure visible members are updated if needed
        visibleMembers = allMembers.filter(m => descendants.has(m.id));
      }

      setMembers(visibleMembers);

    } catch (err) {
      console.error('Error fetching team:', err);
    }
    setLoading(false);
  }, [user]);

  const promoteUser = async (targetUserId: string, newRole: AppRole) => {
    if (!user || !currentUserRole) {
      return { error: new Error('Not authenticated') };
    }

    // Check if current user can promote to this role
    const currentLevel = ROLE_LEVELS[currentUserRole];
    const targetLevel = ROLE_LEVELS[newRole];

    if (currentLevel >= targetLevel) {
      return { error: new Error('You can only assign roles below your level') };
    }

    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', targetUserId);

    if (!error) {
      setMembers(prev => prev.map(m =>
        m.id === targetUserId ? { ...m, role: newRole } : m
      ));
    }

    return { error };
  };

  const setManager = async (userId: string, managerId: string | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ manager_id: managerId })
      .eq('id', userId);

    if (!error) {
      await fetchTeam();
    }

    return { error };
  };

  const getRoleLabel = (role: AppRole) => {
    const label = roleLabels[role];
    // If it's an empty string, return it as is (so we can filter it out in UI)
    if (label === '') return '';
    return label || role;
  };

  const getAssignableRoles = (): AppRole[] => {
    if (!currentUserRole) return [];
    const currentLevel = ROLE_LEVELS[currentUserRole];

    // Legacy keys to filter out from dropdowns to avoid duplicates
    const legacyKeys = new Set(['cbo', 'vp', 'avp', 'dgm', 'agm', 'sm', 'tl', 'bde', 'intern', 'ca']);

    return (Object.entries(ROLE_LEVELS) as [AppRole, number][])
      .filter(([role, level]) => {
        if (legacyKeys.has(role)) return false;
        return level > currentLevel;
      })
      .sort((a, b) => a[1] - b[1])
      .map(([role]) => role);
  };

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const deleteMember = async (targetUserId: string, reassignToId: string | null = null) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Optimistic update - remove immediately from UI
    const previousMembers = members;
    setMembers(prev => prev.filter(m => m.id !== targetUserId));

    const { data, error: funcError } = await supabase.functions.invoke('delete-team-member', {
      body: { targetUserId, reassignToId }
    });

    if (funcError || data?.error) {
      // Rollback on error
      setMembers(previousMembers);
      return { error: funcError || new Error(data?.error) };
    }

    return { error: null };
  };

  const toggleMemberStatus = async (targetUserId: string, deactivate: boolean) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Optimistic update
    const previousMembers = members;
    setMembers(prev => prev.map(m =>
      m.id === targetUserId ? { ...m, is_deactivated: deactivate } : m
    ));

    const { data, error: funcError } = await supabase.functions.invoke('toggle-user-status', {
      body: { targetUserId, deactivate }
    });

    if (funcError || data?.error) {
      // Rollback
      setMembers(previousMembers);
      return { error: funcError || new Error(data?.error) };
    }

    return { error: null };
  };

  const updateIncentive = async (targetUserId: string, percent: number | null) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update({ incentive_percent: percent })
      .eq('id', targetUserId);

    if (!error) {
      setMembers(prev => prev.map(m =>
        m.id === targetUserId ? { ...m, incentive_percent: percent } : m
      ));
    }

    return { error };
  };

  const addMemberOptimistic = (newMember: TeamMember) => {
    setMembers(prev => [...prev, newMember]);
  };

  const removeMemberOptimistic = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const replaceMemberOptimistic = (tempId: string, member: TeamMember) => {
    setMembers(prev => prev.map(m => (m.id === tempId ? member : m)));
  };

  return {
    members,
    loading,
    currentUserRole,
    promoteUser,
    deleteMember,
    toggleMemberStatus,
    updateIncentive,
    setManager,
    getRoleLabel,
    getAssignableRoles,
    refetch: fetchTeam,
    roleLabels,
    addMemberOptimistic,
    removeMemberOptimistic,
    replaceMemberOptimistic,
  };
}
