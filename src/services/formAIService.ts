import { supabase } from '@/integrations/supabase/client';

export interface ExtractedField {
    label: string;
    type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select';
    required: boolean;
    attribute: string;
    options?: string[];
}

import { getGeminiKey, callGemini } from './aiUtils';

export async function extractFieldsFromImage(params: {
    companyId: string;
    file: File;
    availableAttributes: { label: string; value: string }[];
}): Promise<ExtractedField[]> {
    const apiKey = await getGeminiKey(params.companyId);
    
    // Convert file to base64
    const base64Promise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(params.file);
    });
    
    const base64Data = await base64Promise;

    const prompt = `You are an expert UI/UX and Data Engineer. 
Analyze the attached image of a form and extract all the fields.
For each field, determine the label, the input type, and if it seems required.

## Mapping Instructions
Map each field to one of these available CRM database attributes if it fits:
${params.availableAttributes.map(a => `- ${a.label} (${a.value})`).join('\n')}

If no specific mapping fits, use an empty string for "attribute".

## Output Format
Return ONLY valid JSON:
[
  { "label": "Full Name", "type": "text", "required": true, "attribute": "name" },
  { "label": "Comments", "type": "textarea", "required": false, "attribute": "notes" }
]
`;

    const cleaned = await callGemini({
        apiKey,
        prompt,
        imageBase64: { data: base64Data, mimeType: params.file.type },
        temperature: 0.2
    });

    return JSON.parse(cleaned);
}
