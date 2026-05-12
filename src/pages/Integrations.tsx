import { useState } from 'react';
// DashboardLayout removed
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
import { Mail, MessageSquare, Phone, CreditCard, Calendar, FileSpreadsheet, Webhook, Loader2, Megaphone, Bot, Search, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AddIntegrationDialog } from '@/components/integrations/AddIntegrationDialog';
import { PerformanceMarketingDialog } from '@/components/integrations/PerformanceMarketingDialog';
import { EmailIntegrationDialog } from '@/components/integrations/EmailIntegrationDialog';
import { useCompany } from '@/hooks/useCompany';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useToast } from '@/hooks/use-toast';

const integrationTypes = [
    { id: 'performance_marketing', name: 'Performance Marketing', icon: Megaphone, description: 'Meta, Google & LinkedIn Ads', category: 'Lead Generation', isSpecial: true },
    { id: 'gmail', name: 'Gmail / Outlook', icon: Mail, description: 'Sync emails and calendar', category: 'Communication' },
    { id: 'whatsapp', name: 'WhatsApp Business', icon: MessageSquare, description: 'Send automated messages', category: 'Communication' },
    { id: 'telephony', name: 'Exotel / Twilio', icon: Phone, description: 'Click-to-call and recording', category: 'Telephony' },
    { id: 'razorpay', name: 'Razorpay', icon: CreditCard, description: 'Payment links and reconciliation', category: 'Payments' },
    { id: 'google_calendar', name: 'Google Calendar', icon: Calendar, description: 'Schedule meetings', category: 'Scheduling' },
    { id: 'google_sheets', name: 'Google Sheets', icon: FileSpreadsheet, description: 'Export/Import leads', category: 'Data' },
    { id: 'webhooks', name: 'Webhooks', icon: Webhook, description: 'Connect custom apps', category: 'Developer' },
    { id: 'gemini', name: 'Google Gemini AI', icon: Bot, description: 'Power your WhatsApp AI Agent', category: 'AI' },
    { id: 'apollo', name: 'Apollo.io', icon: Search, description: 'Find leads and contact info', category: 'Lead Generation' },
];

export default function Integrations() {
    const { user } = useAuth();
    const { company } = useCompany();
    const [selectedIntegration, setSelectedIntegration] = useState<{ id: string, name: string } | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPerformanceMarketingOpen, setIsPerformanceMarketingOpen] = useState(false);
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    
    // Unified email account check
    const { accounts: emailAccounts } = useEmailAccounts();

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: connectedKeys, isLoading } = useQuery({
        queryKey: ['integration-keys', user?.id],
        queryFn: async (): Promise<{ id: string; service_name: string; is_active: boolean | null }[]> => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('integration_api_keys')
                .select('id, service_name, is_active')
                .eq('user_id', user.id);

            if (error) throw error;
            return (data || []) as { id: string; service_name: string; is_active: boolean | null }[];
        },
        enabled: !!user?.id
    });

    // Query for performance marketing integrations
    const { data: pmIntegrations } = useQuery({
        queryKey: ['performance-marketing-integrations', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await supabase
                .from('performance_marketing_integrations' as any)
                .select('platform, is_active')
                .eq('company_id', company.id)
                .eq('is_active', true);
            return data || [];
        },
        enabled: !!company?.id
    });

    // Query for email integration
    const { data: emailIntegration } = useQuery({
        queryKey: ['email-integration', company?.id],
        queryFn: async () => {
            if (!company?.id) return null;
            const { data } = await supabase
                .from('email_integrations' as any)
                .select('is_active')
                .eq('company_id', company.id)
                .maybeSingle();
            return data as any;
        },
        enabled: !!company?.id
    });

    const isConnected = (serviceId: string) => {
        if (serviceId === 'performance_marketing') {
            return (pmIntegrations?.length || 0) > 0;
        }
        if (serviceId === 'gmail') {
            const hasGmail = emailAccounts.some(acc => acc.provider === 'gmail' && acc.status === 'connected');
            return hasGmail || emailIntegration?.is_active || false;
        }
        return connectedKeys?.some(key => key.service_name === serviceId && key.is_active);
    };

    const handleConnect = (integration: { id: string, name: string, isSpecial?: boolean }) => {
        if (integration.id === 'performance_marketing') {
            setIsPerformanceMarketingOpen(true);
            return;
        }
        if (integration.id === 'gmail') {
            setIsEmailDialogOpen(true);
            return;
        }
        if (integration.id === 'google_calendar') {
            window.location.href = '/dashboard/calendar';
            return;
        }
        setSelectedIntegration(integration);
        setIsDialogOpen(true);
    };

    const disconnectMutation = useMutation({
        mutationFn: async (serviceId: string) => {
            if (!user?.id) return;
            
            // For standard API keys
            const { error } = await supabase
                .from('integration_api_keys')
                .delete()
                .eq('user_id', user.id)
                .eq('service_name', serviceId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integration-keys'] });
            toast({
                title: "Integration removed",
                description: "The connection has been successfully disconnected."
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to disconnect integration.",
                variant: "destructive"
            });
        }
    });

    const handleDisconnect = (serviceId: string) => {
        if (window.confirm(`Are you sure you want to remove the ${serviceId} connection?`)) {
            disconnectMutation.mutate(serviceId);
        }
    };

    return (
        <>
            <div className="p-8 space-y-8">
                <div>
                    <h1 className="text-2xl font-bold">Integrations</h1>
                    <p className="text-muted-foreground">Connect Fastest CRM with your favorite tools.</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {integrationTypes.map((integration) => {
                            const connected = isConnected(integration.id);
                            return (
                                <Card key={integration.id} className="glass hover:border-primary/50 transition-colors">
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-start">
                                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                                <integration.icon className="h-6 w-6 text-primary" />
                                            </div>
                                            <Badge variant={connected ? "default" : "outline"} className={connected ? "bg-green-500 hover:bg-green-600" : ""}>
                                                {connected ? 'Connected' : 'Disconnected'}
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                                        <CardDescription>{integration.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between pt-4 border-t border-border">
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{integration.category}</span>
                                            {connected ? (
                                                <div className="flex gap-2">
                                                    {(integration.id === 'performance_marketing' || integration.id === 'gmail') ? (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => handleConnect(integration)}
                                                        >
                                                            Manage
                                                        </Button>
                                                    ) : (
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDisconnect(integration.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Disconnect
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => handleConnect(integration)}>
                                                    Connect
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {selectedIntegration && (
                    <AddIntegrationDialog
                        isOpen={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                        serviceName={selectedIntegration.id}
                        displayName={selectedIntegration.name}
                    />
                )}

                <PerformanceMarketingDialog
                    isOpen={isPerformanceMarketingOpen}
                    onOpenChange={setIsPerformanceMarketingOpen}
                />

                <EmailIntegrationDialog
                    isOpen={isEmailDialogOpen}
                    onOpenChange={setIsEmailDialogOpen}
                />
            </div>
        </>
    );
}
