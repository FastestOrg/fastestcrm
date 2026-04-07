/**
 * emailAIService.ts — Gemini-powered AI for email campaign generation
 *
 * Uses the Gemini API key stored in `integration_api_keys` to generate
 * high-converting drip campaign sequences.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getGeminiKey(companyId: string): Promise<string> {
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId);

    const userIds = profiles?.map((p: any) => p.id) || [];
    if (userIds.length === 0) throw new Error('No users found for company');

    const { data: integration } = await supabase
        .from('integration_api_keys')
        .select('api_key')
        .in('user_id', userIds)
        .eq('service_name', 'gemini')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (!integration?.api_key) {
        throw new Error('Gemini API key not found. Please add it in Integrations → Google Gemini AI.');
    }

    return integration.api_key;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.9,
                    maxOutputTokens: 8192,
                },
            }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error('Gemini API Error: ' + (err.error?.message || res.statusText));
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response generated from Gemini.');
    return text.trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedEmail {
    step_number: number;
    subject: string;
    body_html: string;
    body_text: string;
    delay_after_ms: number;
    send_condition: 'always' | 'if_no_reply' | 'if_no_open';
}

export interface CampaignGenerationParams {
    companyId: string;
    campaignGoal: 'sales' | 'meeting_booking' | 'app_download' | 'other';
    perspective: string;       // user's description of what the campaign is about
    productInfo?: string;      // optional product/service details
    targetAudience?: string;   // who are the leads
    numberOfSteps?: number;    // default: 5
    tone?: string;             // professional, friendly, casual
}

// ─── Agentic Mode (Full Campaign Generation) ──────────────────────────────────

export async function generateFullDripCampaign(
    params: CampaignGenerationParams
): Promise<GeneratedEmail[]> {
    const apiKey = await getGeminiKey(params.companyId);
    const steps = params.numberOfSteps || 5;

    const goalDescriptions: Record<string, string> = {
        sales: 'Close a sale or get them to purchase',
        meeting_booking: 'Book a meeting or demo call',
        app_download: 'Get them to download the app',
        other: 'Drive engagement and conversion',
    };

    const prompt = `You are an elite email marketing strategist specializing in cold outreach and drip campaigns with industry-leading open rates (40%+) and reply rates (10%+).

## Campaign Brief
- **Goal**: ${goalDescriptions[params.campaignGoal] || params.campaignGoal}
- **Campaign Perspective**: ${params.perspective}
${params.productInfo ? `- **Product/Service**: ${params.productInfo}` : ''}
${params.targetAudience ? `- **Target Audience**: ${params.targetAudience}` : ''}
- **Tone**: ${params.tone || 'Professional but approachable'}

## Requirements
Generate a ${steps}-step drip email campaign. For each email:
1. **Subject lines**: Short (5-8 words), curiosity-driven, NO spam words (free, guaranteed, act now). Use personalization with %name% where appropriate.
2. **Body**: Keep it concise (50-150 words per email). Use personalization variables: %name%, %company%, %email%. Write in plain conversational tone. Include a clear CTA matching the goal.
3. **Strategy**:
   - Email 1: Introduction + value proposition
   - Email 2: Social proof / case study mention (sent if no reply to #1)
   - Email 3: Address objections (sent if no reply to #2)
   - Email 4: Create urgency with a time-sensitive offer
   - Email 5: Breakup email / last chance

## Output Format
Return ONLY a valid JSON array. Each element must have exactly these fields:
\`\`\`json
[
  {
    "step_number": 1,
    "subject": "Subject line here",
    "body_html": "<p>HTML email body with <strong>formatting</strong></p>",
    "body_text": "Plain text version of the email",
    "delay_after_ms": 86400000,
    "send_condition": "always"
  }
]
\`\`\`

delay_after_ms values: 0 for first email, 86400000 (24h) for follow-ups, 172800000 (48h) for later ones.
send_condition: "always" for first email, "if_no_reply" for follow-ups.

Return ONLY the JSON array, no markdown fences, no explanations.`;

    const raw = await callGemini(apiKey, prompt);

    // Parse JSON (strip any markdown fences the model might add)
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
        const emails: GeneratedEmail[] = JSON.parse(cleaned);
        return emails.map((e, i) => ({
            step_number: i + 1,
            subject: e.subject || `Follow-up ${i + 1}`,
            body_html: e.body_html || `<p>${e.body_text || ''}</p>`,
            body_text: e.body_text || '',
            delay_after_ms: e.delay_after_ms || (i === 0 ? 0 : 86400000),
            send_condition: e.send_condition || (i === 0 ? 'always' : 'if_no_reply'),
        }));
    } catch {
        throw new Error('AI returned invalid JSON. Please try again.');
    }
}

// ─── Guided Mode (Single Email Generation) ────────────────────────────────────

export async function generateNextEmail(params: {
    companyId: string;
    campaignGoal: string;
    previousEmails: Array<{ subject: string; body_text: string }>;
    userInstruction: string;
    stepNumber: number;
}): Promise<GeneratedEmail> {
    const apiKey = await getGeminiKey(params.companyId);

    const prevContext = params.previousEmails.length > 0
        ? `\n\nPrevious emails in this sequence:\n${params.previousEmails.map((e, i) =>
            `Email ${i + 1} - Subject: "${e.subject}"\n${e.body_text}`
        ).join('\n\n')}`
        : '';

    const prompt = `You are an email marketing expert. Generate the next email in a drip campaign sequence.

Campaign goal: ${params.campaignGoal}
This is email #${params.stepNumber} in the sequence.
User instruction: ${params.userInstruction}
${prevContext}

Generate a single email that naturally follows the sequence. Use personalization: %name%, %company%.

Return ONLY valid JSON (no markdown fences):
{
  "step_number": ${params.stepNumber},
  "subject": "Short subject line",
  "body_html": "<p>HTML body</p>",
  "body_text": "Plain text body",
  "delay_after_ms": 86400000,
  "send_condition": "${params.stepNumber === 1 ? 'always' : 'if_no_reply'}"
}`;

    const raw = await callGemini(apiKey, prompt);
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
}

// ─── Improve Existing Email ───────────────────────────────────────────────────

export async function improveEmailCopy(params: {
    companyId: string;
    subject: string;
    bodyHtml: string;
    goal: string;
}): Promise<{ subject: string; body_html: string; body_text: string }> {
    const apiKey = await getGeminiKey(params.companyId);

    const prompt = `You are an expert email copywriter. Rewrite this email for maximum open rate and reply rate.

Campaign Goal: ${params.goal}
Current Subject: ${params.subject}
Current Body: ${params.bodyHtml}

Rules:
- Make subject line shorter, more curiosity-driven
- Tighten the body copy, remove fluff
- Add stronger CTA
- Keep personalization variables (%name%, %company%) intact

Return ONLY valid JSON (no markdown fences):
{
  "subject": "Improved subject",
  "body_html": "<p>Improved HTML body</p>",
  "body_text": "Improved plain text"
}`;

    const raw = await callGemini(apiKey, prompt);
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
}

// ─── Subject Line Variants ────────────────────────────────────────────────────

export async function generateSubjectLineVariants(params: {
    companyId: string;
    currentSubject: string;
    emailBody: string;
}): Promise<string[]> {
    const apiKey = await getGeminiKey(params.companyId);

    const prompt = `Generate 5 A/B test subject line variants for this email.

Current subject: "${params.currentSubject}"
Email body preview: ${params.emailBody.substring(0, 300)}

Rules: Each subject should be 5-8 words, curiosity-driven, no spam words. Use %name% for personalization in at least 2 variants.

Return ONLY a JSON array of strings, no markdown fences:
["Subject 1", "Subject 2", "Subject 3", "Subject 4", "Subject 5"]`;

    const raw = await callGemini(apiKey, prompt);
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
}
