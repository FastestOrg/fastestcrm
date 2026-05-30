import { supabase } from '@/integrations/supabase/client';
import { callGemini, getGeminiKey } from './aiUtils';
import { logger } from '../lib/logger';

export interface AutonomousActionConfig {
  employeeId: string;
  leadId: string;
  companyId: string;
  leadTable?: string;
}

export class AutonomousExecutionService {
  /**
   * Retrieves the current context memory of the AI employee regarding a lead
   */
  public async getEmployeeMemory(employeeId: string, leadId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('ai_employee_memory')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err: any) {
      logger.error('Failed to retrieve AI employee memory', { details: err });
      return null;
    }
  }

  /**
   * Retains an interaction outcome in the memory of the AI employee
   */
  public async saveInteractionToMemory(params: {
    employeeId: string;
    leadId: string;
    companyId: string;
    interactionSummary: string;
    dataSnapshot?: Record<string, any>;
  }): Promise<boolean> {
    const { employeeId, leadId, companyId, interactionSummary, dataSnapshot = {} } = params;
    try {
      // 1. Fetch current memory
      const currentMemory = await this.getEmployeeMemory(employeeId, leadId);

      const now = new Date().toISOString();
      const newInteraction = {
        timestamp: now,
        summary: interactionSummary,
      };

      const updatedHistory = currentMemory?.memory_data
        ? [...currentMemory.memory_data, newInteraction]
        : [newInteraction];

      const { error } = await supabase
        .from('ai_employee_memory')
        .upsert({
          employee_id: employeeId,
          lead_id: leadId,
          company_id: companyId,
          memory_data: updatedHistory as any,
          summary: interactionSummary,
          lead_context_snapshot: dataSnapshot,
          last_interaction_at: now,
          updated_at: now,
        }, {
          onConflict: 'employee_id,lead_id'
        });

      if (error) throw error;
      return true;
    } catch (err: any) {
      logger.error('Failed to save AI employee memory', { details: err });
      return false;
    }
  }

  /**
   * Evaluates the next strategic step for the lead using Gemini
   */
  public async evaluateNextAction(config: AutonomousActionConfig, leadDetails: Record<string, any>): Promise<{
    actionType: 'email' | 'whatsapp' | 'call' | 'none';
    rationale: string;
    suggestedMessage?: string;
  }> {
    const { employeeId, leadId, companyId } = config;
    try {
      const apiKey = await getGeminiKey(companyId);
      const memory = await this.getEmployeeMemory(employeeId, leadId);
      
      const historyStr = memory?.memory_data
        ? JSON.stringify(memory.memory_data)
        : 'No previous interactions.';

      const prompt = `
        You are an autonomous AI CRM agent orchestrating sales follow-ups.
        
        Company Context: FastestCRM AI Employee
        Lead Info: ${JSON.stringify(leadDetails)}
        Interaction History: ${historyStr}

        Evaluate the next step. Choose one of: 'email', 'whatsapp', 'call', or 'none'.
        Provide your choice, rationale, and a suggested follow-up message if applicable.
        
        Output format in valid JSON only:
        {
          "actionType": "email" | "whatsapp" | "call" | "none",
          "rationale": "Reasoning based on history and lead status",
          "suggestedMessage": "The draft follow-up text"
        }
      `;

      const rawResponse = await callGemini({ apiKey, prompt, temperature: 0.3 });
      const result = JSON.parse(rawResponse);
      return result;
    } catch (err: any) {
      logger.error('Failed to evaluate autonomous next action', { details: err });
      return {
        actionType: 'none',
        rationale: `Error during evaluation: ${err.message || err}`,
      };
    }
  }

  /**
   * Log action telemetry
   */
  public async logAction(params: {
    employeeId: string;
    leadId: string;
    companyId: string;
    actionType: string;
    content: string;
    status: 'pending' | 'success' | 'failed';
    metadata?: Record<string, any>;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await supabase.from('ai_employee_actions').insert({
        employee_id: params.employeeId,
        lead_id: params.leadId,
        company_id: params.companyId,
        action_type: params.actionType,
        content: params.content,
        status: params.status,
        metadata: params.metadata || {},
        error_message: params.errorMessage || null,
      });
    } catch (err) {
      logger.error('Failed to log autonomous action telemetry', { details: err });
    }
  }
}

export const autonomousService = new AutonomousExecutionService();
