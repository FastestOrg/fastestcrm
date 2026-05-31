import { TeamMember } from '@/hooks/useTeam';

export type LeadHistoryEntry = {
    action?: string;
    details?: string;
    text?: string;
    user_id?: string;
    user_name?: string;
    old_status?: string;
    new_status?: string;
    assignee_id?: string;
    timestamp?: string;
    date_time?: string;
};

/**
 * Formats a lead history entry into a human-readable string.
 * Supports both legacy text-based entries and new structured, UUID-based entries.
 */
export function formatLeadHistoryEntry(
    entry: LeadHistoryEntry,
    members: TeamMember[]
): string {
    // 1. If legacy pre-rendered fields are present, use them
    if (entry.text || entry.details) {
        return entry.text || entry.details || '';
    }

    // 2. Resolve actor username from UUID
    const actorName = entry.user_name || 
        (entry.user_id ? members.find(m => m.id === entry.user_id)?.full_name : null) || 
        'System';

    // 3. Resolve assignee username from UUID if present
    const assigneeName = entry.assignee_id ? 
        (members.find(m => m.id === entry.assignee_id)?.full_name || 'Unknown User') : 
        '';

    // Helper to format status names nicely
    const formatStatus = (status: string | undefined) => {
        if (!status) return 'New';
        return status.replace(/_/g, ' ');
    };

    switch (entry.action) {
        case 'create':
            return `Lead created by ${actorName}`;
        case 'status_change':
            return `${actorName} changed lead status from "${formatStatus(entry.old_status)}" to "${formatStatus(entry.new_status)}"`;
        case 'assign_pre_sales':
            return `Lead assigned to ${assigneeName} (Pre-Sales Owner) by ${actorName}`;
        case 'unassign_pre_sales':
            return `${actorName} removed Pre-Sales Owner assignment`;
        case 'assign_sales':
            return `Lead assigned to ${assigneeName} (Sales Owner) by ${actorName}`;
        case 'unassign_sales':
            return `${actorName} removed Sales Owner assignment`;
        case 'assign_post_sales':
            return `Lead assigned to ${assigneeName} (Post-Sales Owner) by ${actorName}`;
        case 'unassign_post_sales':
            return `${actorName} removed Post-Sales Owner assignment`;
        default:
            return entry.action ? `${actorName} performed action: ${entry.action}` : 'Unknown system action';
    }
}
