import { supabase } from '@/integrations/supabase/client';
import { generateAgenticReply } from './emailAIService';
import { getLeadsTableName } from '@/lib/leadsTableUtils';

export type TriggerType = 'lead_created' | 'status_changed' | 'tag_added' | 'form_submitted';
export type ActionType =
    | 'send_whatsapp'
    | 'send_email'
    | 'ai_personalized_followup'
    | 'ai_call'
    | 'assign_lead'
    | 'update_status'
    | 'webhook'
    | 'create_task'
    | 'whatsapp';

export interface WorkflowStep {
    id: string;
    step_type: 'action' | 'delay' | 'condition';
    name?: string;
    // Action details
    action_type?: ActionType;
    action_config?: Record<string, any>;
    // Delay details (e.g. wait 2 days)
    delay?: {
        amount: number;
        unit: 'minutes' | 'hours' | 'days';
    };
    // Condition details (e.g. status == 'new')
    condition?: {
        field: string;
        operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
        value: string;
    };
}

export interface Automation {
    id: string;
    company_id?: string;
    name: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, any>;
    action_type: ActionType;
    action_config: Record<string, any>; // { distribution_logic: 'round_robin' | 'random', target_users: string[] }
    sequence_steps?: WorkflowStep[];
    is_active: boolean;
    created_at: string;
}

export interface CreateAutomationParams {
    name: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, any>;
    action_type: ActionType;
    action_config: Record<string, any>;
    sequence_steps?: WorkflowStep[];
}

