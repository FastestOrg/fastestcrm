import { useState, useMemo, memo } from 'react';
import { Tables } from '@/integrations/supabase/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Mail, MoreHorizontal, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateLead } from '@/hooks/useLeads';
import { useProducts } from '@/hooks/useProducts';
import { useUserRole, isRoleAllowedToMarkPaid } from '@/hooks/useUserRole';

import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { EditLeadDialog } from './EditLeadDialog';
import { LeadDetailsDialog } from './LeadDetailsDialog';
import { LeadHistoryDialog } from './LeadHistoryDialog';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { StatusReminderDialog } from './StatusReminderDialog';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { PriorityBadge } from './PriorityBadge';
import { calculatePriorityLevel } from '@/hooks/useLeadScoring';

type Lead = Tables<'leads'> & {
  sales_owner?: {
    full_name: string | null;
  } | null;
  reminder_at?: string | null;
  lead_history?: any;
};

interface ColumnConfigItem {
  id: string;
  visible: boolean;
}

interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  selectedLeads: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  owners?: { label: string; value: string }[];
  columnConfig?: ColumnConfigItem[];
  maskLeads?: boolean;
}

export const LeadsTable = memo(function LeadsTable({ leads, loading, selectedLeads, onSelectionChange, owners = [], columnConfig, maskLeads = false }: LeadsTableProps) {
  const { products } = useProducts();
  const updateLead = useUpdateLead();
  const { data: userRole } = useUserRole();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [viewingHistoryLead, setViewingHistoryLead] = useState<Lead | null>(null);
  const { statuses, getStatusColor } = useLeadStatuses();
  const [pendingStatus, setPendingStatus] = useState<{ leadId: string; status: CompanyLeadStatus } | null>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);

  const handleStatusChange = async (leadId: string, newStatusValue: string, metadata?: Record<string, any>) => {
    const newStatus = statuses?.find(s => s.value === newStatusValue);

    // Check if status requires date/time input (Derived Status)
    if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived') && !metadata) {
      setPendingStatus({ leadId, status: newStatus });
      setReminderDialogOpen(true);
      return;
    }

    try {
      const updates: any = {
        id: leadId,
        status: newStatusValue as any
      };

      if (metadata && metadata.reminder_at) {
        updates.reminder_at = metadata.reminder_at;
      } else if (newStatus && newStatus.status_type === 'simple') {
        updates.reminder_at = null;
      }
      if (metadata && metadata.send_web_push === true) {
        updates.send_web_push = true;
        updates.last_notification_sent_at = null;
      }

      await updateLead.mutateAsync(updates);
      toast.success('Status updated successfully');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleReminderConfirm = async (dateTime: Date | null, sendNotification: boolean) => {
    if (!pendingStatus) return;

    const metadata: Record<string, any> = {};
    if (dateTime) {
      metadata.reminder_at = dateTime.toISOString();
    }
    metadata.send_web_push = sendNotification;

    await handleStatusChange(pendingStatus.leadId, pendingStatus.status.value, metadata);
    setReminderDialogOpen(false);
    setPendingStatus(null);
  };

  const handleReminderCancel = () => {
    setReminderDialogOpen(false);
    setPendingStatus(null);
  };

  const getStatusDisplay = (lead: Lead) => {
    const status = statuses.find(s => s.value === lead.status);
    const label = status?.label || lead.status;

    if (lead.reminder_at && (status?.status_type === 'date_derived' || status?.status_type === 'time_derived')) {
      try {
        return `${label} - ${format(new Date(lead.reminder_at), 'dd MMM, hh:mm a')}`;
      } catch (e) {
        return label;
      }
    }

    return label;
  };

  const handleProductChange = async (leadId: string, productName: string) => {
    // If clearing (if we support that)
    if (!productName || productName === 'none') {
      // logic to clear if needed, for now assuming selection mandatory or switch
      return;
    }

    const product = products?.find(p => p.name === productName);
    if (!product) {
      toast.error('Product not found in catalog');
      return;
    }

    try {
      await updateLead.mutateAsync({
        id: leadId,
        product_category: product.category,
        product_purchased: product.name
      });
      toast.success('Product updated successfully');
    } catch (error) {
      toast.error('Failed to update product');
    }
  };

  const handleCreatePaymentLink = async (lead: Lead) => {
    if (!lead.product_purchased) {
      toast.error('Please select a specific product to create a payment link');
      return;
    }

    // Match by name. Ideally we should match by ID if we stored product_id
    const selectedProgram = products?.find(p => p.name === lead.product_purchased && (!(lead as any).product_category || p.category === (lead as any).product_category));


    if (!selectedProgram) {
      toast.error('Program details not found');
      return;
    }

    // Convert price to paise (assuming price in DB is in INR)
    const amount = (selectedProgram.price || 0) * 100;


    if (amount <= 0) {
      toast.error('Program price must be greater than 0');
      return;
    }

    // Validation: Require either email or phone
    if (!lead.email && !lead.phone) {
      toast.error('Lead must have an email or phone number to create a payment link');
      return;
    }

    try {
      toast.loading('Creating payment link...');

      const payload = {
        amount,
        description: `Payment for ${lead.product_purchased}`,
        customer: {
          name: lead.name,
          email: lead.email || '',
          phone: lead.phone || ''
        },
        reference_id: lead.id
      };


      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: payload
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      await updateLead.mutateAsync({
        id: lead.id,
        payment_link: data.short_url,
        revenue_projected: selectedProgram.price
      });

      toast.dismiss();
      toast.success('Payment link created successfully');
    } catch (error: any) {
      toast.dismiss();
      console.error('Payment Link Error:', error);
      toast.error(error.message || 'Failed to create payment link');
    }
  };

  const columnDefinitions = useMemo<Record<string, { label: string, render: (lead: Lead) => React.ReactNode }>>(() => ({
    priority: {
      label: 'Priority',
      render: (lead) => {
        const { level, score } = calculatePriorityLevel(lead);
        return <PriorityBadge level={level} score={score} />;
      }
    },
    name: {
      label: 'Name',
      render: (lead) => <div className="font-medium">{lead.name}</div>
    },
    email: {
      label: 'Email',
      render: (lead) => lead.email ? (
        <span className="flex items-center gap-1 text-muted-foreground w-full">
          <Mail className="h-3 w-3 shrink-0" />
          <MaskedValue value={lead.email} type="email" enabled={maskLeads} showIcon={false} />
        </span>
      ) : null
    },
    phone: {
      label: 'Phone Number',
      render: (lead) => lead.phone ? (
        <span className="flex items-center gap-1 text-muted-foreground w-full">
          <Phone className="h-3 w-3 shrink-0" />
          <MaskedValue value={lead.phone} type="phone" enabled={maskLeads} showIcon={false} />
        </span>
      ) : null
    },
    college: {
      label: 'College',
      render: (lead) => lead.college || '-'
    },
    lead_source: {
      label: 'Lead Source',
      render: (lead) => lead.lead_source || '-'
    },
    status: {
      label: 'Status',
      render: (lead) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="w-auto min-w-[140px] h-8 text-white border-0 px-3 justify-between"
              style={{ backgroundColor: getStatusColor(lead.status) }}
            >
              <span className="truncate">{getStatusDisplay(lead)}</span>
              <ChevronDown className="h-4 w-4 ml-2 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {statuses.map((status) => (
              <DropdownMenuItem
                key={status.id}
                onClick={() => handleStatusChange(lead.id, status.value)}
                className="capitalize cursor-pointer"
              >
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    owner: {
      label: 'Owner',
      render: (lead) => lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label || 'Unknown'
    },
    created_at: {
      label: 'Date',
      render: (lead) => format(new Date(lead.created_at), 'MMM d, yyyy')
    },
    product_purchased: {
      label: 'Product',
      render: (lead) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[180px] h-8 justify-between px-3 text-sm font-normal text-muted-foreground">
              <span className="truncate text-foreground">
                {lead.product_purchased
                  ? `${(lead as any).product_category ? `${(lead as any).product_category} - ` : ''}${lead.product_purchased}`
                  : "Select Product"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {Array.from(new Set((products || []).map(p => p.category))).sort().map(category => (
              <DropdownMenuSub key={category}>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  {category}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[200px]">
                  {products
                    ?.filter(p => p.category === category)
                    .map(product => (
                      <DropdownMenuItem
                        key={product.id}
                        onClick={() => handleProductChange(lead.id, product.name)}
                        className="cursor-pointer"
                      >
                        {product.name}
                      </DropdownMenuItem>
                    ))
                  }
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    payment_link: {
      label: 'Payment Link',
      render: (lead) => lead.payment_link ? (
        <Button
          variant={lead.status === 'paid' ? 'default' : 'outline'}
          size="sm"
          className={`h-8 ${lead.status === 'paid' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(lead.payment_link!);
              toast.success('Link copied to clipboard');
            } catch (err) {
              console.error('Failed to copy:', err);
              toast.error('Failed to copy link');
            }
          }}
        >
          {lead.status === 'paid' ? 'Paid' : 'Copy Link'}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => handleCreatePaymentLink(lead)}
        >
          Create Link
        </Button>
      )
    },
    whatsapp: {
      label: 'WhatsApp',
      render: (lead) => lead.whatsapp ? (
        <a
          href={`https://wa.me/${lead.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-green-600 hover:text-green-700"
        >
          <Phone className="h-3 w-3" /> {lead.whatsapp}
        </a>
      ) : '-'
    },
    updated_at: {
      label: 'Last Updated',
      render: (lead) => format(new Date(lead.updated_at), 'MMM d, yyyy')
    },
    company_id: {
      label: 'Company ID',
      render: (lead) => <span className="text-xs text-muted-foreground">{lead.company_id || '-'}</span>
    }
  }), [products, maskLeads, statuses, owners, handleStatusChange, handleProductChange, handleCreatePaymentLink, getStatusColor, getStatusDisplay]);

  const visibleColumnIds = useMemo(() => {
    if (!columnConfig) {
      // Default order
      return [
        'priority',
        'name',
        'email',
        'phone',
        'college',
        'lead_source',
        'status',
        'owner',
        'created_at',
        'product_purchased',
        'payment_link'
      ];
    }
    return columnConfig.filter(c => c.visible).map(c => c.id).filter(id => columnDefinitions[id]);
  }, [columnConfig, columnDefinitions]);


  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No leads found. Add your first lead to get started!</p>
      </div>
    );
  }

  const allSelected = leads.length > 0 && leads.every((lead) => selectedLeads.has(lead.id));

  const toggleAll = () => {
    if (allSelected) {
      const newSelected = new Set(selectedLeads);
      leads.forEach((lead) => newSelected.delete(lead.id));
      onSelectionChange(newSelected);
    } else {
      const newSelected = new Set(selectedLeads);
      leads.forEach((lead) => newSelected.add(lead.id));
      onSelectionChange(newSelected);
    }
  };

  const toggleOne = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[50px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </TableHead>
              {visibleColumnIds.map(colId => (
                <TableHead key={colId} className="font-semibold">
                  {columnDefinitions[colId]?.label}
                </TableHead>
              ))}
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => (
              <TableRow key={lead.id} className="group animate-row-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedLeads.has(lead.id)}
                    onChange={() => toggleOne(lead.id)}
                  />
                </TableCell>

                {visibleColumnIds.map(colId => (
                  <TableCell key={colId}>
                    {columnDefinitions[colId]?.render(lead)}
                  </TableCell>
                ))}

                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem onClick={() => setViewingLead(lead)}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setViewingHistoryLead(lead)}>
                        View History
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                        Edit Lead
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {statuses.map((status) => (
                            <DropdownMenuItem
                              key={status.id}
                              onClick={() => handleStatusChange(lead.id, status.value)}
                              className="capitalize cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                {lead.status === status.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                <span className={lead.status === status.value ? "font-medium" : ""}>{status.label}</span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem onClick={() => handleCreatePaymentLink(lead)}>
                        Create Payment Link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditLeadDialog
        open={!!editingLead}
        onOpenChange={(open) => !open && setEditingLead(null)}
        lead={editingLead}
      />

      <LeadDetailsDialog
        open={!!viewingLead}
        onOpenChange={(open) => !open && setViewingLead(null)}
        lead={viewingLead}
        owners={owners}
        maskLeads={maskLeads}
      />

      <LeadHistoryDialog
        open={!!viewingHistoryLead}
        onOpenChange={(open) => !open && setViewingHistoryLead(null)}
        lead={viewingHistoryLead}
      />

      {pendingStatus && (
        <StatusReminderDialog
          open={reminderDialogOpen}
          onOpenChange={setReminderDialogOpen}
          status={pendingStatus.status}
          onConfirm={handleReminderConfirm}
          onCancel={handleReminderCancel}
        />
      )}
    </>
  );
});
