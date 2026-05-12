import { useLeads } from './useLeads';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';

export const STATUS_PROBABILITIES: Record<string, number> = {
    'new': 0.1,
    'contacted': 0.2,
    'qualified': 0.3,
    'interested': 0.25,
    'follow_up': 0.4,
    'proposal_sent': 0.5,
    'negotiation': 0.7,
    'site_visit': 0.6,
    'paid': 1.0,
    'closed_lost': 0,
};

export function useForecast() {
    const { company } = useCompany();
    const { data: leadsData, isLoading: leadsLoading } = useLeads({ fetchAll: true });
    
    const { data: productsData, isLoading: productsLoading } = useQuery({
        queryKey: ['products-forecast', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('company_id', company.id);
            return data || [];
        },
        enabled: !!company?.id,
    });

    const isLoading = leadsLoading || productsLoading;

    const forecast = (() => {
        if (!leadsData?.leads || !productsData) return null;

        const leads = leadsData.leads;
        const productsMap = new Map(productsData.map(p => [p.name, p.price]));

        let totalPotential = 0;
        let expectedRevenue = 0;
        let closedRevenue = 0;

        const pipelineByStatus: Record<string, { total: number; expected: number }> = {};

        leads.forEach(lead => {
            const price = productsMap.get(lead.product_purchased || '') || 0;
            const probability = STATUS_PROBABILITIES[lead.status?.toLowerCase() || 'new'] || 0.1;

            const leadPotential = price || lead.revenue_received || 0;
            const leadExpected = leadPotential * probability;

            totalPotential += leadPotential;
            expectedRevenue += leadExpected;
            
            if (lead.status === 'paid') {
                closedRevenue += (lead.revenue_received || price || 0);
            }

            const status = lead.status || 'unknown';
            if (!pipelineByStatus[status]) {
                pipelineByStatus[status] = { total: 0, expected: 0 };
            }
            pipelineByStatus[status].total += leadPotential;
            pipelineByStatus[status].expected += leadExpected;
        });

        return {
            totalPotential,
            expectedRevenue,
            closedRevenue,
            pipelineByStatus: Object.entries(pipelineByStatus).map(([name, data]) => ({
                name: name.replace(/_/g, ' ').toUpperCase(),
                ...data
            })).sort((a, b) => b.total - a.total),
            conversionRate: leads.length > 0 ? (leads.filter(l => l.status === 'paid').length / leads.length) * 100 : 0,
        };
    })();

    return {
        data: forecast,
        isLoading
    };
}
