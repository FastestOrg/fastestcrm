import { useQuery } from '@tanstack/react-query';
import { useCompany } from './useCompany';
import { supabase } from '@/integrations/supabase/client';
import { useOrgClient } from './useOrgClient';
import { useMemo } from 'react';

export interface CustomColumn {
  id: string;
  label: string;
  type: string;
}

const hiddenColumns = ['id', 'company_id', 'created_by_id', 'pre_sales_owner_id', 'sales_owner_id', 'post_sales_owner_id', 'embedding'];
const systemColumns = [
  'id', 'created_at', 'updated_at', 'company_id', 'created_by_id', 'name', 'email', 'phone', 'status',
  'sales_owner_id', 'notes', 'lead_source', 'next_follow_up', 'lead_score', 'custom_data', 'archived', 'payment_link',
  'college', 'product_category', 'product_purchased', 'whatsapp', 'revenue_projected', 'revenue_received',
  'reminder_at', 'send_web_push', 'last_notification_sent_at', 'pre_sales_owner_id', 'post_sales_owner_id', 'lead_history'
];

export function useCustomColumns(tableName: string = 'leads') {
  const { company } = useCompany();
  const { orgClient, isBYOSLoading } = useOrgClient();

  const { data: dbColumns = [], isLoading } = useQuery({
    queryKey: ['lead-columns', (orgClient as any)?.supabaseUrl || 'default', company?.id, tableName, company?.custom_leads_table],
    queryFn: async () => {
      if (!company?.id) return [];
      try {
        const targetTable = company?.custom_leads_table || tableName || 'leads';

        // 1. Try PostgreSQL RPC get_company_lead_columns
        let { data: rpcData, error: rpcError } = await (orgClient as any).rpc('get_company_lead_columns', {
          input_company_id: company.id
        });

        if ((rpcError || !rpcData || !Array.isArray(rpcData) || rpcData.length === 0) && orgClient !== supabase) {
          const mainRes = await supabase.rpc('get_company_lead_columns' as any, {
            input_company_id: company.id
          });
          if (!mainRes.error && mainRes.data && Array.isArray(mainRes.data) && mainRes.data.length > 0) {
            rpcData = mainRes.data;
            rpcError = null;
          }
        }

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const customRpcCols = rpcData
            .map((c: any) => c.column_name)
            .filter((k: string) => !hiddenColumns.includes(k) && !systemColumns.includes(k))
            .map((k: string) => ({
              column_name: k,
              data_type: 'text'
            }));

          return customRpcCols;
        }

        // 2. Fallback: Inspect actual lead record keys directly from database
        const { data, error } = await orgClient
          .from(targetTable as any)
          .select('*')
          .limit(5);

        if (!error && data && data.length > 0) {
          const keysSet = new Set<string>();
          const customDataKeysSet = new Set<string>();

          data.forEach((row: any) => {
            Object.keys(row).forEach((k) => {
              if (!hiddenColumns.includes(k) && !systemColumns.includes(k)) {
                keysSet.add(k);
              }
            });

            if (row.custom_data && typeof row.custom_data === 'object') {
              Object.keys(row.custom_data).forEach((ck) => {
                customDataKeysSet.add(ck);
              });
            }
          });

          const tableCols = Array.from(keysSet).map((k) => ({
            column_name: k,
            data_type: 'text'
          }));

          const jsonCols = Array.from(customDataKeysSet).map((ck) => ({
            column_name: ck,
            data_type: 'json_field'
          }));

          return [...tableCols, ...jsonCols];
        }

        return [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!company?.id && !isBYOSLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const customColumns = useMemo(() => {
    return dbColumns.map((col: any) => ({
      id: col.column_name,
      label: col.column_name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      type: col.data_type || 'text'
    }));
  }, [dbColumns]);

  return {
    customColumns,
    loading: isLoading
  };
}
