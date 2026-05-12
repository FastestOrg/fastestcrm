import { supabase } from '@/integrations/supabase/client';

/**
 * Metadata for tracking AI usage or errors
 */
export interface AIMetadata {
    service: 'email' | 'competitor' | 'form' | 'chat';
    companyId: string;
    model?: string;
}

/**
 * Retrieves the activated Gemini API key for a company
 */
export async function getGeminiKey(companyId: string): Promise<string> {
    // 1. Try fetching by company_id directly
    let { data: integration, error } = await supabase
        .from('integration_api_keys')
        .select('api_key')
        .eq('company_id', companyId)
        .eq('service_name', 'gemini')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching Gemini key:', error);
        throw new Error('Database error while retrieving AI key.');
    }

    // 2. Fallback to legacy user_id lookup
    if (!integration?.api_key) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('company_id', companyId);

        const userIds = profiles?.map((p: any) => p.id) || [];
        if (userIds.length > 0) {
            const { data: legacyKey } = await supabase
                .from('integration_api_keys')
                .select('api_key')
                .in('user_id', userIds)
                .eq('service_name', 'gemini')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();
            
            if (legacyKey) integration = legacyKey as any;
        }
    }

    if (!integration?.api_key) {
        throw new Error('No active Gemini API key found for your company. Please set it up in Settings.');
    }

    return integration.api_key;
}

/**
 * Cleans the LLM output by removing common markdown artifacts
 */
export function cleanAIResponse(text: string): string {
    return text
        .replace(/```(json|html|text|markdown)?\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
}

/**
 * Standardized call to Gemini 1.5 Flash
 */
export async function callGemini(params: {
    apiKey: string;
    prompt: string;
    imageBase64?: { data: string; mimeType: string };
    temperature?: number;
}): Promise<string> {
    const { apiKey, prompt, imageBase64, temperature = 0.2 } = params;

    const parts: any[] = [{ text: prompt }];
    if (imageBase64) {
        parts.push({
            inline_data: {
                mime_type: imageBase64.mimeType,
                data: imageBase64.data
            }
        });
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { 
                    temperature, 
                    topP: 0.8, 
                    maxOutputTokens: 2048 
                },
            }),
        }
    );

    const data = await res.json();
    
    if (data.error) {
        throw new Error(`Gemini API Error: ${data.error.message}`);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
        throw new Error('Gemini returned an empty response.');
    }

    return cleanAIResponse(content);
}
