import React, { useState } from 'react';
import { Bot, Zap, AlignLeft, Inbox, Settings, BarChart, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { EmailCampaign } from '@/hooks/useEmailCampaigns';

// Extracted Components
import { AccountsTab } from '@/components/features/fastsend/AccountsTab';
import { CampaignsTab } from '@/components/features/fastsend/CampaignsTab';
import { CampaignBuilder } from '@/components/features/fastsend/CampaignBuilder';
import { CampaignDetailView } from '@/components/features/fastsend/CampaignDetailView';
import { InboxTab } from '@/components/features/fastsend/InboxTab';
import { AnalyticsTab } from '@/components/features/fastsend/AnalyticsTab';

export default function FastSend() {
    const [viewMode, setViewMode] = useState<'list' | 'builder' | 'detail'>('list');
    const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
    const [duplicateSequences, setDuplicateSequences] = useState<any[] | null>(null);
    const [isPreparingDuplicate, setIsPreparingDuplicate] = useState(false);

    // Render Campaign Builder view
    if (viewMode === 'builder') {
        return (
            <div className="p-4 md:p-8 pt-6">
                <CampaignBuilder 
                    initialData={selectedCampaign || undefined}
                    initialSequences={duplicateSequences || undefined}
                    onCancel={() => {
                        setViewMode('list');
                        setSelectedCampaign(null);
                        setDuplicateSequences(null);
                    }} 
                />
            </div>
        );
    }

    // Render Campaign Detail view
    if (viewMode === 'detail' && selectedCampaign) {
        return (
            <CampaignDetailView 
                campaign={selectedCampaign} 
                onBack={() => { 
                    setViewMode('list'); 
                    setSelectedCampaign(null); 
                }} 
                onEdit={(camp) => {
                    setSelectedCampaign(camp);
                    setViewMode('builder');
                }}
            />
        );
    }

    // Main List View
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
                            FastSend AI
                        </h2>
                        <Badge variant="outline" className="border-purple-400/50 text-purple-400 gap-1.5 text-xs">
                            <Bot className="h-3 w-3" /> Agentic Platform
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">Autonomous AI email campaigns that negotiate, engage, and close leads</p>
                </div>
                <div className="flex gap-2">
                    {isPreparingDuplicate && <Loader2 className="h-5 w-5 animate-spin text-primary self-center mr-2" />}
                    <Button 
                        onClick={() => setViewMode('builder')} 
                        className="shadow-md bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    >
                        <Zap className="mr-2 h-4 w-4" /> New Campaign
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="campaigns" className="space-y-4">
                <div className="border-b">
                    <TabsList className="bg-transparent h-12">
                        <TabsTrigger value="campaigns" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <AlignLeft className="h-4 w-4" /> Campaigns
                        </TabsTrigger>
                        <TabsTrigger value="inbox" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <Inbox className="h-4 w-4" /> Inbox
                        </TabsTrigger>
                        <TabsTrigger value="accounts" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <Settings className="h-4 w-4" /> Email Accounts
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <BarChart className="h-4 w-4" /> Analytics
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="campaigns" className="m-0 pt-4">
                    <CampaignsTab 
                        onEdit={(camp) => {
                            setSelectedCampaign(camp);
                            setViewMode('builder');
                        }} 
                        onDuplicate={async (camp) => {
                            setIsPreparingDuplicate(true);
                            try {
                                // Fetch sequences
                                const { data: seqs } = await supabase
                                    .from('email_campaign_sequences' as any)
                                    .select('*')
                                    .eq('campaign_id', camp.id)
                                    .order('step_number', { ascending: true });
                                
                                // Clean up sequences for new campaign
                                const cleanedSeqs = (seqs || []).map(({ id, campaign_id, created_at, updated_at, ...rest }: any) => rest);
                                
                                const { id, created_at, updated_at, status, ...rest } = camp;
                                setSelectedCampaign({ ...rest, name: `${camp.name} (Copy)` } as any);
                                setDuplicateSequences(cleanedSeqs);
                                setViewMode('builder');
                            } catch (e) {
                                console.error('Duplication error:', e);
                            } finally {
                                setIsPreparingDuplicate(false);
                            }
                        }}
                        onOpenDetail={(camp) => { 
                            setSelectedCampaign(camp); 
                            setViewMode('detail'); 
                        }} 
                    />
                </TabsContent>

                <TabsContent value="inbox" className="m-0 pt-4">
                    <InboxTab />
                </TabsContent>

                <TabsContent value="accounts" className="m-0 pt-4">
                    <AccountsTab />
                </TabsContent>

                <TabsContent value="analytics" className="m-0 pt-4">
                    <AnalyticsTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
