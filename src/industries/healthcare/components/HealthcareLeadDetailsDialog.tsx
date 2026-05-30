import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone, Mail, User, Clock, Heart, CalendarDays, CreditCard, FileText, Shield, Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';
import type { HealthcareLead } from './HealthcareLeadsTable';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { useCompany } from '@/hooks/useCompany';
import { AICallerCallButton } from '@/components/ai-caller/AICallerCallButton';

interface HealthcareLeadDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: HealthcareLead | null;
  owners?: { label: string; value: string }[];
  maskLeads?: boolean;
}

export function HealthcareLeadDetailsDialog({ open, onOpenChange, lead, owners = [], maskLeads = false }: HealthcareLeadDetailsDialogProps) {
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
              <User className="h-5 w-5" />
              {lead.name}
              {lead.department && <Badge variant="outline" className="ml-2">{lead.department}</Badge>}
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
            {/* Patient Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Phone className="h-4 w-4" /> Patient Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email:</span><div className="font-medium"><MaskedValue value={lead.email} type="email" enabled={maskLeads} /></div></div>
                <div><span className="text-muted-foreground">Phone:</span><div className="font-medium"><MaskedValue value={lead.phone} type="phone" enabled={maskLeads} /></div></div>
                <div><span className="text-muted-foreground">Age:</span><p className="font-medium">{lead.age || '-'}</p></div>
                <div><span className="text-muted-foreground">Gender:</span><p className="font-medium capitalize">{lead.gender || '-'}</p></div>
                <div><span className="text-muted-foreground">WhatsApp:</span><p className="font-medium">{lead.whatsapp || '-'}</p></div>
                <div><span className="text-muted-foreground">Referral Source:</span><p className="font-medium">{lead.referral_source || '-'}</p></div>
              </div>
            </div>

            <Separator />

            {/* Medical Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Medical Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Department:</span><p className="font-medium">{lead.department || '-'}</p></div>
                <div><span className="text-muted-foreground">Doctor Preference:</span><p className="font-medium">{lead.doctor_preference || '-'}</p></div>
                <div><span className="text-muted-foreground">Condition:</span><p className="font-medium">{lead.condition || '-'}</p></div>
                <div><span className="text-muted-foreground">Treatment Type:</span><p className="font-medium">{lead.treatment_type || '-'}</p></div>
              </div>
              {lead.symptoms && (
                <div className="mt-3"><span className="text-muted-foreground text-sm">Symptoms:</span><p className="text-sm mt-1 bg-muted p-2 rounded">{lead.symptoms}</p></div>
              )}
            </div>

            <Separator />

            {/* Appointment */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Appointment & Treatment</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Appointment Date:</span><p className="font-medium">{lead.appointment_date ? format(new Date(lead.appointment_date), 'PPp') : '-'}</p></div>
                <div><span className="text-muted-foreground">Appointment Time:</span><p className="font-medium">{lead.appointment_time || '-'}</p></div>
                <div><span className="text-muted-foreground">Treatment Date:</span><p className="font-medium">{lead.treatment_date ? format(new Date(lead.treatment_date), 'PP') : '-'}</p></div>
                <div><span className="text-muted-foreground">Follow-up Date:</span><p className="font-medium">{lead.follow_up_date ? format(new Date(lead.follow_up_date), 'PP') : '-'}</p></div>
                <div><span className="text-muted-foreground">Treatment Cost:</span><p className="font-medium">{formatCurrency(lead.treatment_cost)}</p></div>
              </div>
            </div>

            <Separator />

            {/* Insurance */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Shield className="h-4 w-4" /> Insurance Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Provider:</span><p className="font-medium">{lead.insurance_provider || '-'}</p></div>
                <div><span className="text-muted-foreground">Policy ID:</span><p className="font-medium">{lead.insurance_id || '-'}</p></div>
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
              </div>
            </div>

            {lead.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Notes</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">{lead.notes}</p>
                </div>
              </>
            )}

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
