import { useQuery } from '@tanstack/react-query';
import { useCompany } from './useCompany';
import { supabase } from '@/integrations/supabase/client';
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
  'reminder_at', 'send_web_push', 'last_notification_sent_at', 'pre_sales_owner_id', 'post_sales_owner_id'
];

export function useCustomColumns() {
  const { company } = useCompany();

  const { data: dbColumns = [], isLoading } = useQuery({
    queryKey: ['lead-columns', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase.rpc('get_company_lead_columns' as any, {
        input_company_id: company.id
      });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!company?.id
  });

  const customColumns = useMemo(() => {
    return dbColumns
      .filter((col: any) => !hiddenColumns.includes(col.column_name) && !systemColumns.includes(col.column_name))
      .map((col: any) => ({
        id: col.column_name,
        label: col.column_name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        type: col.data_type
      }));
  }, [dbColumns]);

  return {
    customColumns,
    loading: isLoading
  };
}
