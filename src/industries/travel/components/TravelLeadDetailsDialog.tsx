import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, Mail, User, Clock, Plane, CalendarDays, CreditCard, FileText, MapPin, Hotel } from 'lucide-react';
import { format } from 'date-fns';
import type { TravelLead } from './TravelLeadsTable';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { useCompany } from '@/hooks/useCompany';
import { AICallerCallButton } from '@/components/ai-caller/AICallerCallButton';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: TravelLead | null;
  owners?: { label: string; value: string }[];
  maskLeads?: boolean;
}

export function TravelLeadDetailsDialog({ open, onOpenChange, lead, owners = [], maskLeads = false }: Props) {
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
              {lead.trip_type && <Badge variant="outline" className="ml-2">{lead.trip_type}</Badge>}
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
            {/* Guest Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Phone className="h-4 w-4" /> Guest Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email:</span><div className="font-medium"><MaskedValue value={lead.email} type="email" enabled={maskLeads} /></div></div>
                <div><span className="text-muted-foreground">Phone:</span><div className="font-medium"><MaskedValue value={lead.phone} type="phone" enabled={maskLeads} /></div></div>
                <div><span className="text-muted-foreground">WhatsApp:</span><div className="font-medium"><MaskedValue value={lead.whatsapp} type="phone" enabled={maskLeads} /></div></div>
                <div><span className="text-muted-foreground">Lead Source:</span><p className="font-medium">{lead.lead_source || '-'}</p></div>
              </div>
            </div>
            <Separator />
            {/* Trip Details */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Trip Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Destination:</span><p className="font-medium">{lead.destination || '-'}</p></div>
                <div><span className="text-muted-foreground">Trip Type:</span><p className="font-medium">{lead.trip_type || '-'}</p></div>
                <div><span className="text-muted-foreground">Travel Date:</span><p className="font-medium">{lead.travel_date ? format(new Date(lead.travel_date), 'PP') : '-'}</p></div>
                <div><span className="text-muted-foreground">Return Date:</span><p className="font-medium">{lead.return_date ? format(new Date(lead.return_date), 'PP') : '-'}</p></div>
                <div><span className="text-muted-foreground">No. of Travelers:</span><p className="font-medium">{lead.travelers_count || '-'}</p></div>
                <div><span className="text-muted-foreground">Package Type:</span><p className="font-medium">{lead.package_type || '-'}</p></div>
                <div><span className="text-muted-foreground">Budget:</span><p className="font-medium">{formatCurrency(lead.budget)}</p></div>
                <div><span className="text-muted-foreground">Special Requests:</span><p className="font-medium">{lead.special_requests || '-'}</p></div>
              </div>
            </div>
            <Separator />
            {/* Booking Info */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Hotel className="h-4 w-4" /> Booking Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Booking ID:</span><p className="font-medium">{lead.booking_id || '-'}</p></div>
                <div><span className="text-muted-foreground">Hotel:</span><p className="font-medium">{lead.hotel_name || '-'}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground">Flight Details:</span><p className="font-medium">{lead.flight_details || '-'}</p></div>
              </div>
            </div>
            <Separator />
            {/* Financial */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Financial</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Package Cost:</span><p className="font-medium">{formatCurrency(lead.package_cost)}</p></div>
                <div><span className="text-muted-foreground">Advance Paid:</span><p className="font-medium">{formatCurrency(lead.advance_paid)}</p></div>
                <div><span className="text-muted-foreground">Balance Due:</span><p className="font-medium">{formatCurrency(lead.balance_due)}</p></div>
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
