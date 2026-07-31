import { useState, useRef, TouchEvent } from 'react';
import { Phone, Mail, MoreHorizontal, Building2, PhoneCall, ArrowRight } from 'lucide-react';
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
import { Tables } from "@/integrations/supabase/types";
import { MaskedValue } from '@/components/ui/MaskedValue';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { cn } from '@/lib/utils';

interface SwipeableLeadCardProps {
  lead: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onViewDetails: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  onCall?: () => void;
  onCreatePaymentLink?: () => void;
  owners?: { label: string; value: string }[];
  variant?: 'education' | 'real_estate' | 'default';
  visibleAttributes?: { id: string; visible?: boolean; label?: string; defaultHidden?: boolean }[];
  maskLeads?: boolean;
}

export function SwipeableLeadCard({
  lead,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onEdit,
  onStatusChange,
  onCall,
  onCreatePaymentLink,
  owners = [],
  variant = 'education',
  visibleAttributes,
  maskLeads = false
}: SwipeableLeadCardProps) {
  const { statuses, getStatusColor } = useLeadStatuses();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 120;

  // Render Helper
  const renderField = (lead: any, columnId: string) => {
    switch (columnId) {
      case 'lead_source': return lead.lead_source;
      case 'college': return lead.college;
      case 'product_purchased': return lead.product_purchased;
      case 'payment_link': return lead.payment_link ? <a href={lead.payment_link} target="_blank" className="text-blue-500 underline">Link</a> : null;
      case 'whatsapp': return lead.whatsapp;
      case 'owner': return lead.sales_owner?.full_name;
      case 'updated_at': return lead.updated_at ? format(new Date(lead.updated_at), 'MMM d') : null;
      case 'company_id': return lead.company_id;

      // Real Estate
      case 'property_name': return lead.property_name;
      case 'property_type': return lead.property_type;
      case 'budget': return formatBudget(lead.budget_min, lead.budget_max);
      case 'location': return lead.preferred_location;
      case 'lead_profile': {
        if (lead.lead_profile && typeof lead.lead_profile === 'object') {
          const values = Object.values(lead.lead_profile).filter(Boolean);
          return values.length > 0 ? values.join(' > ') : null;
        }
        return lead.lead_profile;
      }
      case 'pre_sales_owner': return getOwnerName(lead.pre_sales_owner_id, lead.pre_sales_owner);
      case 'sales_owner': return getOwnerName(lead.sales_owner_id, lead.sales_owner);
      case 'post_sales_owner': return getOwnerName(lead.post_sales_owner_id, lead.post_sales_owner);
      case 'notes': return lead.notes;
      case 'site_visit': return lead.site_visit ? format(new Date(lead.site_visit), 'MMM d, h:mm a') : null;
      case 'budget_min': return lead.budget_min;
      case 'budget_max': return lead.budget_max;
      case 'property_size': return lead.property_size;
      case 'possession_timeline': return lead.possession_timeline;
      case 'broker_name': return lead.broker_name;
      case 'unit_number': return lead.unit_number;
      case 'deal_value': return lead.deal_value;
      case 'commission_percentage': return lead.commission_percentage;
      case 'commission_amount': return lead.commission_amount;
      case 'revenue_projected': return lead.revenue_projected;
      case 'revenue_received': return lead.revenue_received;
      case 'purpose': return lead.purpose;
      case 'created_at': return lead.created_at ? format(new Date(lead.created_at), 'MMM d') : null;

      default: return lead[columnId];
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setIsSwipeActive(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwipeActive) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;

    // Allow both left and right swipes
    const clampedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
    setSwipeOffset(clampedDiff);
  };

  const handleTouchEnd = () => {
    setIsSwipeActive(false);

    if (swipeOffset > SWIPE_THRESHOLD && lead.phone) {
      // Swipe right - Call
      window.location.href = `tel:${lead.phone}`;
    } else if (swipeOffset < -SWIPE_THRESHOLD) {
      // Swipe left - Quick status change (cycle to next status)
      const currentIndex = statuses.findIndex(s => s.value === lead.status);
      const nextIndex = (currentIndex + 1) % statuses.length;
      onStatusChange(statuses[nextIndex].value);
    }

    // Reset swipe
    setSwipeOffset(0);
  };

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
    <div className="relative overflow-hidden rounded-lg">
      {/* Left swipe action (Call) */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center justify-center bg-green-500 transition-opacity",
          swipeOffset > 20 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: Math.abs(swipeOffset) }}
      >
        <PhoneCall className="h-6 w-6 text-white" />
      </div>

      {/* Right swipe action (Change Status) */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center bg-blue-500 transition-opacity",
          swipeOffset < -20 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: Math.abs(swipeOffset) }}
      >
        <ArrowRight className="h-6 w-6 text-white" />
      </div>

      {/* Main Card */}
      <div
        className={cn(
          "bg-card border border-border p-4 space-y-3 transition-transform",
          isSelected && "ring-2 ring-primary"
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwipeActive ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
              {lead.phone && (
                <DropdownMenuItem onClick={() => window.location.href = `tel:${lead.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call Lead
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={lead.status} onValueChange={onStatusChange}>
                    {statuses.map((status) => (
                      <DropdownMenuRadioItem
                        key={status.id}
                        value={status.value}
                        className="capitalize"
                      >
                        {status.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
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
            <div className="flex items-center gap-1.5 text-muted-foreground w-full">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <MaskedValue value={lead.phone} type="phone" enabled={maskLeads} className="text-sm" showIcon={false} />
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground w-full overflow-hidden">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <MaskedValue value={lead.email} type="email" enabled={maskLeads} className="text-sm truncate" showIcon={false} />
            </div>
          )}
        </div>

        {/* Dynamic Fields based on visibleAttributes */}
        <div className="flex flex-wrap gap-2 text-xs">
          {visibleAttributes && visibleAttributes.length > 0 ? (
            visibleAttributes.map((col) => {
              // Skip fixed fields that are already shown elsewhere
              if (['name', 'contact', 'status', 'email', 'phone', 'actions'].includes(col.id)) return null;

              const val = renderField(lead, col.id);
              if (!val) return null;

              return (
                <div key={col.id} className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
                  <span className="text-muted-foreground font-medium">{col.label}:</span>
                  <span>{val}</span>
                </div>
              );
            })
          ) : (
            // Fallback to legacy variant logic if no columns provided
            variant === 'real_estate' ? (
              <>
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
                {/* Owners */}
                <div className="w-full grid grid-cols-2 gap-2 mt-1">
                  {lead.pre_sales_owner && (
                    <div><span className="text-muted-foreground">Pre:</span> {getOwnerName(lead.pre_sales_owner_id, lead.pre_sales_owner)}</div>
                  )}
                  {lead.sales_owner && (
                    <div><span className="text-muted-foreground">Sales:</span> {getOwnerName(lead.sales_owner_id, lead.sales_owner)}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                {lead.college && (
                  <Badge variant="outline" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    {lead.college}
                  </Badge>
                )}
                {lead.product_purchased && (
                  <Badge variant="secondary" className="text-xs">
                    {(lead as any).product_category ? `${(lead as any).product_category} - ${lead.product_purchased}` : lead.product_purchased}
                  </Badge>
                )}
                {lead.sales_owner?.full_name && (
                  <Badge variant="outline" className="text-xs">
                    Owner: {lead.sales_owner.full_name}
                  </Badge>
                )}
              </>
            )
          )}
        </div>

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

        {/* Swipe hint */}
        <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
          <span>← Status</span>
          <span>Swipe</span>
          <span>Call →</span>
        </div>
      </div>
    </div>
  );
}
