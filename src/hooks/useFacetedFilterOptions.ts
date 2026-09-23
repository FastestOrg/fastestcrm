import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface UseFacetedFilterOptionsParams {
  orgClient: SupabaseClient<any> | null;
  tableName: string;
  companyId?: string;
  targetColumns: string[];
  activeFilters: Record<string, string[]>;
  activeOwnerIds?: string[];
  accessibleUserIds?: string[];
  canViewAll?: boolean;
  enabled?: boolean;
}

export function useFacetedFilterOptions({
  orgClient,
  tableName,
  companyId,
  targetColumns,
  activeFilters,
  activeOwnerIds,
  accessibleUserIds,
  canViewAll = true,
  enabled = true,
}: UseFacetedFilterOptionsParams) {
  // Count how many filters have selected values
  const activeKeys = Object.keys(activeFilters).filter(
    (k) => Array.isArray(activeFilters[k]) && activeFilters[k].length > 0
  );
  const hasActiveFilters = activeKeys.length > 0;

  // Normalized active filters object for query key and RPC
  const cleanActiveFilters: Record<string, string[]> = {};
  activeKeys.forEach((k) => {
    cleanActiveFilters[k] = activeFilters[k];
  });

  const queryKey = [
    'facetedFilterOptions',
    (orgClient as any)?.supabaseUrl || 'default',
    tableName,
    companyId,
    targetColumns.slice().sort().join(','),
    JSON.stringify(cleanActiveFilters),
    canViewAll,
    accessibleUserIds ? accessibleUserIds.slice().sort().join(',') : 'all',
    activeOwnerIds ? activeOwnerIds.slice().sort().join(',') : 'none',
  ];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Record<string, string[]>> => {
      if (!orgClient || !tableName || !hasActiveFilters) {
        return {};
      }

      // 1. Try high-performance PostgreSQL RPC
      try {
        const { data: rpcData, error: rpcError } = await (orgClient as any).rpc(
          'get_faceted_filter_options',
          {
            p_table_name: tableName,
            p_company_id: companyId || null,
            p_target_columns: targetColumns,
            p_filters: cleanActiveFilters,
            p_accessible_user_ids:
              !canViewAll && accessibleUserIds && accessibleUserIds.length > 0
                ? accessibleUserIds
                : null,
            p_active_owner_ids:
              activeOwnerIds && activeOwnerIds.length > 0
                ? activeOwnerIds
                : null,
          }
        );

        if (!rpcError && rpcData && typeof rpcData === 'object') {
          return rpcData as Record<string, string[]>;
        }
      } catch (rpcErr) {
        console.warn('[useFacetedFilterOptions] RPC failed, falling back to direct query:', rpcErr);
      }

      // 2. Client-side fallback for unmigrated BYOS hosts
      const fallbackResult: Record<string, string[]> = {};

      try {
        // Query target columns constrained by other active filters
        await Promise.all(
          targetColumns.map(async (col) => {
            // Check if other filters constrain this column
            const otherFilterKeys = activeKeys.filter(
              (k) =>
                k !== col &&
                !(k === 'owner' && col === 'sales_owner_id') &&
                !(k === 'sales_owner_id' && col === 'owner') &&
                !(k === 'product' && col === 'product_purchased') &&
                !(k === 'product_purchased' && col === 'product')
            );

            if (otherFilterKeys.length === 0) {
              return;
            }

            let query = orgClient
              .from(tableName as any)
              .select(col);

            if (col !== 'sales_owner_id') {
              query = query.not(col, 'is', null);
            }

            if (companyId) {
              query = query.eq('company_id', companyId);
            }

            if (!canViewAll && accessibleUserIds && accessibleUserIds.length > 0) {
              query = query.in('sales_owner_id', accessibleUserIds);
            }

            otherFilterKeys.forEach((otherKey) => {
              const vals = cleanActiveFilters[otherKey];
              if (!vals || vals.length === 0) return;

              const dbCol =
                otherKey === 'owner'
                  ? 'sales_owner_id'
                  : otherKey === 'product'
                  ? 'product_purchased'
                  : otherKey;

              if (dbCol === 'sales_owner_id') {
                const hasUnassigned = vals.includes('unassigned');
                const realIds = vals.filter((v) => v !== 'unassigned');
                if (hasUnassigned) {
                  if (activeOwnerIds && activeOwnerIds.length > 0) {
                    const activeIdList = activeOwnerIds.join(',');
                    if (realIds.length > 0) {
                      query = query.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList}),sales_owner_id.in.(${realIds.join(',')})`);
                    } else {
                      query = query.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList})`);
                    }
                  } else {
                    if (realIds.length > 0) {
                      query = query.or(`sales_owner_id.is.null,sales_owner_id.in.(${realIds.join(',')})`);
                    } else {
                      query = query.is('sales_owner_id', null);
                    }
                  }
                } else if (realIds.length > 0) {
                  query = query.in('sales_owner_id', realIds);
                }
              } else {
                if (vals.length === 1) {
                  query = query.eq(dbCol, vals[0]);
                } else {
                  query = query.in(dbCol, vals);
                }
              }
            });

            const { data, error } = await query.limit(500);
            if (!error && data) {
              if (col === 'sales_owner_id') {
                const activeSet = new Set(activeOwnerIds || []);
                let hasUnassignedLeads = false;
                const activeFoundIds = new Set<string>();

                (data as any[]).forEach((r) => {
                  const ownerId = r.sales_owner_id;
                  if (!ownerId || (activeOwnerIds && activeOwnerIds.length > 0 && !activeSet.has(ownerId))) {
                    hasUnassignedLeads = true;
                  } else if (ownerId && activeSet.has(ownerId)) {
                    activeFoundIds.add(String(ownerId));
                  }
                });

                const ownerValues = Array.from(activeFoundIds);
                if (hasUnassignedLeads) {
                  ownerValues.push('unassigned');
                }
                fallbackResult[col] = ownerValues;
              } else {
                const unique = Array.from(
                  new Set(
                    (data as any[])
                      .map((r) => r[col])
                      .filter((v) => v !== null && v !== undefined && v !== '')
                      .map((v) => String(v))
                  )
                ).sort();
                fallbackResult[col] = unique;
              }
            }
          })
        );
      } catch (fallbackErr) {
        console.error('[useFacetedFilterOptions] Fallback query error:', fallbackErr);
      }

      return fallbackResult;
    },
    enabled: enabled && !!orgClient && !!tableName && hasActiveFilters,
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
