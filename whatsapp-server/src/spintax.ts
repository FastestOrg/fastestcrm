/**
 * Spintax resolver & CRM variable substitution.
 *
 * Spintax:  {Hi|Hello|Hey} → picks one randomly
 * CRM Vars: %name% → replaced by lead_data.name
 */

/**
 * Resolve all {option1|option2|...} blocks in a string.
 */
export function resolveSpintax(text: string): string {
    return text.replace(/\{([^{}]+)\}/g, (_match, group: string) => {
        const options = group.split('|');
        return options[Math.floor(Math.random() * options.length)];
    });
}

/**
 * Replace all %fieldName% placeholders with values from lead data.
 * Unknown fields are left as-is.
 */
export function resolveVariables(text: string, leadData: Record<string, any>): string {
    return text.replace(/%([^%]+)%/g, (_match, field: string) => {
        const key = field.trim().toLowerCase();
        
        // Handle special aliases
        if (key === 'company' && leadData['company_name'] !== undefined && leadData['company_name'] !== null) {
            return String(leadData['company_name']);
        }
        if (key === 'company_name' && leadData['company'] !== undefined && leadData['company'] !== null) {
            return String(leadData['company']);
        }

        // Try exact match first, then case-insensitive search
        if (leadData[field] !== undefined && leadData[field] !== null) {
            return String(leadData[field]);
        }
        // Case-insensitive fallback
        const found = Object.entries(leadData).find(
            ([k]) => k.toLowerCase() === key
        );
        if (found && found[1] !== undefined && found[1] !== null) {
            return String(found[1]);
        }
        return _match; // Leave unresolved
    });
}

/**
 * Full message resolution: spintax first, then variables.
 */
export function resolveMessage(template: string, leadData: Record<string, any>): string {
    const afterSpintax = resolveSpintax(template);
    return resolveVariables(afterSpintax, leadData);
}
