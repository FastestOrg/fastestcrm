import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone, Mail, MapPin, Calendar, User, Home, IndianRupee,
  FileText, Clock, Camera, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import type { RealEstateLead } from './RealEstateLeadsTable';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { useCompany } from '@/hooks/useCompany';
import { AICallerCallButton } from '@/components/ai-caller/AICallerCallButton';

interface RealEstateLeadDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: RealEstateLead | null;
  owners?: { label: string; value: string }[];
  maskLeads?: boolean;
}

export function RealEstateLeadDetailsDialog({
  open,
  onOpenChange,
  lead,
  owners = [],
  maskLeads = false,
}: RealEstateLeadDetailsDialogProps) {
  const { company } = useCompany();
  if (!lead) return null;

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return 'Not assigned';
    return owners.find(o => o.value === ownerId)?.label || 'Unknown';
  };

  const formatBudget = (value: number | null) => {
    if (!value) return '-';
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
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
                  <span className="text-muted-foreground">Phone:</span>
                  <div className="font-medium">
                    <MaskedValue value={lead.phone} type="phone" enabled={maskLeads} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <p className="font-medium">{lead.whatsapp || '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Email:</span>
                  <div className="font-medium">
                    <MaskedValue value={lead.email} type="email" enabled={maskLeads} />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Property Requirements */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Home className="h-4 w-4" /> Property Requirements
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Property Type:</span>
                  <p className="font-medium">{lead.property_type || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Purpose:</span>
                  <p className="font-medium capitalize">{lead.purpose || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Budget Range:</span>
                  <p className="font-medium">
                    {lead.budget_min || lead.budget_max
                      ? `${formatBudget(lead.budget_min)} - ${formatBudget(lead.budget_max)}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <p className="font-medium">{lead.property_size || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Preferred Location:</span>
                  <p className="font-medium">{lead.preferred_location || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Possession Timeline:</span>
                  <p className="font-medium">{lead.possession_timeline || '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Lead Profile */}
            {lead.lead_profile && Object.keys(lead.lead_profile).length > 0 && (
              <>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    Lead Profile
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(lead.lead_profile).map(([key, value]) => (
                      <Badge key={key} variant="secondary">
                        {key}: {String(value)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

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

            {/* Status & Metadata */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Status Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Current Status:</span>
                  <Badge>{lead.status}</Badge>
                </div>
                {lead.status_metadata?.scheduled_at && (
                  <div>
                    <span className="text-muted-foreground">Scheduled:</span>
                    <p className="font-medium">
                      {format(new Date(lead.status_metadata.scheduled_at), 'PPp')}
                    </p>
                  </div>
                )}
                {lead.status_metadata?.rcb_display && (
                  <div>
                    <span className="text-muted-foreground">Callback:</span>
                    <p className="font-medium">{lead.status_metadata.rcb_display}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Site Visit Photos */}
            {lead.site_visit_photos && lead.site_visit_photos.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Site Visit Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {lead.site_visit_photos.map((photo, index) => (
                      <div key={index} className="relative rounded-lg overflow-hidden border">
                        <img
                          src={photo.url}
                          alt={`Site visit ${index + 1}`}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(photo.timestamp), 'PPp')}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                          </div>
                          {photo.verified && (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {lead.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Notes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                    {lead.notes}
                  </p>
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
