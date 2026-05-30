import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone, Mail, User, Clock, Building2, Code, CalendarDays, CreditCard, FileText, Globe, Target,
} from 'lucide-react';
import { format } from 'date-fns';
import type { SaaSLead } from './SaaSLeadsTable';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { DEAL_STAGES } from '../config';
import { useCompany } from '@/hooks/useCompany';
import { AICallerCallButton } from '@/components/ai-caller/AICallerCallButton';

interface SaaSLeadDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: SaaSLead | null;
  owners?: { label: string; value: string }[];
  maskLeads?: boolean;
}

export function SaaSLeadDetailsDialog({ open, onOpenChange, lead, owners = [], maskLeads = false }: SaaSLeadDetailsDialogProps) {
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

  const getDealStageLabel = (value: string | null) => {
    if (!value) return '-';
    return DEAL_STAGES.find(s => s.value === value)?.label || value;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between w-full pr-6 gap-2">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {lead.name}
              {lead.company_name && (
                <span className="text-muted-foreground font-normal text-sm">@ {lead.company_name}</span>
              )}
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
            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" /> Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <div className="font-medium"><MaskedValue value={lead.email} type="email" enabled={maskLeads} /></div>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <div className="font-medium"><MaskedValue value={lead.phone} type="phone" enabled={maskLeads} /></div>
                </div>
                <div>
                  <span className="text-muted-foreground">Job Title:</span>
                  <p className="font-medium">{lead.job_title || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <p className="font-medium">{lead.whatsapp || '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Company Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Company Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Company:</span>
                  <p className="font-medium">{lead.company_name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <p className="font-medium">{lead.company_size ? `${lead.company_size} employees` : '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Website:</span>
                  <p className="font-medium">
                    {lead.company_website ? (
                      <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {lead.company_website}
                      </a>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Product Interest:</span>
                  <p className="font-medium">{lead.product_interest || '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Deal Intelligence */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" /> Deal Intelligence
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Deal Stage:</span>
                  <p className="font-medium">{getDealStageLabel(lead.deal_stage)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Solution:</span>
                  <p className="font-medium">{lead.current_solution || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Decision Maker:</span>
                  <p className="font-medium">{lead.decision_maker || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Champion:</span>
                  <p className="font-medium">{lead.champion || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Competitors:</span>
                  <p className="font-medium">{lead.competitors || '-'}</p>
                </div>
                {lead.loss_reason && (
                  <div>
                    <span className="text-muted-foreground">Loss Reason:</span>
                    <p className="font-medium text-destructive">{lead.loss_reason}</p>
                  </div>
                )}
              </div>
              {lead.use_case && (
                <div className="mt-3">
                  <span className="text-muted-foreground text-sm">Use Case:</span>
                  <p className="text-sm mt-1 bg-muted p-2 rounded">{lead.use_case}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Subscription Details */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Subscription Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Plan Type:</span>
                  <p className="font-medium">{lead.plan_type || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Seats:</span>
                  <p className="font-medium">{lead.seats || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">MRR:</span>
                  <p className="font-medium">{formatCurrency(lead.monthly_value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ARR:</span>
                  <p className="font-medium">{formatCurrency(lead.annual_value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contract Length:</span>
                  <p className="font-medium">{lead.contract_length ? `${lead.contract_length} months` : '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Demo & Trial */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Demo & Trial
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Demo Date:</span>
                  <p className="font-medium">{lead.demo_date ? format(new Date(lead.demo_date), 'PPp') : '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Trial Start:</span>
                  <p className="font-medium">{lead.trial_start_date ? format(new Date(lead.trial_start_date), 'PP') : '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Trial End:</span>
                  <p className="font-medium">{lead.trial_end_date ? format(new Date(lead.trial_end_date), 'PP') : '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Ownership */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" /> Lead Ownership
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Pre-Sales:</span>
                  <p className="font-medium">{getOwnerName(lead.pre_sales_owner_id)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sales:</span>
                  <p className="font-medium">{getOwnerName(lead.sales_owner_id)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Post-Sales:</span>
                  <p className="font-medium">{getOwnerName(lead.post_sales_owner_id)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Status */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Status
              </h3>
              <div className="flex items-center gap-2">
                <Badge>{lead.status}</Badge>
                {lead.lead_source && <Badge variant="outline">{lead.lead_source}</Badge>}
              </div>
            </div>

            {/* Notes */}
            {lead.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Notes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">{lead.notes}</p>
                </div>
              </>
            )}

            {/* Timestamps */}
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
