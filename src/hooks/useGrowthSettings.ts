import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface GrowthSettings {
    id: string;
    company_id: string;
    is_enabled: boolean;
    daily_budget_limit: number;
    auto_outreach_enabled: boolean;
    target_industries: string[];
}

export function useGrowthSettings() {
    const [settings, setSettings] = useState<GrowthSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchSettings = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            // Get current company_id from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single();

            if (!profile?.company_id) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('autonomous_growth_settings' as any)
                .select('*')
                .eq('company_id', profile.company_id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching growth settings:', error);
            } else if (data) {
                setSettings(data as GrowthSettings);
            } else {
                // Initialize if not exists
                const { data: newData, error: initError } = await supabase
                    .from('autonomous_growth_settings' as any)
                    .insert({ company_id: profile.company_id })
                    .select()
                    .single();
                
                if (!initError && newData) {
                    setSettings(newData as GrowthSettings);
                }
            }
        } catch (err) {
            console.error('Error in useGrowthSettings:', err);
        }
        setLoading(false);
    }, [user]);

    const updateSettings = async (updates: Partial<GrowthSettings>) => {
        if (!settings) return { error: new Error('No settings to update') };

        try {
            const { data, error } = await supabase
                .from('autonomous_growth_settings' as any)
                .update(updates)
                .eq('id', settings.id)
                .select()
                .single();

            if (!error && data) {
                setSettings(data as GrowthSettings);
            }
            return { data, error };
        } catch (err) {
            return { data: null, error: err as Error };
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return { settings, loading, updateSettings, refetch: fetchSettings };
}
