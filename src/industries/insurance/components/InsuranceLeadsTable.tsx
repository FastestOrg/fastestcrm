import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Mail, MoreHorizontal, Shield, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { LeadHistoryDialog } from '@/components/leads/LeadHistoryDialog';
import { useCompany } from '@/hooks/useCompany';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { Checkbox } from '@/components/ui/checkbox';

export interface InsuranceLead {
  id: string;
  company_id: string | null;
  created_by_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  age: number | null;
  gender: string | null;
  pan_number: string | null;
  date_of_birth: string | null;
  occupation: string | null;
  annual_income: number | null;
  insurance_type: string | null;
  plan_name: string | null;
  sum_insured: number | null;
  premium_amount: number | null;
  contribution_frequency: string | null;
  policy_term: number | null;
  existing_policies: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  agent_name: string | null;
  policy_number: string | null;
  policy_start_date: string | null;
  renewal_date: string | null;
  loss_reason: string | null;
  lead_source: string | null;
  pre_sales_owner_id: string | null;
  sales_owner_id: string | null;
  post_sales_owner_id: string | null;
  notes: string | null;
  status: string;
  status_metadata: Record<string, any>;
  lead_profile: Record<string, any>;
  lead_history?: any[] | null;
  revenue_projected: number | null;
  revenue_received: number | null;
  payment_link: string | null;
  reminder_at: string | null;
  created_at: string;
  updated_at: string;
  sales_owner?: { full_name: string | null } | null;
}

interface InsuranceLeadsTableProps {
  leads: InsuranceLead[];
  loading: boolean;
  selectedLeads: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  owners?: { label: string; value: string }[];
  onRefetch: () => void;
  onViewDetails?: (lead: InsuranceLead) => void;
  onEditLead?: (lead: InsuranceLead) => void;
  columnConfig?: any[];
  maskLeads?: boolean;
}

export function InsuranceLeadsTable({
  leads, loading, selectedLeads, onSelectionChange, owners = [],
  onRefetch, onViewDetails, onEditLead, columnConfig, maskLeads = false,
}: InsuranceLeadsTableProps) {
  const { statuses, getStatusColor } = useLeadStatuses();
  const [pendingStatus, setPendingStatus] = useState<{ leadId: string; status: CompanyLeadStatus } | null>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [viewingHistoryLead, setViewingHistoryLead] = useState<InsuranceLead | null>(null);
  const [notesBuffer, setNotesBuffer] = useState<Record<string, string>>({});

  const handleUpdateField = async (leadId: string, field: string, value: any) => {
    try {
      const { error } = await supabase.from('leads_insurance' as any).update({ [field]: value }).eq('id', leadId);
      if (error) throw error;
      toast.success('Updated successfully');
      onRefetch();
    } catch { toast.error('Failed to update'); }
  };

  const handleStatusChange = async (leadId: string, newStatusValue: string) => {
    const newStatus = statuses?.find(s => s.value === newStatusValue);
    if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived')) {
      setPendingStatus({ leadId, status: newStatus });
      setReminderDialogOpen(true);
    } else {
      await handleUpdateField(leadId, 'status', newStatusValue);
    }
  };

  const handleReminderConfirm = async (date: Date | null) => {
    if (pendingStatus) {
      try {
        const { error } = await supabase.from('leads_insurance' as any)
          .update({ status: pendingStatus.status.value, reminder_at: date ? date.toISOString() : null })
          .eq('id', pendingStatus.leadId);
        if (error) throw error;
        toast.success('Status updated');
        onRefetch();
      } catch { toast.error('Failed to update status'); }
    }
    setReminderDialogOpen(false);
    setPendingStatus(null);
  };

  const toggleAll = () => {
    onSelectionChange(selectedLeads.size === leads.length ? new Set() : new Set(leads.map(l => l.id)));
  };

  const toggleLead = (id: string) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    onSelectionChange(newSet);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  if (leads.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>No insurance leads found. Add your first lead to get started!</p>
    </div>
  );

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={selectedLeads.size === leads.length && leads.length > 0} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Insurance Type</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sales Owner</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => (
              <TableRow key={lead.id} className="animate-row-fade-in" style={{ animationDelay: `${index * 30}ms` }} data-state={selectedLeads.has(lead.id) ? 'selected' : undefined}>
                <TableCell><Checkbox checked={selectedLeads.has(lead.id)} onCheckedChange={() => toggleLead(lead.id)} /></TableCell>
                <TableCell>
                  <div>
                    <button className="font-medium text-primary hover:underline text-left" onClick={() => onViewDetails?.(lead)}>{lead.name}</button>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /><MaskedValue value={lead.email} type="email" enabled={maskLeads} /></span>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{lead.phone ? <MaskedValue value={lead.phone} type="phone" enabled={maskLeads} /> : '-'}</TableCell>
                <TableCell>{lead.age || '-'}</TableCell>
                <TableCell>{lead.insurance_type ? <Badge variant="outline">{lead.insurance_type}</Badge> : '-'}</TableCell>
                <TableCell>{lead.plan_name || '-'}</TableCell>
                <TableCell>{formatCurrency(lead.premium_amount)}</TableCell>
                <TableCell>{lead.contribution_frequency || '-'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-8 w-[130px] justify-between px-3 font-normal"
                        variant="outline"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {statuses.find(s => s.value === lead.status)?.color && (
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: statuses.find(s => s.value === lead.status)?.color }}
                            />
                          )}
                          <span className="truncate">{statuses.find(s => s.value === lead.status)?.label || lead.status}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 ml-2 opacity-50 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {statuses.map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => handleStatusChange(lead.id, s.value)}
                          className="capitalize cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>
                  <Select value={lead.sales_owner_id || ''} onValueChange={(val) => handleUpdateField(lead.id, 'sales_owner_id', val)}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue placeholder="Assign" /></SelectTrigger>
                    <SelectContent>{owners.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Textarea
                    className="min-h-[32px] h-8 text-xs resize-none w-[120px]"
                    value={notesBuffer[lead.id] ?? lead.notes ?? ''}
                    onChange={(e) => setNotesBuffer(prev => ({ ...prev, [lead.id]: e.target.value }))}
                    onBlur={() => {
                      const val = notesBuffer[lead.id];
                      if (val !== undefined && val !== (lead.notes ?? '')) handleUpdateField(lead.id, 'notes', val || null);
                    }}
                    placeholder="Add notes..."
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(lead.created_at), 'MMM dd')}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails?.(lead)}>View Details</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditLead?.(lead)}>Edit Lead</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setViewingHistoryLead(lead)}>View History</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pendingStatus && <StatusReminderDialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen} status={pendingStatus.status} onConfirm={handleReminderConfirm} onCancel={() => { setReminderDialogOpen(false); setPendingStatus(null); }} />}
      {viewingHistoryLead && <LeadHistoryDialog open={!!viewingHistoryLead} onOpenChange={(open) => !open && setViewingHistoryLead(null)} lead={viewingHistoryLead as any} />}
    </>
  );
}
