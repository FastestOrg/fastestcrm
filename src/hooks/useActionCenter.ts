import { useMemo } from 'react';
import { Lead } from './useLeads';
import { calculateLeadScore } from './useLeadScoring';
import { differenceInDays } from 'date-fns';

export interface ActionItem {
    id: string;
    type: 'momentum' | 'risk' | 'opportunity';
    title: string;
    description: string;
    leadName: string;
    leadId: string;
    suggestedAction: string;
    score: number;
}

export function useActionCenter(leads: Lead[]) {
    return useMemo(() => {
        const actions: ActionItem[] = [];
        const now = new Date();

        leads.forEach(lead => {
            const { score, level } = calculateLeadScore(lead);
            const daysSinceUpdate = differenceInDays(now, new Date(lead.updated_at));
            const status = lead.status?.toLowerCase();

            // 1. RISK: Hot Lead Stalling
            if (level === 'hot' && daysSinceUpdate >= 2 && status !== 'paid' && status !== 'dropped') {
                actions.push({
                    id: `risk-${lead.id}`,
                    type: 'risk',
                    title: 'Hot Lead Stalling',
                    description: `High-intent lead "${lead.name}" hasn't been contacted in ${daysSinceUpdate} days.`,
                    leadName: lead.name,
                    leadId: lead.id,
                    suggestedAction: 'Send a quick WhatsApp nudge.',
                    score
                });
            }

            // 2. OPPORTUNITY: High Score + No Product
            if (score >= 60 && !lead.product_purchased && status === 'interested') {
                actions.push({
                    id: `opp-${lead.id}`,
                    type: 'opportunity',
                    title: 'Missing Solution',
                    description: `Interested lead "${lead.name}" hasn't been mapped to a product yet.`,
                    leadName: lead.name,
                    leadId: lead.id,
                    suggestedAction: 'Link a product to generate an invoice.',
                    score
                });
            }

            // 3. MOMENTUM: High Engagement
            if (lead.lead_history && lead.lead_history.length > 5 && daysSinceUpdate <= 1 && status !== 'paid') {
                actions.push({
                    id: `mom-${lead.id}`,
                    type: 'momentum',
                    title: 'High Momentum',
                    description: `"${lead.name}" is highly engaged with 5+ recent interactions.`,
                    leadName: lead.name,
                    leadId: lead.id,
                    suggestedAction: 'Move to Negotiation / Site Visit.',
                    score
                });
            }
            
            // 4. RISK: Follow-up Overdue
            if (lead.reminder_at && new Date(lead.reminder_at) < now && status !== 'paid') {
                actions.push({
                    id: `followup-${lead.id}`,
                    type: 'risk',
                    title: 'Overdue Follow-up',
                    description: `Scheduled contact with "${lead.name}" was missed.`,
                    leadName: lead.name,
                    leadId: lead.id,
                    suggestedAction: 'Call immediately.',
                    score
                });
            }
        });

        // Sort by lead score and type (Risk first)
        return actions.sort((a, b) => {
            if (a.type === 'risk' && b.type !== 'risk') return -1;
            if (b.type === 'risk' && a.type !== 'risk') return 1;
            return b.score - a.score;
        }).slice(0, 5); // Max 5 actionable items
    }, [leads]);
}
