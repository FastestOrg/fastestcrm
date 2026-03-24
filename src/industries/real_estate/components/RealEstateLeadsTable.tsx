
import { useState, useMemo } from 'react';
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
import { Phone, Mail, MoreHorizontal, MapPin, Camera, ChevronDown } from 'lucide-react';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { RealEstateEditLeadDialog } from './RealEstateEditLeadDialog';
import { RealEstateLeadDetailsDialog } from './RealEstateLeadDetailsDialog';
import { SiteVisitCameraDialog } from './SiteVisitCameraDialog';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { LeadHistoryDialog } from '@/components/leads/LeadHistoryDialog';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';

import { MaskedValue } from '@/components/ui/MaskedValue';

export interface RealEstateLead {
  id: string;
  company_id: string | null;
  created_by_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  lead_source: string | null;
  pre_sales_owner_id: string | null;
  sales_owner_id: string | null;
  post_sales_owner_id: string | null;
  property_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
  property_size: string | null;
  purpose: string | null;
  possession_timeline: string | null;
  broker_name: string | null;
  property_name: string | null;
  unit_number: string | null;
  deal_value: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  lead_profile: Record<string, any>;
  notes: string | null;
  status: string;
  status_metadata: Record<string, any>;
  site_visit_photos: Array<{
    url: string;
    timestamp: string;
    lat: number;
    lng: number;
    verified: boolean;
  }>;
  revenue_projected: number | null;
  revenue_received: number | null;
  payment_link: string | null;
  created_at: string;
  updated_at: string;
  reminder_at: string | null;
  lead_history?: any[] | null;
  // Joined fields
  pre_sales_owner?: { full_name: string | null } | null;
  sales_owner?: { full_name: string | null } | null;
  post_sales_owner?: { full_name: string | null } | null;
}

interface ColumnConfigItem {
  id: string;
  visible: boolean;
}

interface RealEstateLeadsTableProps {
  leads: RealEstateLead[];
  loading: boolean;
  selectedLeads: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  owners?: { label: string; value: string }[];
  onRefetch: () => void;
  columnConfig?: ColumnConfigItem[];
  maskLeads?: boolean;
}

interface ProfileLevel {
  id: string;
  label: string;
  children: ProfileLevel[];
}

