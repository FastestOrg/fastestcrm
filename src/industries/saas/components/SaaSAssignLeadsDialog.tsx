import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { notificationService } from '@/services/notificationService';

interface SaaSAssignLeadsDialogProps {
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

export function SaaSAssignLeadsDialog({ open, onOpenChange, selectedLeadIds, onSuccess }: SaaSAssignLeadsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { user } = useAuth();
  const { company } = useCompany();
  const { orgClient } = useOrgClient();
  const queryClient = useQueryClient();

  const [updatePreSales, setUpdatePreSales] = useState(false);
  const [updateSales, setUpdateSales] = useState(true);
  const [updatePostSales, setUpdatePostSales] = useState(false);
  const [preSalesUserId, setPreSalesUserId] = useState('');
  const [salesUserId, setSalesUserId] = useState('');
  const [postSalesUserId, setPostSalesUserId] = useState('');

  useEffect(() => {
    if (open && company?.id) {
      (async () => {
        const { data } = await supabase.from('profiles').select('id, full_name, email').eq('company_id', company.id);
        const pData = data || [];
        if (pData.length === 0) { setProfiles([]); return; }
        const { data: rolesData } = await supabase.from('user_roles').select('user_id').in('user_id', pData.map(p => p.id));
        const activeIds = new Set(rolesData?.map(r => r.user_id));
        setProfiles(pData.filter(p => activeIds.has(p.id)));
      })();
    }
  }, [open, company?.id]);

  const handleAssign = async () => {
    const hasAny = (updatePreSales && preSalesUserId) || (updateSales && salesUserId) || (updatePostSales && postSalesUserId);
    if (!hasAny) { toast.error('Select at least one owner'); return; }

    setLoading(true);
    try {
      const updateData: Record<string, string> = {};
      if (updatePreSales && preSalesUserId) updateData.pre_sales_owner_id = preSalesUserId;
      if (updateSales && salesUserId) updateData.sales_owner_id = salesUserId;
      if (updatePostSales && postSalesUserId) updateData.post_sales_owner_id = postSalesUserId;

      const { error } = await orgClient.from('leads_saas' as any).update(updateData).in('id', selectedLeadIds);
      if (error) throw error;

      const notifs = [];
      if (updatePreSales && preSalesUserId && preSalesUserId !== user?.id) notifs.push({ userId: preSalesUserId, role: 'Pre-Sales' });
      if (updateSales && salesUserId && salesUserId !== user?.id) notifs.push({ userId: salesUserId, role: 'Sales' });
      if (updatePostSales && postSalesUserId && postSalesUserId !== user?.id) notifs.push({ userId: postSalesUserId, role: 'Post-Sales' });

      await Promise.all(notifs.map(({ userId, role }) =>
        notificationService.createNotification({
          userId, title: 'New SaaS Leads Assigned',
          message: `You have been assigned ${selectedLeadIds.length} lead${selectedLeadIds.length !== 1 ? 's' : ''} as ${role} Owner.`,
          type: 'lead_assignment'
        })
      ));

      toast.success(`Assigned ${selectedLeadIds.length} leads`);
      queryClient.invalidateQueries({ queryKey: ['saas-leads'] });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to assign leads');
    } finally {
      setLoading(false);
    }
  };

  const renderOwnerSelect = (label: string, checked: boolean, onCheck: (c: boolean) => void, value: string, onChange: (v: string) => void) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id={label} checked={checked} onCheckedChange={(c) => onCheck(c as boolean)} />
        <Label htmlFor={label} className="font-medium">{label}</Label>
      </div>
      {checked && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={`Select ${label}`} /></SelectTrigger>
          <SelectContent>
            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || 'Unknown'}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader><DialogTitle>Assign SaaS Leads</DialogTitle></DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Assign {selectedLeadIds.length} selected lead{selectedLeadIds.length !== 1 ? 's' : ''} to team members.
          </p>
          <div className="space-y-4">
            {renderOwnerSelect('Pre-Sales Owner', updatePreSales, setUpdatePreSales, preSalesUserId, setPreSalesUserId)}
            {renderOwnerSelect('Sales Owner', updateSales, setUpdateSales, salesUserId, setSalesUserId)}
            {renderOwnerSelect('Post-Sales Owner', updatePostSales, setUpdatePostSales, postSalesUserId, setPostSalesUserId)}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleAssign} disabled={loading}>{loading ? 'Assigning...' : 'Assign Leads'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
