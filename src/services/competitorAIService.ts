import { supabase } from '@/integrations/supabase/client';

export interface BattleCard {
    competitor: string;
    quick_pitch: string[];
    objections: { trigger: string; response: string }[];
    our_edge: string[];
    their_flaws: string[];
}

import { getGeminiKey, callGemini } from './aiUtils';

// ─── Battle Card Generation ──────────────────────────────────────────────────

export async function generateBattleCard(params: {
    companyId: string;
    leadId: string;
    competitorName: string;
}): Promise<BattleCard> {
    const apiKey = await getGeminiKey(params.companyId);

    // Fetch Lead Context
    const { data: lead } = await supabase
        .from('leads')
        .select('name, industry, company_name, product_purchased, notes')
        .eq('id', params.leadId)
        .single();

    // Fetch Company Product Context (if any)
    const { data: products } = await supabase
        .from('products')
        .select('name, category, metadata')
        .eq('company_id', params.companyId)
        .limit(5);

    const productContext = products?.map(p => `- ${p.name} (${p.category}): ${JSON.stringify(p.metadata)}`).join('\n') || 'Generic CRM/Platform';

    const prompt = `You are a world-class Sales Enablement expert. Generate a "Battle Card" to help a sales rep win a deal against a specific competitor.

## Context
- **Lead Name**: ${lead?.name || 'Unknown'}
- **Industry**: ${lead?.industry || 'General'}
- **Our Solution**: ${lead?.product_purchased || 'Our Core Platform'}
- **Our Key Product Features**:
${productContext}

## The Competitor
- **Name**: ${params.competitorName}

## Requirements
- Tone: Aggressive but professional.
- Focus on: Speed, ease of use (mobile-first), and the "Indian Market" localized advantages (like UPI/WhatsApp).
- Scripts: Short, punchy "Kill Scripts" for objection handling.

Return ONLY valid JSON:
{
  "competitor": "${params.competitorName}",
  "quick_pitch": ["Point 1", "Point 2", "Point 3"],
  "objections": [
    { "trigger": "Competitor is cheaper", "response": "Handle it..." },
    { "trigger": "We already use Competitor", "response": "Handle it..." }
  ],
  "our_edge": ["Feature A", "Feature B"],
  "their_flaws": ["Weakness X", "Weakness Y"]
}
`;

    const cleaned = await callGemini({ apiKey, prompt });
    return JSON.parse(cleaned);
}
