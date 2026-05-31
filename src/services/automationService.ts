
import { supabase } from '@/integrations/supabase/client';
import { generateAgenticReply } from './emailAIService';
import { getLeadsTableName } from '@/lib/leadsTableUtils';

export type TriggerType = 'lead_created' | 'status_changed' | 'tag_added' | 'form_submitted';
export type ActionType = 'send_email' | 'webhook' | 'create_task' | 'assign_lead' | 'ai_personalized_followup' | 'ai_call';

export interface Automation {
    id: string;
    company_id?: string;
    name: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, any>;
    action_type: ActionType;
    action_config: Record<string, any>; // { distribution_logic: 'round_robin' | 'random', target_users: string[] }
    is_active: boolean;
    created_at: string;
}

export interface CreateAutomationParams {
    name: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, any>;
    action_type: ActionType;
    action_config: Record<string, any>;
}

export const automationService = {
    async getAutomations() {
        const { data, error } = await (supabase
            .from('automations' as any)
            .select('*')
            .order('created_at', { ascending: false }) as any);

        if (error) throw error;
        return data as Automation[];
    },

    async createAutomation(params: CreateAutomationParams) {
        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error('User not authenticated');

        // Get user's company_id from profiles table
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', userData.user.id)
            .single();

        if (profileError || !profileData?.company_id) {
            throw new Error('Company not found for user');
        }

        const { data, error } = await (supabase
            .from('automations' as any)
            .insert({
                name: params.name,
                trigger_type: params.trigger_type,
                trigger_config: params.trigger_config,
                action_type: params.action_type,
                action_config: params.action_config,
                user_id: userData.user.id,
                company_id: profileData.company_id
            })
            .select()
            .single() as any);

        if (error) throw error;
        return data as Automation[];
    },

    async updateAutomation(id: string, updates: Partial<Automation>) {
        const { data, error } = await (supabase
            .from('automations' as any)
            .update(updates)
            .eq('id', id)
            .select()
            .single() as any);

        if (error) throw error;
        return data as Automation;
    },

    async deleteAutomation(id: string) {
        const { error } = await (supabase
            .from('automations' as any)
            .delete()
            .eq('id', id) as any);

        if (error) throw error;
    },

    async toggleAutomation(id: string, currentState: boolean) {
        return this.updateAutomation(id, { is_active: !currentState });
    },

    async getIntegrationKey(serviceName: string) {
        const { data, error } = await (supabase
            .from('integration_api_keys' as any)
            .select('api_key')
            .eq('service_name', serviceName)
            .eq('is_active', true)
            .single() as any);

        if (error || !data) return null;
        return data.api_key;
    },

    async checkAndRunAutomations(triggerType: TriggerType, data: any) {
        // 1. Fetch active automations for this trigger
        const { data: automations, error } = await (supabase
            .from('automations' as any)
            .select('*')
            .eq('trigger_type', triggerType)
            .eq('is_active', true) as any);

        if (error) {
            console.error('Failed to fetch automations', error);
            return;
        }



        // 2. Filter and Execute
        for (const auto of automations as Automation[]) {
            if (this.shouldRun(auto, data)) {
                await this.executeAction(auto, data);
            }
        }
    },

    shouldRun(auto: Automation, data: any): boolean {
        if (auto.trigger_type === 'lead_created') {
            return true;
        }
        if (auto.trigger_type === 'status_changed') {
            const toStatus = auto.trigger_config?.to_status;
            if (toStatus && data.status === toStatus) {
                return true;
            }
            return false;
        }
        return false;
    },

    async executeAction(auto: Automation, data: any) {
        const companyId = data.company_id || auto.company_id;
        if (!companyId) {
            console.error('No company_id found for lead automation');
            return;
        }

        const tableName = await getLeadsTableName(companyId);

        // Build select query with dynamic foreign key reference if standard table, else fallback
        let selectStr = '*';
        if (tableName === 'leads') {
            selectStr = '*, sales_owner:profiles!leads_sales_owner_id_fkey(full_name)';
        } else if (tableName === 'leads_real_estate') {
            selectStr = '*, sales_owner:profiles!leads_real_estate_sales_owner_id_fkey(full_name)';
        } else if (tableName === 'leads_travel') {
            selectStr = '*, sales_owner:profiles!leads_travel_sales_owner_id_fkey(full_name)';
        } else if (tableName === 'leads_saas') {
            selectStr = '*, sales_owner:profiles!leads_saas_sales_owner_id_fkey(full_name)';
        } else if (tableName === 'leads_insurance') {
            selectStr = '*, sales_owner:profiles!leads_insurance_sales_owner_id_fkey(full_name)';
        } else if (tableName === 'leads_healthcare') {
            selectStr = '*, sales_owner:profiles!leads_healthcare_sales_owner_id_fkey(full_name)';
        }

        // Fetch full lead data to get history and other details
        const { data: lead, error: leadError } = await supabase
            .from(tableName as any)
            .select(selectStr)
            .eq('id', data.id)
            .single() as any;

        if (leadError) {
            console.error('Failed to fetch lead for automation', leadError);
            return;
        }

        // Robust fallback for sales_owner name resolving (especially on custom tables)
        if (lead && lead.sales_owner_id && !lead.sales_owner) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', lead.sales_owner_id)
                .single();
            if (profile) {
                lead.sales_owner = { full_name: profile.full_name };
            }
        }

        const logEntry = {
            automation_id: auto.id,
            status: 'pending',
            logs: `Started at ${new Date().toISOString()}`
        };

        // Create initial log
        const { data: logData, error: logError } = await (supabase
            .from('automation_logs' as any)
            .insert(logEntry)
            .select()
            .single() as any);

        if (logError) console.error('Failed to create log', logError);

        try {
            if (auto.action_type === 'send_email') {

                // Automated email sending is handled by the notify_lead_owner database-level trigger or equivalent service.
            } else if (auto.action_type === 'ai_personalized_followup') {
                const instructions = auto.action_config?.instructions || 'Follow up with the lead about their interest.';
                
                // Get lead history as context
                const context = lead.lead_history && Array.isArray(lead.lead_history)
                    ? lead.lead_history.slice(-5).map((h: any) => `[${h.timestamp || h.date_time || ''}] ${h.type || h.action || 'Event'}: ${h.details || h.text || ''}`).join('\n')
                    : 'New lead, no history.';

                // Generate Reply
                const aiReply = await generateAgenticReply({
                    companyId: lead.company_id,
                    lead: lead,
                    instructions: instructions,
                    context: context
                });

                // Get owner email account
                const { data: account } = await supabase
                    .from('email_accounts' as any)
                    .select('*')
                    .eq('user_id', lead.sales_owner_id)
                    .eq('status', 'connected')
                    .limit(1)
                    .maybeSingle() as any;

                if (!account) {
                    throw new Error('No connected email account found for lead owner');
                }

                // Send via Edge Function
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;

                const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/fastsend-account`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'test_send',
                        accountId: account.id,
                        to: lead.email,
                        subject: aiReply.subject,
                        body: aiReply.body_html
                    }),
                });

                const sendResult = await res.json();
                if (sendResult.error) throw new Error(sendResult.error);

            } else if (auto.action_type === 'ai_call' as any) {
                // AI Caller: enqueue call (FIFO queue — processed sequentially via Edge Function)
                const agentId = auto.action_config?.agent_id;
                if (!agentId) {
                    throw new Error('No AI agent configured for this automation');
                }

                const phone = lead.phone || lead.mobile_number || lead.whatsapp_number;
                if (!phone) {
                    throw new Error('Lead has no phone number for AI call');
                }

                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;

                const res = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-ai-call`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            lead_id: lead.id,
                            lead_phone: phone,
                            lead_name: lead.name,
                            agent_id: agentId,
                            automation_id: auto.id,
                            company_id: lead.company_id,
                        }),
                    }
                );

                const callResult = await res.json();
                if (!res.ok) throw new Error(callResult?.error || 'Failed to queue AI call');

            } else if (auto.action_type === 'whatsapp' as any) {
                const apiKey = await this.getIntegrationKey('whatsapp');
                if (!apiKey) {
                    throw new Error('WhatsApp integration not connected');
                }
                const message = auto.action_config?.template?.replace('{{name}}', data.name || 'User');

                // Simulate API call
            }

            if (logData) {
                await (supabase.from('automation_logs' as any).update({ status: 'success', logs: 'Completed successfully' }).eq('id', logData.id) as any);
            }

        } catch (err: any) {
            console.error('Automation failed', err);
            if (logData) {
                await (supabase.from('automation_logs' as any).update({ status: 'failed', logs: `Error: ${err.message}` }).eq('id', logData.id) as any);
            }
        }
    }
};