export const automationService = {
    async getAutomations() {
        const { data, error } = await (supabase
            .from('automations' as any)
            .select('*')
            .order('created_at', { ascending: false }) as any);

        if (error) throw error;
        return (data as Automation[]) || [];
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

        const insertPayload: any = {
            name: params.name,
            trigger_type: params.trigger_type,
            trigger_config: params.trigger_config,
            action_type: params.action_type,
            action_config: {
                ...params.action_config,
                sequence_steps: params.sequence_steps || params.action_config?.sequence_steps,
            },
            user_id: userData.user.id,
            company_id: profileData.company_id,
        };

        const { data, error } = await (supabase
            .from('automations' as any)
            .insert(insertPayload)
            .select()
            .single() as any);

        if (error) throw error;
        return data as Automation;
    },

    async updateAutomation(id: string, updates: Partial<Automation>) {
        const payload: any = { ...updates };
        if (updates.sequence_steps) {
            payload.action_config = {
                ...(updates.action_config || {}),
                sequence_steps: updates.sequence_steps,
            };
        }

        const { data, error } = await (supabase
            .from('automations' as any)
            .update(payload)
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
            .maybeSingle() as any);

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
        for (const auto of (automations as Automation[]) || []) {
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
        if (auto.trigger_type === 'form_submitted') {
            return true;
        }
        return false;
    },

    /**
     * Evaluates a step condition against current lead data
     */
    evaluateCondition(condition: WorkflowStep['condition'], lead: any): boolean {
        if (!condition || !condition.field) return true;
        const fieldValue = String(lead[condition.field] ?? '').toLowerCase().trim();
        const expectedValue = String(condition.value ?? '').toLowerCase().trim();

        switch (condition.operator) {
            case 'equals':
                return fieldValue === expectedValue;
            case 'not_equals':
                return fieldValue !== expectedValue;
            case 'contains':
                return fieldValue.includes(expectedValue);
            case 'is_empty':
                return fieldValue === '';
            case 'is_not_empty':
                return fieldValue !== '';
            default:
                return true;
        }
    },

    async executeAction(auto: Automation, data: any) {
        const companyId = data.company_id || auto.company_id;
        if (!companyId) {
            console.error('No company_id found for lead automation');
            return;
        }

        const tableName = await getLeadsTableName(companyId);

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

        // Fetch full lead data
        const { data: lead, error: leadError } = await supabase
            .from(tableName as any)
            .select(selectStr)
            .eq('id', data.id)
            .single() as any;

        if (leadError || !lead) {
            console.error('Failed to fetch lead for automation', leadError);
            return;
        }

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
            logs: `Started at ${new Date().toISOString()}`,
        };

        const { data: logData } = await (supabase
            .from('automation_logs' as any)
            .insert(logEntry)
            .select()
            .single() as any);

        try {
            const steps: WorkflowStep[] =
                auto.sequence_steps || auto.action_config?.sequence_steps || [];

            // If multi-step sequence exists, execute or evaluate sequence
            if (steps.length > 0) {
                let executionLog = `Executing multi-step drip sequence (${steps.length} steps):\n`;

                for (let i = 0; i < steps.length; i++) {
                    const step = steps[i];

                    // 1. Condition Step
                    if (step.step_type === 'condition' && step.condition) {
                        const passed = this.evaluateCondition(step.condition, lead);
                        executionLog += `Step ${i + 1} [Condition: ${step.condition.field} ${step.condition.operator} '${step.condition.value}']: ${passed ? 'PASSED' : 'FAILED - Sequence Stopped'}\n`;
                        if (!passed) {
                            break; // Stop drip sequence if condition failed
                        }
                        continue;
                    }

                    // 2. Delay Step
                    if (step.step_type === 'delay' && step.delay) {
                        executionLog += `Step ${i + 1} [Delay: ${step.delay.amount} ${step.delay.unit}]: Scheduled time-delay drip checkpoint\n`;
                        continue;
                    }

                    // 3. Action Step
                    if (step.step_type === 'action' || !step.step_type) {
                        const actType = step.action_type || auto.action_type;
                        const actConfig = step.action_config || auto.action_config;

                        if (actType === 'send_whatsapp' || actType === 'whatsapp') {
                            const phone = lead.phone || lead.mobile_number;
                            const message = actConfig?.message || actConfig?.template || `Hi ${lead.name || ''}, thank you for your interest! We are here to help.`;
                            
                            // Send via whatsapp-send edge function
                            await supabase.functions.invoke('whatsapp-send', {
                                body: {
                                    companyId,
                                    leadId: lead.id,
                                    recipientPhone: phone,
                                    message,
                                },
                            });
                            executionLog += `Step ${i + 1} [WhatsApp Sent]: ${message.substring(0, 40)}...\n`;
                        } else if (actType === 'send_email') {
                            const subject = actConfig?.subject || `Welcome to our team, ${lead.name || ''}`;
                            const bodyHtml = actConfig?.body || `<p>Hi ${lead.name || ''},</p><p>We are excited to connect with you.</p>`;
                            
                            await supabase.functions.invoke('fastsend-send', {
                                body: {
                                    companyId,
                                    leadId: lead.id,
                                    to: lead.email,
                                    subject,
                                    bodyHtml,
                                    leadTable: tableName,
                                },
                            });
                            executionLog += `Step ${i + 1} [Email Sent]: ${subject}\n`;
                        } else if (actType === 'update_status') {
                            const newStatus = actConfig?.new_status || 'contacted';
                            await supabase
                                .from(tableName as any)
                                .update({ status: newStatus })
                                .eq('id', lead.id);
                            executionLog += `Step ${i + 1} [Status Updated]: -> ${newStatus}\n`;
                        } else if (actType === 'ai_call') {
                            const agentId = actConfig?.agent_id;
                            const phone = lead.phone || lead.mobile_number;
                            if (agentId && phone) {
                                await supabase.functions.invoke('trigger-ai-call', {
                                    body: {
                                        lead_id: lead.id,
                                        lead_phone: phone,
                                        lead_name: lead.name,
                                        agent_id: agentId,
                                        automation_id: auto.id,
                                        company_id: companyId,
                                    },
                                });
                                executionLog += `Step ${i + 1} [AI Call Queued]\n`;
                            }
                        }
                    }
                }

                if (logData) {
                    await supabase
                        .from('automation_logs' as any)
                        .update({ status: 'success', logs: executionLog })
                        .eq('id', logData.id);
                }
                return;
            }

            // Standard Single-Action Execution
            if (auto.action_type === 'send_whatsapp' || auto.action_type === 'whatsapp') {
                const phone = lead.phone || lead.mobile_number;
                const message = auto.action_config?.template || auto.action_config?.message || `Hi ${lead.name || ''}, welcome!`;
                await supabase.functions.invoke('whatsapp-send', {
                    body: {
                        companyId,
                        leadId: lead.id,
                        recipientPhone: phone,
                        message,
                    },
                });
            } else if (auto.action_type === 'ai_personalized_followup') {
                const instructions = auto.action_config?.instructions || 'Follow up with the lead about their interest.';
                const context = lead.lead_history && Array.isArray(lead.lead_history)
                    ? lead.lead_history.slice(-5).map((h: any) => `[${h.timestamp || h.date_time || ''}] ${h.type || h.action || 'Event'}: ${h.details || h.text || ''}`).join('\n')
                    : 'New lead, no history.';

                const aiReply = await generateAgenticReply({
                    companyId: lead.company_id,
                    lead: lead,
                    instructions: instructions,
                    context: context,
                });

                const { data: account } = await supabase
                    .from('email_accounts' as any)
                    .select('*')
                    .eq('company_id', companyId)
                    .eq('status', 'connected')
                    .limit(1)
                    .maybeSingle() as any;

                if (account) {
                    await supabase.functions.invoke('fastsend-send', {
                        body: {
                            accountId: account.id,
                            to: lead.email,
                            subject: aiReply.subject,
                            bodyHtml: aiReply.body_html,
                            leadId: lead.id,
                            leadTable: tableName,
                            companyId: companyId,
                        },
                    });
                }
            } else if (auto.action_type === 'ai_call') {
                const agentId = auto.action_config?.agent_id;
                const phone = lead.phone || lead.mobile_number || lead.whatsapp_number;
                if (agentId && phone) {
                    await supabase.functions.invoke('trigger-ai-call', {
                        body: {
                            lead_id: lead.id,
                            lead_phone: phone,
                            lead_name: lead.name,
                            agent_id: agentId,
                            automation_id: auto.id,
                            company_id: lead.company_id,
                        },
                    });
                }
            }

            if (logData) {
                await (supabase
                    .from('automation_logs' as any)
                    .update({ status: 'success', logs: 'Completed successfully' })
                    .eq('id', logData.id) as any);
            }
        } catch (err: any) {
            console.error('Automation failed', err);
            if (logData) {
                await (supabase
                    .from('automation_logs' as any)
                    .update({ status: 'failed', logs: `Error: ${err.message}` })
                    .eq('id', logData.id) as any);
            }
        }
    },
};
