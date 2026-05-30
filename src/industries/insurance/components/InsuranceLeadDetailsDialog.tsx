import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, Mail, User, Clock, Shield, CalendarDays, CreditCard, FileText, Heart } from 'lucide-react';
import { format } from 'date-fns';
import type { InsuranceLead } from './InsuranceLeadsTable';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { useCompany } from '@/hooks/useCompany';
import { AICallerCallButton } from '@/components/ai-caller/AICallerCallButton';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: InsuranceLead | null;
  owners?: { label: string; value: string }[];
  maskLeads?: boolean;
}

export function InsuranceLeadDetailsDialog({ open, onOpenChange, lead, owners = [], maskLeads = false }: Props) {
  const { company } = useCompany();
  if (!lead) return null;

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return 'Not assigned';
    return owners.find(o => o.value === ownerId)?.label || 'Unknown';
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
    return `₹${value.toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between w-full pr-6 gap-2">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" /> {lead.name}
              {lead.insurance_type && <Badge variant="outline" className="ml-2">{lead.insurance_type}</Badge>}
            </div>
            {company?.ai_calling_button_active && lead.phone && company.id && (
              <AICallerCallButton
                leadId={lead.id}
                leadPhone={lead.phone}
                leadName={lead.name}
                companyId={company.id}
                size="sm"
              />
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Personal Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Phone className="h-4 w-4" /> Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email:</span><div className="font-medium"><MaskedValue value={lead.email} type="email" enabled={maskLeads} /></div></div>
                <div><span className="text-muted-foreground">Phone:</span><div className="font-medium"><MaskedValue value={lead.phone} type="phone" enabled={maskLeads} /></div></div>
                <div><span className="text-muted-foreground">Age:</span><p className="font-medium">{lead.age || '-'}</p></div>
                <div><span className="text-muted-foreground">Gender:</span><p className="font-medium">{lead.gender || '-'}</p></div>
                <div><span className="text-muted-foreground">PAN Number:</span><p className="font-medium">{lead.pan_number || '-'}</p></div>
                <div><span className="text-muted-foreground">DOB:</span><p className="font-medium">{lead.date_of_birth ? format(new Date(lead.date_of_birth), 'PP') : '-'}</p></div>
                <div><span className="text-muted-foreground">Occupation:</span><p className="font-medium">{lead.occupation || '-'}</p></div>
                <div><span className="text-muted-foreground">Annual Income:</span><p className="font-medium">{formatCurrency(lead.annual_income)}</p></div>
              </div>
            </div>
            <Separator />
            {/* Insurance Details */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Shield className="h-4 w-4" /> Insurance Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Insurance Type:</span><p className="font-medium">{lead.insurance_type || '-'}</p></div>
                <div><span className="text-muted-foreground">Plan Name:</span><p className="font-medium">{lead.plan_name || '-'}</p></div>
                <div><span className="text-muted-foreground">Sum Insured:</span><p className="font-medium">{formatCurrency(lead.sum_insured)}</p></div>
                <div><span className="text-muted-foreground">Premium Amount:</span><p className="font-medium">{formatCurrency(lead.premium_amount)}</p></div>
                <div><span className="text-muted-foreground">Contribution:</span><p className="font-medium">{lead.contribution_frequency || '-'}</p></div>
                <div><span className="text-muted-foreground">Policy Term:</span><p className="font-medium">{lead.policy_term ? `${lead.policy_term} years` : '-'}</p></div>
                <div><span className="text-muted-foreground">Existing Policies:</span><p className="font-medium">{lead.existing_policies || '-'}</p></div>
                <div><span className="text-muted-foreground">Agent:</span><p className="font-medium">{lead.agent_name || '-'}</p></div>
              </div>
            </div>
            <Separator />
            {/* Nominee */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Heart className="h-4 w-4" /> Nominee Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Nominee:</span><p className="font-medium">{lead.nominee_name || '-'}</p></div>
                <div><span className="text-muted-foreground">Relation:</span><p className="font-medium">{lead.nominee_relation || '-'}</p></div>
              </div>
            </div>
            <Separator />
            {/* Policy Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Policy Information</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Policy #:</span><p className="font-medium">{lead.policy_number || '-'}</p></div>
                <div><span className="text-muted-foreground">Start Date:</span><p className="font-medium">{lead.policy_start_date ? format(new Date(lead.policy_start_date), 'PP') : '-'}</p></div>
                <div><span className="text-muted-foreground">Renewal Date:</span><p className="font-medium">{lead.renewal_date ? format(new Date(lead.renewal_date), 'PP') : '-'}</p></div>
              </div>
            </div>
            <Separator />
            {/* Financial */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Financial</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Revenue Projected:</span><p className="font-medium">{formatCurrency(lead.revenue_projected)}</p></div>
                <div><span className="text-muted-foreground">Revenue Received:</span><p className="font-medium">{formatCurrency(lead.revenue_received)}</p></div>
              </div>
            </div>
            <Separator />
            {/* Ownership */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><User className="h-4 w-4" /> Lead Ownership</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Pre-Sales:</span><p className="font-medium">{getOwnerName(lead.pre_sales_owner_id)}</p></div>
                <div><span className="text-muted-foreground">Sales:</span><p className="font-medium">{getOwnerName(lead.sales_owner_id)}</p></div>
                <div><span className="text-muted-foreground">Post-Sales:</span><p className="font-medium">{getOwnerName(lead.post_sales_owner_id)}</p></div>
              </div>
            </div>
            <Separator />
            {/* Status */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Status</h3>
              <div className="flex items-center gap-2">
                <Badge>{lead.status}</Badge>
                {lead.lead_source && <Badge variant="outline">{lead.lead_source}</Badge>}
                {lead.loss_reason && <Badge variant="destructive">{lead.loss_reason}</Badge>}
              </div>
            </div>
            {lead.notes && (<><Separator /><div><h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Notes</h3><p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">{lead.notes}</p></div></>)}
            <Separator />
            <div className="text-xs text-muted-foreground">
              <p>Created: {format(new Date(lead.created_at), 'PPp')}</p>
              <p>Updated: {format(new Date(lead.updated_at), 'PPp')}</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
