/**
 * emailAIService.ts — Gemini-powered AI for email campaign generation
 *
 * Uses the Gemini API key stored in `integration_api_keys` to generate
 * high-converting drip campaign sequences.
 */

import { supabase } from '@/integrations/supabase/client';
import { getGeminiKey, callGemini, cleanAIResponse } from './aiUtils';

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

    // Fetch company details
    const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', params.companyId)
        .single();

    const companyName = companyData?.name || 'FastestCRM Customer';

    const goalDescriptions: Record<string, string> = {
        sales: 'Close a sale or get them to purchase',
        meeting_booking: 'Book a meeting or demo call',
        app_download: 'Get them to download the app',
        other: 'Drive engagement and conversion',
    };

    const strategies = [
        "Introduction + value proposition",
        "Social proof / case study mention (sent if no reply to previous)",
        "Address objections (sent if no reply to previous)",
        "Create urgency with a time-sensitive offer",
        "Follow-up with a new perspective or benefit",
        "Gentle nudge / reminder",
        "Breakup email / last chance"
    ];

    const strategyList = Array.from({ length: steps }, (_, i) => {
        // Always use first strategy for step 1, last strategy for last step, and middle ones for the rest
        const strategyText = i === 0 ? strategies[0] : (i === steps - 1 ? strategies[strategies.length - 1] : strategies[Math.min(i, strategies.length - 2)]);
        return `   - Email ${i + 1}: ${strategyText}`;
    }).join('\n');

    const prompt = `You are an elite email marketing strategist working for ${companyName}.
Your job is to generate cold outreach and drip campaigns with industry-leading open rates (40%+) and reply rates (10%+).

## Campaign Brief
- **Company**: ${companyName}
- **Goal**: ${goalDescriptions[params.campaignGoal] || params.campaignGoal}
- **Campaign Perspective**: ${params.perspective}
${params.productInfo ? `- **Product/Service**: ${params.productInfo}` : ''}
${params.targetAudience ? `- **Target Audience**: ${params.targetAudience}` : ''}
- **Tone**: ${params.tone || 'Professional but approachable'}

## Requirements
Generate a ${steps}-step drip email campaign. For each email:
1. **Subject lines**: Short (5-8 words), curiosity-driven, NO spam words. Use personalization with %name% where appropriate.
2. **Body**: Keep it concise (50-150 words per email). Use ONLY these personalization variables: %name%, %company%, %email%. 
3. **CRITICAL**: Do NOT use any placeholders in brackets like [Your Name], [Company Name], or [Link]. Replace them with the actual information provided above or use the variables %name% and %company%. The emails must be ready to send immediately.
4. **HTML Formatting**: Use professional, production-ready HTML. Use button styling (rounded corners, solid background color, padding) for call to action links. Wrap the content in a clean div with 'font-family: sans-serif; line-height: 1.6; color: #1a1a1a;'. Use '<p>' tags for paragraphs, '<strong>' for emphasis, and styled '<a>' tags for links (e.g., 'color: #2563eb; font-weight: 600; text-decoration: underline;').
5. **Strategy**:
${strategyList}

## Output Format
Return ONLY a valid JSON array. Each element must have exactly these fields:
\`\`\`json
[
  {
    "step_number": 1,
    "subject": "Subject line here",
    "body_html": "<div style=\"font-family: sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px;\"><p>Hi %name%,</p><p>Professional email content here...</p><p><a href=\"https://example.com\" style=\"color: #2563eb; font-weight: 600;\">Call to Action Link</a></p><p>Best regards,<br>The %company% Team</p></div>",
    "body_text": "Plain text version of the email",
    "delay_after_ms": 86400000,
    "send_condition": "always"
  }
]
\`\`\`

delay_after_ms values: 0 for first email, 86400000 (24h) for follow-ups, 172800000 (48h) for later ones.
send_condition: "always" for first email, "if_no_reply" for follow-ups.

Return ONLY the JSON array, no markdown fences, no explanations.
`;

    const cleaned = await callGemini({ apiKey, prompt });
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

// ─── Agentic Drip (Lead-Context Generation) ──────────────────────────────────

export async function generateAgenticReply(params: {
    companyId: string;
    lead: any;
    instructions: string;
    context?: string;
}): Promise<{ subject: string; body_html: string; body_text: string }> {
    const apiKey = await getGeminiKey(params.companyId);

    const prompt = `You are a high-performance sales agent. Craft a personalized follow-up email for this lead.
    
## Lead Profile
- Name: ${params.lead.name || 'Unknown'}
- Email: ${params.lead.email || 'Unknown'}
- Interest: ${params.lead.property_name || params.lead.product_purchased || 'General Interest'}
- Budget: ${params.lead.budget_max || 'Flexible'}

## Recent History / Context
${params.context || 'No previous interaction history available.'}

## Your Specific Goal for this Email
${params.instructions}

## Requirements
- Reference at least one detail from their profile or history to show it's not a template.
- Tone should be professional, empathetic, and low-pressure.
- Keep it under 100 words.
- Use placeholders like %name% if you want to be safe, but you have the real name above.

Return ONLY valid JSON:
{
  "subject": "Compelling subject line",
  "body_html": "<p>HTML body with standard formatting</p>",
  "body_text": "Plain text version"
}
`;

    const cleaned = await callGemini({ apiKey, prompt });
    return JSON.parse(cleaned);
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

    const cleaned = await callGemini({ apiKey, prompt });
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

    const cleaned = await callGemini({ apiKey, prompt });
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

    const cleaned = await callGemini({ apiKey, prompt });
    return JSON.parse(cleaned);
}
