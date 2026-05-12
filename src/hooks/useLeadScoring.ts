import { useMemo } from 'react';
import { Lead } from './useLeads';

export type PriorityLevel = 'hot' | 'warm' | 'cold';

export interface ScoringResult {
    score: number;
    level: PriorityLevel;
    breakdown: {
        profile: number;
        engagement: number;
        status: number;
    };
}

/**
 * Core scoring logic used by both hooks and services
 */
export function calculateLeadScore(lead: Lead) {
    // 1. Profile Strength (Max 30)
    let profileScore = 0;
    if (lead.phone) profileScore += 10;
    if (lead.email) profileScore += 5;
    if (lead.name && lead.name !== 'Unknown') profileScore += 5;
    if (lead.product_purchased || (lead as any).product_category) profileScore += 10;
    
    // 2. Status/Momentum Factor (Max 40)
    let statusScore = 0;
    const status = lead.status?.toLowerCase();
    const highIntent = ['negotiation', 'site_visit', 'sent_proposal', 'interested'];
    const midIntent = ['follow_up', 'contacted', 'qualified'];
    
    if (status === 'paid') statusScore = 40;
    else if (highIntent.includes(status)) statusScore = 30;
    else if (midIntent.includes(status)) statusScore = 15;
    else statusScore = 5;

    // 3. Engagement Heuristic (Max 30)
    let engagementScore = 0;
    if (lead.lead_history && Array.isArray(lead.lead_history)) {
        engagementScore = Math.min(lead.lead_history.length * 5, 30);
    }

    const totalScore = Math.min(profileScore + statusScore + engagementScore, 100);
    
    let level: PriorityLevel = 'cold';
    if (totalScore >= 70) level = 'hot';
    else if (totalScore >= 35) level = 'warm';

    return {
        score: totalScore,
        level,
        breakdown: {
            profile: profileScore,
            engagement: engagementScore,
            status: statusScore
        }
    };
}

export function useLeadScoring(lead: Lead | null): ScoringResult {
    return useMemo(() => {
        if (!lead) return { score: 0, level: 'cold', breakdown: { profile: 0, engagement: 0, status: 0 } };
        return calculateLeadScore(lead);
    }, [lead]);
}

/**
 * Bulk version for lists
 */
export function useBulkLeadScoring(leads: Lead[]) {
    return useMemo(() => {
        return leads.map(lead => ({
            leadId: lead.id,
            ...calculateLeadScore(lead)
        }));
    }, [leads]);
}

// Deprecated: Alias for backward compatibility if needed, but redirects to new logic
export function calculatePriorityLevel(lead: Lead) {
    return calculateLeadScore(lead);
}
