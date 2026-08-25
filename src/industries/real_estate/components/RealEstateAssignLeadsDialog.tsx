import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { notificationService } from '@/services/notificationService';
import { executeInChunks } from '@/lib/batchUtils';

interface RealEstateAssignLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  onSuccess: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

type OwnerType = 'pre_sales' | 'sales' | 'post_sales';

export function RealEstateAssignLeadsDialog({
  open,
  onOpenChange,
  selectedLeadIds,
  onSuccess
}: RealEstateAssignLeadsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { user } = useAuth();
  const { company } = useCompany();
  const { orgClient } = useOrgClient();
  const queryClient = useQueryClient();

  // State for which owner types to update
  const [updatePreSales, setUpdatePreSales] = useState(false);
  const [updateSales, setUpdateSales] = useState(true);
  const [updatePostSales, setUpdatePostSales] = useState(false);

  // State for selected users
  const [preSalesUserId, setPreSalesUserId] = useState<string>('');
  const [salesUserId, setSalesUserId] = useState<string>('');
  const [postSalesUserId, setPostSalesUserId] = useState<string>('');

  useEffect(() => {
    if (open && company?.id) {
      fetchProfiles();
    }
  }, [open, company?.id]);

  const fetchProfiles = async () => {
    try {
      if (!company?.id) return;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', company.id);

      if (profilesError) throw profilesError;

      const pData = profilesData || [];
      if (pData.length === 0) {
        setProfiles([]);
        return;
      }

      // Filter active users with roles
      const profileIds = pData.map(p => p.id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('user_id', profileIds);

      const activeUserIds = new Set(rolesData?.map(r => r.user_id));
      const activeProfiles = pData.filter(p => activeUserIds.has(p.id));
      setProfiles(activeProfiles);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error('Failed to load team members');
    }
  };

  const handleAssign = async () => {
    const hasAnySelection =
      (updatePreSales && preSalesUserId) ||
      (updateSales && salesUserId) ||
      (updatePostSales && postSalesUserId);

    if (!hasAnySelection) {
      toast.error('Please select at least one owner to assign');
      return;
    }

    setLoading(true);
    try {
      const updateData: Record<string, string> = {};

      if (updatePreSales && preSalesUserId) {
        updateData.pre_sales_owner_id = preSalesUserId;
      }
      if (updateSales && salesUserId) {
        updateData.sales_owner_id = salesUserId;
      }
      if (updatePostSales && postSalesUserId) {
        updateData.post_sales_owner_id = postSalesUserId;
      }

      const { error } = await executeInChunks(selectedLeadIds, (chunk) =>
        orgClient
          .from('leads_real_estate')
          .update(updateData)
          .in('id', chunk)
      );

      if (error) throw error;

      // Send notifications
      const notificationsToSend = [];
      if (updatePreSales && preSalesUserId && preSalesUserId !== user?.id) {
        notificationsToSend.push({ userId: preSalesUserId, role: 'Pre-Sales' });
      }
      if (updateSales && salesUserId && salesUserId !== user?.id) {
        notificationsToSend.push({ userId: salesUserId, role: 'Sales' });
      }
      if (updatePostSales && postSalesUserId && postSalesUserId !== user?.id) {
        notificationsToSend.push({ userId: postSalesUserId, role: 'Post-Sales' });
      }

      // Send notifications in parallel
      await Promise.all(notificationsToSend.map(({ userId, role }) =>
        notificationService.createNotification({
          userId,
          title: 'New Real Estate Leads Assigned',
          message: `You have been assigned ${selectedLeadIds.length} new lead${selectedLeadIds.length !== 1 ? 's' : ''} as ${role} Owner.`,
          type: 'lead_assignment'
        })
      ));

      const ownerTypes: string[] = [];
      if (updatePreSales && preSalesUserId) ownerTypes.push('Pre-Sales');
      if (updateSales && salesUserId) ownerTypes.push('Sales');
      if (updatePostSales && postSalesUserId) ownerTypes.push('Post-Sales');

      toast.success(`Assigned ${selectedLeadIds.length} leads to ${ownerTypes.join(', ')} owners`);
      queryClient.invalidateQueries({ queryKey: ['real-estate-leads'] });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning leads:', error);
      toast.error('Failed to assign leads');
    } finally {
      setLoading(false);
    }
  };

  const renderOwnerSelect = (
    label: string,
    checked: boolean,
    onCheckedChange: (checked: boolean) => void,
    value: string,
    onValueChange: (value: string) => void
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={label}
          checked={checked}
          onCheckedChange={(c) => onCheckedChange(c as boolean)}
        />
        <Label htmlFor={label} className="font-medium">{label}</Label>
      </div>
      {checked && (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.full_name || profile.email || 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Assign Leads</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Assign {selectedLeadIds.length} selected lead{selectedLeadIds.length !== 1 ? 's' : ''} to team members.
            Select which owner types to update:
          </p>

          <div className="space-y-4">
            {renderOwnerSelect(
              'Pre-Sales Owner',
              updatePreSales,
              setUpdatePreSales,
              preSalesUserId,
              setPreSalesUserId
            )}

            {renderOwnerSelect(
              'Sales Owner',
              updateSales,
              setUpdateSales,
              salesUserId,
              setSalesUserId
            )}

            {renderOwnerSelect(
              'Post-Sales Owner',
              updatePostSales,
              setUpdatePostSales,
              postSalesUserId,
              setPostSalesUserId
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading}>
            {loading ? 'Assigning...' : 'Assign Leads'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
