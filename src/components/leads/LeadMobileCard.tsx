import { Phone, Mail, MoreHorizontal, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { format } from 'date-fns';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { cn } from '@/lib/utils';

interface LeadMobileCardProps {
  lead: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onViewDetails: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  onCreatePaymentLink?: () => void;
  owners?: { label: string; value: string }[];
  variant?: 'education' | 'real_estate';
}

export function LeadMobileCard({
  lead,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onEdit,
  onStatusChange,
  onCreatePaymentLink,
  owners = [],
  variant = 'education'
}: LeadMobileCardProps) {
  const { statuses, getStatusColor } = useLeadStatuses();

  const getOwnerName = (ownerId: string | null, ownerObj?: { full_name: string | null } | null) => {
    if (ownerObj?.full_name) return ownerObj.full_name;
    if (!ownerId) return '-';
    return owners.find(o => o.value === ownerId)?.label || 'Unknown';
  };

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    const formatNum = (n: number) => {
      if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
      return `₹${n.toLocaleString()}`;
    };
    if (min && max) return `${formatNum(min)} - ${formatNum(max)}`;
    if (min) return `${formatNum(min)}+`;
    return `Up to ${formatNum(max!)}`;
  };

  const statusColor = getStatusColor(lead.status);

  const getStatusDisplay = () => {
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

  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-4 space-y-3",
      isSelected && "ring-2 ring-primary"
    )}>
      {/* Header: Checkbox, Name, Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{lead.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(lead.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewDetails}>View Details</DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>Edit Lead</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {statuses.map((status) => (
                  <DropdownMenuItem
                    key={status.id}
                    onClick={() => onStatusChange(status.value)}
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
            {onCreatePaymentLink && (
              <DropdownMenuItem onClick={onCreatePaymentLink}>
                Create Payment Link
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Contact Info */}
      <div className="flex flex-wrap gap-3 text-sm">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>{lead.phone}</span>
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground truncate">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </a>
        )}
      </div>

      {/* Industry-specific fields */}
      {variant === 'real_estate' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {lead.property_type && (
              <Badge variant="outline" className="text-xs">
                {lead.property_type}
              </Badge>
            )}
            {formatBudget(lead.budget_min, lead.budget_max) && (
              <Badge variant="secondary" className="text-xs">
                {formatBudget(lead.budget_min, lead.budget_max)}
              </Badge>
            )}
            {lead.preferred_location && (
              <Badge variant="outline" className="text-xs">
                📍 {lead.preferred_location}
              </Badge>
            )}
          </div>
          {/* Owners row for real estate */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Pre-Sales:</span>
              <p className="font-medium truncate">{getOwnerName(lead.pre_sales_owner_id, lead.pre_sales_owner)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sales:</span>
              <p className="font-medium truncate">{getOwnerName(lead.sales_owner_id, lead.sales_owner)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Post-Sales:</span>
              <p className="font-medium truncate">{getOwnerName(lead.post_sales_owner_id, lead.post_sales_owner)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lead.college && (
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              {lead.college}
            </Badge>
          )}
          {lead.product_purchased && (
            <Badge variant="secondary" className="text-xs">
              {lead.product_purchased}
            </Badge>
          )}
          {lead.sales_owner?.full_name && (
            <Badge variant="outline" className="text-xs">
              Owner: {lead.sales_owner.full_name}
            </Badge>
          )}
        </div>
      )}

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <Badge
          className="text-white text-xs"
          style={{ backgroundColor: statusColor }}
        >
          {getStatusDisplay()}
        </Badge>
        {lead.lead_source && (
          <span className="text-xs text-muted-foreground">
            via {lead.lead_source}
          </span>
        )}
      </div>
    </div>
  );
}