export function RealEstateLeadsTable({
  leads,
  loading,
  selectedLeads,
  onSelectionChange,
  owners = [],
  onRefetch,
  columnConfig,
  maskLeads = false
}: RealEstateLeadsTableProps) {
  const { statuses, getStatusColor } = useLeadStatuses();
  const { company } = useCompany();
  const [editingLead, setEditingLead] = useState<RealEstateLead | null>(null);
  const [viewingLead, setViewingLead] = useState<RealEstateLead | null>(null);
  const [viewingHistoryLead, setViewingHistoryLead] = useState<RealEstateLead | null>(null);

  const [cameraDialogLead, setCameraDialogLead] = useState<RealEstateLead | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ leadId: string; status: CompanyLeadStatus } | null>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // New state for Notes editing
  const [notesBuffer, setNotesBuffer] = useState<Record<string, string>>({});

  // Fetch Profiling Config
  const { data: profilingConfig } = useQuery({
    queryKey: ['lead-profiling-config', company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      const { data, error } = await supabase
        .from('lead_profiling_config')
        .select('config')
        .eq('company_id', company.id)
        .eq('industry', 'real_estate')
        .maybeSingle();

      if (error) {
        console.error('Error fetching profiling config', error);
        return null;
      }
      return (data?.config as unknown) as { levels: ProfileLevel[] } | null;
    },
    enabled: !!company?.id
  });

  const handleUpdateField = async (leadId: string, field: keyof RealEstateLead, value: any) => {
    try {
      const { error } = await supabase
        .from('leads_real_estate')
        .update({ [field]: value })
        .eq('id', leadId);

      if (error) throw error;
      toast.success(`${field.toString().replace(/_/g, ' ')} updated`);
      onRefetch();
    } catch (error) {
      console.error(`Error updating ${field}: `, error);
      toast.error(`Failed to update ${field} `);
    }
  };

  const handleProfileChange = async (leadId: string, pathJson: string) => {
    try {
      const pathIds = JSON.parse(pathJson);
      const newProfile: Record<string, any> = {};

      let currentLevels = profilingConfig?.levels;
      pathIds.forEach((id: string, index: number) => {
        const levelNode = currentLevels?.find(l => l.id === id);
        if (levelNode) {
          newProfile[`Level ${index + 1} `] = levelNode.label;
          currentLevels = levelNode.children;
        }
      });

      await handleUpdateField(leadId, 'lead_profile', newProfile);

    } catch (e) {
      console.error("Error updating profile", e);
      toast.error("Failed to update profile");
    }
  };


  const handleStatusChange = async (leadId: string, newStatusValue: string, metadata?: Record<string, any>) => {
    const newStatus = statuses?.find(s => s.value === newStatusValue);

    // Check if status requires date/time input (Derived Status)
    if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived') && !metadata) {
      setPendingStatus({ leadId, status: newStatus });
      setReminderDialogOpen(true);
      return;
    }

    try {
      const updateData: any = { status: newStatusValue };
      if (metadata) {
        if (metadata.reminder_at) {
          updateData.reminder_at = metadata.reminder_at;
          delete metadata.reminder_at;
        }
        if (metadata.send_web_push === true) {
          updateData.send_web_push = true;
          updateData.last_notification_sent_at = null;
        }
        delete metadata.send_web_push;
        if (Object.keys(metadata).length > 0) {
          updateData.status_metadata = metadata;
        }
      } else {
        if (newStatus && newStatus.status_type === 'simple') {
          updateData.reminder_at = null;
        }
      }

      const { error } = await supabase
        .from('leads_real_estate')
        .update(updateData)
        .eq('id', leadId);

      if (error) throw error;

      toast.success('Status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['real-estate-leads'] });
      onRefetch();
    } catch (error) {
      console.error('Error updating status:', error);
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

  const getStatusDisplay = (lead: RealEstateLead) => {
    const status = statuses.find(s => s.value === lead.status);
    const label = status?.label || lead.status;

    if (lead.reminder_at && (status?.status_type === 'date_derived' || status?.status_type === 'time_derived')) {
      try {
        return `${label} - ${format(new Date(lead.reminder_at), 'dd MMM, hh:mm a')}`;
      } catch (e) {
        return label;
      }
    }

    // Legacy fallback
    if (lead.status === 'request_callback' && lead.status_metadata?.rcb_display) {
      return lead.status_metadata.rcb_display;
    }
    if (lead.status === 'site_visit' && lead.status_metadata?.scheduled_at) {
      return `Site Visit - ${format(new Date(lead.status_metadata.scheduled_at), 'dd MMM, hh:mm a')} `;
    }

    return label;
  };

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return '-';
    const formatNum = (n: number) => {
      if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
      return `₹${n.toLocaleString()} `;
    };
    if (min && max) return `${formatNum(min)} - ${formatNum(max)} `;
    if (min) return `${formatNum(min)} +`;
    return `Up to ${formatNum(max!)} `;
  };

  // Define Column Renderers
  const columnDefinitions: Record<string, { label: string, minWidth?: string, render: (lead: RealEstateLead) => React.ReactNode }> = {
    name: {
      label: 'Name',
      minWidth: 'min-w-[150px]',
      render: (lead) => <div className="font-medium">{lead.name}</div>
    },
    contact: {
      label: 'Contact',
      minWidth: 'min-w-[150px]',
      render: (lead) => (
        <div className="flex flex-col gap-1">
          {lead.phone && (
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Phone className="h-3 w-3" /> {lead.phone}
            </span>
          )}
          {lead.email && (
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Mail className="h-3 w-3" /> {lead.email}
            </span>
          )}
        </div>
      )
    },
    property_name: {
      label: 'Property Name',
      minWidth: 'min-w-[120px]',
      render: (lead) => lead.property_name || '-'
    },
    lead_source: {
      label: 'Lead Source',
      minWidth: 'min-w-[120px]',
      render: (lead) => lead.lead_source || '-'
    },
    property_type: {
      label: 'Property Type',
      minWidth: 'min-w-[120px]',
      render: (lead) => <Badge variant="outline">{lead.property_type || '-'}</Badge>
    },
    budget: {
      label: 'Budget',
      minWidth: 'min-w-[120px]',
      render: (lead) => formatBudget(lead.budget_min, lead.budget_max)
    },
    location: {
      label: 'Location',
      minWidth: 'min-w-[120px]',
      render: (lead) => lead.preferred_location ? (
        <span className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3" /> {lead.preferred_location}
        </span>
      ) : '-'
    },
    lead_profile: {
      label: 'Lead Profile',
      minWidth: 'min-w-[200px]',
      render: (lead) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-full justify-start px-2 font-normal text-xs border-transparent hover:border-input focus:border-input p-0"
            >
              {lead.lead_profile && Object.keys(lead.lead_profile).length > 0 ? (
                <span className="truncate">{Object.values(lead.lead_profile).filter(Boolean).join(' > ')}</span>
              ) : <span className="text-muted-foreground opacity-50">Select Profile</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            {profilingConfig?.levels?.map((level) => {
              const renderLevel = (currLevel: ProfileLevel, path: string[]) => {
                const newPath = [...path, currLevel.id];
                if (currLevel.children && currLevel.children.length > 0) {
                  return (
                    <DropdownMenuSub key={currLevel.id}>
                      <DropdownMenuSubTrigger className="text-xs">
                        {currLevel.label}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {currLevel.children.map(child => renderLevel(child, newPath))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                }
                return (
                  <DropdownMenuItem
                    key={currLevel.id}
                    className="text-xs"
                    onClick={() => handleProfileChange(lead.id, JSON.stringify(newPath))}
                  >
                    {currLevel.label}
                  </DropdownMenuItem>
                );
              };
              return renderLevel(level, []);
            }) || <div className="p-2 text-xs text-muted-foreground">No profiles configured</div>}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    status: {
      label: 'Status',
      minWidth: 'min-w-[150px]',
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
    pre_sales_owner: {
      label: 'Pre-Sales',
      minWidth: 'min-w-[150px]',
      render: (lead) => (
        <Select
          value={lead.pre_sales_owner_id || 'unassigned'}
          onValueChange={(val) => handleUpdateField(lead.id, 'pre_sales_owner_id', val === 'unassigned' ? null : val)}
        >
          <SelectTrigger className="h-8 w-full border-transparent hover:border-input focus:border-input bg-transparent text-xs p-0 px-2 justify-start font-normal">
            {lead.pre_sales_owner?.full_name || owners.find(o => o.value === lead.pre_sales_owner_id)?.label || <span className="text-muted-foreground opacity-50">Assign</span>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {owners.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    },
    sales_owner: {
      label: 'Sales',
      minWidth: 'min-w-[150px]',
      render: (lead) => (
        <Select
          value={lead.sales_owner_id || 'unassigned'}
          onValueChange={(val) => handleUpdateField(lead.id, 'sales_owner_id', val === 'unassigned' ? null : val)}
        >
          <SelectTrigger className="h-8 w-full border-transparent hover:border-input focus:border-input bg-transparent text-xs p-0 px-2 justify-start font-normal">
            {lead.sales_owner?.full_name || owners.find(o => o.value === lead.sales_owner_id)?.label || <span className="text-muted-foreground opacity-50">Assign</span>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {owners.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    },
    post_sales_owner: {
      label: 'Post-Sales',
      minWidth: 'min-w-[150px]',
      render: (lead) => (
        <Select
          value={lead.post_sales_owner_id || 'unassigned'}
          onValueChange={(val) => handleUpdateField(lead.id, 'post_sales_owner_id', val === 'unassigned' ? null : val)}
        >
          <SelectTrigger className="h-8 w-full border-transparent hover:border-input focus:border-input bg-transparent text-xs p-0 px-2 justify-start font-normal">
            {lead.post_sales_owner?.full_name || owners.find(o => o.value === lead.post_sales_owner_id)?.label || <span className="text-muted-foreground opacity-50">Assign</span>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {owners.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    },
    notes: {
      label: 'Notes',
      minWidth: 'min-w-[200px]',
      render: (lead) => (
        <Textarea
          className="min-h-[60px] text-xs resize-none border-transparent hover:border-input focus:border-input bg-transparent p-2 shadow-none"
          placeholder="Add notes..."
          value={notesBuffer[lead.id] !== undefined ? notesBuffer[lead.id] : (lead.notes || '')}
          onChange={(e) => setNotesBuffer(prev => ({ ...prev, [lead.id]: e.target.value }))}
          onBlur={(e) => {
            if (lead.notes !== e.target.value) {
              handleUpdateField(lead.id, 'notes', e.target.value);
            }
            const newBuffer = { ...notesBuffer };
            delete newBuffer[lead.id];
            setNotesBuffer(newBuffer);
          }}
        />
      )
    },
    created_at: {
      label: 'Date',
      minWidth: 'min-w-[120px]',
      render: (lead) => <span className="text-sm">{format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
    },
    site_visit: {
      label: 'Site Visit',
      minWidth: 'min-w-[100px]',
      render: (lead) => (
        <Button
          variant={lead.site_visit_photos && lead.site_visit_photos.length > 0 ? "outline" : "secondary"}
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => setCameraDialogLead(lead)}
        >
          <Camera className="h-3 w-3" />
          {lead.site_visit_photos && lead.site_visit_photos.length > 0 ? 'View/Add' : 'Record'}
        </Button>
      )
    },
    // New available columns
    email: {
      label: 'Email',
      minWidth: 'min-w-[150px]',
      render: (lead) => lead.email ? (
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <Mail className="h-3 w-3" />
          <MaskedValue value={lead.email} type="email" enabled={maskLeads} />
        </span>
      ) : '-'
    },
    phone: {
      label: 'Phone',
      minWidth: 'min-w-[120px]',
      render: (lead) => lead.phone ? (
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <Phone className="h-3 w-3" />
          <MaskedValue value={lead.phone} type="phone" enabled={maskLeads} />
        </span>
      ) : '-'
    },
    whatsapp: {
      label: 'WhatsApp',
      minWidth: 'min-w-[120px]',
      render: (lead) => lead.whatsapp ? (
        <a
          href={`https://wa.me/${lead.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-green-600 hover:text-green-700 text-xs"
        >
          <Phone className="h-3 w-3" /> {lead.whatsapp}
        </a>
      ) : '-'
    },
    budget_min: {
      label: 'Min Budget',
      minWidth: 'min-w-[100px]',
      render: (lead) => formatBudget(lead.budget_min, null)
    },
    budget_max: {
      label: 'Max Budget',
      minWidth: 'min-w-[100px]',
      render: (lead) => formatBudget(null, lead.budget_max)
    },
    property_size: {
      label: 'Property Size',
      minWidth: 'min-w-[100px]',
      render: (lead) => lead.property_size || '-'
    },
    possession_timeline: {
      label: 'Possession',
      minWidth: 'min-w-[120px]',
      render: (lead) => lead.possession_timeline || '-'
    },
    broker_name: {
      label: 'Broker Name',
      minWidth: 'min-w-[120px]',
      render: (lead) => lead.broker_name || '-'
    },
    unit_number: {
      label: 'Unit No.',
      minWidth: 'min-w-[80px]',
      render: (lead) => lead.unit_number || '-'
    },
    deal_value: {
      label: 'Deal Value',
      minWidth: 'min-w-[100px]',
      render: (lead) => lead.deal_value ? `₹${lead.deal_value.toLocaleString()}` : '-'
    },
    commission_percentage: {
      label: 'Commission %',
      minWidth: 'min-w-[80px]',
      render: (lead) => lead.commission_percentage ? `${lead.commission_percentage}%` : '-'
    },
    commission_amount: {
      label: 'Commission Amount',
      minWidth: 'min-w-[100px]',
      render: (lead) => lead.commission_amount ? `₹${lead.commission_amount.toLocaleString()}` : '-'
    },
    revenue_projected: {
      label: 'Revenue Projected',
      minWidth: 'min-w-[100px]',
      render: (lead) => lead.revenue_projected ? `₹${lead.revenue_projected.toLocaleString()}` : '-'
    },
    revenue_received: {
      label: 'Revenue Received',
      minWidth: 'min-w-[100px]',
      render: (lead) => lead.revenue_received ? `₹${lead.revenue_received.toLocaleString()}` : '-'
    },
    updated_at: {
      label: 'Last Updated',
      minWidth: 'min-w-[120px]',
      render: (lead) => <span className="text-xs text-muted-foreground">{format(new Date(lead.updated_at), 'MMM d, yyyy')}</span>
    },
    purpose: {
      label: 'Purpose',
      minWidth: 'min-w-[100px]',
      render: (lead) => lead.purpose || '-'
    }
  };


  const visibleColumnIds = useMemo(() => {
    if (!columnConfig) {
      // Old default order
      return [
        'name',
        'contact',
        'property_name',
        'lead_source',
        'property_type',
        'budget',
        'location',
        'lead_profile',
        'status',
        'pre_sales_owner',
        'sales_owner',
        'post_sales_owner',
        'notes',
        'created_at',
        'site_visit'
      ];
    }
    return columnConfig.filter(c => c.visible).map(c => c.id).filter(id => columnDefinitions[id]);
  }, [columnConfig]);

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
        <p>No leads found. Add your first real estate lead to get started!</p>
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
                <TableHead key={colId} className={`font-semibold ${columnDefinitions[colId]?.minWidth || ''}`}>
                  {columnDefinitions[colId]?.label}
                </TableHead>
              ))}
              <TableHead className="font-semibold w-[50px]">Actions</TableHead>
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
                  <TableCell key={colId} className="align-top py-3">
                    {columnDefinitions[colId]?.render(lead)}
                  </TableCell>
                ))}

                <TableCell className="align-top py-3">
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
                      <DropdownMenuSeparator />
                      {lead.status === 'site_visit' && (
                        <DropdownMenuItem onClick={() => setCameraDialogLead(lead)}>
                          📸 Capture Site Visit Photo
                        </DropdownMenuItem>
                      )}
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RealEstateEditLeadDialog
        open={!!editingLead}
        onOpenChange={(open) => !open && setEditingLead(null)}
        lead={editingLead}
        onSuccess={onRefetch}
      />

      <RealEstateLeadDetailsDialog
        open={!!viewingLead}
        onOpenChange={(open) => !open && setViewingLead(null)}
        lead={viewingLead}
        owners={owners}
        maskLeads={maskLeads}
      />

      <LeadHistoryDialog
        open={!!viewingHistoryLead}
        onOpenChange={(open) => !open && setViewingHistoryLead(null)}
        lead={viewingHistoryLead as any}
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

      <SiteVisitCameraDialog
        open={!!cameraDialogLead}
        onOpenChange={(open) => !open && setCameraDialogLead(null)}
        lead={cameraDialogLead}
        onSuccess={onRefetch}
      />
    </>
  );
}
