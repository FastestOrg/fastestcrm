import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { SwipeableLeadCard } from '@/components/leads/SwipeableLeadCard';
import { MobileLeadsHeader } from '@/components/leads/MobileLeadsHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useUserRole } from '@/hooks/useUserRole';
import { useCompany } from '@/hooks/useCompany';
import { ColumnConfigDialog } from '@/components/leads/ColumnConfigDialog';
import { useCustomColumns } from '@/hooks/useCustomColumns';

export default function PendingPayments() {
    const isMobile = useIsMobile();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [editingLead, setEditingLead] = useState<any>(null);
    const [viewingLead, setViewingLead] = useState<any>(null);
    const { tableName } = useLeadsTable();

    const [configOpen, setConfigOpen] = useState(false);
    const { data: userRole } = useUserRole();
    const { company } = useCompany();
    const { customColumns } = useCustomColumns();

    const { data: owners } = useQuery({
        queryKey: ['profiles', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('company_id', company.id)
                .not('full_name', 'is', null);
            return (data || []).map((p) => ({ label: p.full_name || 'Unknown', value: p.id }));
        },
        enabled: !!company?.id,
        staleTime: 5 * 60 * 1000,
    });

    const defaultColumns = [
        { id: 'name', label: 'Name' },
        { id: 'contact', label: 'Contact' },
        { id: 'college', label: 'College' },
        { id: 'status', label: 'Status' },
        { id: 'received', label: 'Received' },
        { id: 'projected', label: 'Projected' },
        { id: 'pending', label: 'Pending' },
        // Hidden by default
        { id: 'email', label: 'Email', defaultHidden: true },
        { id: 'phone', label: 'Phone', defaultHidden: true },
        { id: 'whatsapp', label: 'WhatsApp', defaultHidden: true },
        { id: 'updated_at', label: 'Last Updated', defaultHidden: true },
        ...customColumns,
        { id: 'actions', label: 'Actions' }
    ];

    const columnConfig = (company as any)?.features?.table_configs?.['pending_payments'];

    const { data: leadsData, isLoading, refetch } = useLeads({
        search: searchTerm,
        pendingPaymentOnly: true,
        pageSize: 1000
    });
    const leads = leadsData?.leads || [];

    const pendingLeads = leads?.filter((lead: any) => {
        const projected = lead.revenue_projected || 0;
        const received = lead.revenue_received || 0;
        return projected > received && received > 0;
    }) || [];

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const toggleLead = (id: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLeads(newSelected);
    };

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from(tableName as any)
                .update({ status: newStatus })
                .eq('id', leadId);

            if (error) throw error;
            toast.success('Status updated successfully');
            await refetch();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    // Helper to render columns dynamically
    const renderColumnContent = (lead: any, columnId: string) => {
        const projected = lead.revenue_projected || 0;
        const received = lead.revenue_received || 0;
        const pending = projected - received;

        switch (columnId) {
            case 'name':
                return <div className="font-medium">{lead.name}</div>;
            case 'contact':
                return (
                    <div className="flex flex-col text-sm">
                        {lead.email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" /> {lead.email}
                            </span>
                        )}
                        {lead.phone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" /> {lead.phone}
                            </span>
                        )}
                    </div>
                );
            case 'email':
                return lead.email ? <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {lead.email}</span> : '-';
            case 'phone':
                return lead.phone ? <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {lead.phone}</span> : '-';
            case 'whatsapp':
                return lead.whatsapp ? (
                    <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:text-green-700">
                        <Phone className="h-3 w-3" /> {lead.whatsapp}
                    </a>
                ) : '-';
            case 'college':
                return lead.college || '-';
            case 'status':
                return (
                    <Badge variant="secondary" className="capitalize">
                        {lead.status.replace('_', ' ')}
                    </Badge>
                );
            case 'received':
                return <div className="text-right font-medium">{formatCurrency(received)}</div>;
            case 'projected':
                return <div className="text-right text-muted-foreground">{formatCurrency(projected)}</div>;
            case 'pending':
                return <div className="text-right font-bold text-destructive">{formatCurrency(pending)}</div>;
            case 'updated_at':
                return lead.updated_at ? <span className="text-xs text-muted-foreground">{new Date(lead.updated_at).toLocaleDateString()}</span> : '-';
            case 'actions':
                return (
                    <div className="text-right">
                        <Button size="sm" className="gradient-primary">
                            Send Reminder
                        </Button>
                    </div>
                );
            default:
                return lead[columnId] || '-';
        }
    };

    const visibleColumns = defaultColumns.filter(col => {
        if (!columnConfig) return !col.defaultHidden;
        const configItem = columnConfig.find((c: any) => c.id === col.id);
        return configItem ? configItem.visible : !col.defaultHidden;
    }).sort((a, b) => {
        if (!columnConfig) return 0;
        const indexA = columnConfig.findIndex((c: any) => c.id === a.id);
        const indexB = columnConfig.findIndex((c: any) => c.id === b.id);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    if (isLoading) {
        return (
            <>
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
                <MobileLeadsHeader
                    title="Pending Payments"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    selectedCount={selectedLeads.size}
                    onEditLayout={userRole === 'company' || userRole === 'company_subadmin' ? () => setConfigOpen(true) : undefined}
                />

                {/* Mobile Card View */}
                {isMobile ? (
                    <div className="space-y-3">
                        {pendingLeads.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No pending payments found.</p>
                            </div>
                        ) : (
                            pendingLeads.map((lead: any) => {
                                const pending = (lead.revenue_projected || 0) - (lead.revenue_received || 0);
                                return (
                                    <div key={lead.id} className="space-y-2">
                                        <SwipeableLeadCard
                                            lead={lead}
                                            isSelected={selectedLeads.has(lead.id)}
                                            onToggleSelect={() => toggleLead(lead.id)}
                                            onViewDetails={() => setViewingLead(lead)}
                                            onEdit={() => setEditingLead(lead)}
                                            onStatusChange={(status) => handleStatusChange(lead.id, status)}
                                            variant="education"
                                            visibleAttributes={visibleColumns}
                                        />
                                        {/* Payment info overlay */}
                                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 -mt-1 mx-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Pending Amount:</span>
                                                <span className="font-bold text-destructive">{formatCurrency(pending)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs mt-1">
                                                <span className="text-muted-foreground">Received: {formatCurrency(lead.revenue_received || 0)}</span>
                                                <span className="text-muted-foreground">Projected: {formatCurrency(lead.revenue_projected || 0)}</span>
                                            </div>
                                            <Button size="sm" className="w-full mt-2 gradient-primary">
                                                Send Reminder
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* Desktop Table View */
                    <Card>
                        <CardContent className="pt-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {visibleColumns.map(col => (
                                            <TableHead key={col.id} className={['received', 'projected', 'pending', 'actions'].includes(col.id) ? "text-right" : ""}>
                                                {col.label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingLeads.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">
                                                No pending payments found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        pendingLeads.map((lead: any) => (
                                            <TableRow key={lead.id}>
                                                {visibleColumns.map(col => (
                                                    <TableCell key={col.id}>
                                                        {renderColumnContent(lead, col.id)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>

            <ColumnConfigDialog
                open={configOpen}
                onOpenChange={setConfigOpen}
                tableId="pending_payments"
                defaultColumns={defaultColumns}
            />

            <EditLeadDialog
                open={!!editingLead}
                onOpenChange={(open) => !open && setEditingLead(null)}
                lead={editingLead}
            />

            <LeadDetailsDialog
                open={!!viewingLead}
                onOpenChange={(open) => !open && setViewingLead(null)}
                lead={viewingLead}
                owners={owners || []}
            />
        </>
    );
}
