import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Handshake, DollarSign, Search, ArrowLeft, RefreshCw,
  MoreVertical, CheckCircle2, XCircle, AlertCircle, Edit, Plus,
  Shield, Tag, Globe, Laptop, ArrowUpRight, Check, Eye,
  Building2, Download, FileSpreadsheet, History, CreditCard, Clock
} from 'lucide-react';

interface PartnerRecord {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  company_name: string | null;
  website: string | null;
  phone: string | null;
  category: 'affiliate' | 'agency' | 'white_label';
  status: 'active' | 'pending' | 'suspended';
  referral_code: string;
  commission_rate: number;
  fixed_monthly_cost: number;
  custom_terms: any;
  payout_info: any;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  created_at: string;
  referrals_count?: number;
  paid_referrals_count?: number;
}

interface ReferralRecord {
  id: string;
  company_name: string;
  admin_name: string | null;
  admin_email: string | null;
  is_paid: boolean;
  first_topup_amount: number;
  first_topup_discount: number;
  total_revenue_generated?: number;
  commission_earned: number;
  commission_status: string;
  registered_at: string;
  paid_at: string | null;
  notes?: string;
}

interface PlatformPayoutRecord {
  id: string;
  partner_id: string;
  amount: number;
  reference_number: string;
  payment_method: string;
  status: 'pending' | 'completed' | 'rejected';
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  partner?: {
    full_name: string;
    email: string;
    referral_code: string;
    payout_info?: any;
  };
}

export default function PlatformPartners() {
  const { user } = useAuth();
  const { data: isPlatformAdmin, isLoading: checkingAdmin } = usePlatformAdmin();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Payouts & Tabs State
  const [activeTab, setActiveTab] = useState<'partners' | 'payouts'>('partners');
  const [payoutsList, setPayoutsList] = useState<PlatformPayoutRecord[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [pendingPayoutId, setPendingPayoutId] = useState<string | null>(null);
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutSearchQuery, setPayoutSearchQuery] = useState('');
  const [exportingReferrals, setExportingReferrals] = useState(false);

  // Change Category Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerRecord | null>(null);
  const [newCategory, setNewCategory] = useState<'affiliate' | 'agency' | 'white_label'>('affiliate');
  const [newCommissionRate, setNewCommissionRate] = useState('40');
  const [savingCategory, setSavingCategory] = useState(false);

  // View Referrals Modal
  const [referralsModalOpen, setReferralsModalOpen] = useState(false);
  const [partnerReferrals, setPartnerReferrals] = useState<ReferralRecord[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);

  // Settle Payout Modal
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer');
  const [settlingPayout, setSettlingPayout] = useState(false);

  // Add Partner Manually Modal
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addCompany, setAddCompany] = useState('');
  const [addCategory, setAddCategory] = useState<'affiliate' | 'agency' | 'white_label'>('affiliate');
  const [addCustomCode, setAddCustomCode] = useState('');
  const [addingPartner, setAddingPartner] = useState(false);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchPartners();
      fetchPayouts();
    }
  }, [isPlatformAdmin]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const { data: partnersData, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch referral counts
      const { data: refsData } = await supabase
        .from('partner_referrals')
        .select('partner_id, is_paid');

      const partnerList: PartnerRecord[] = (partnersData || []).map((p: any) => {
        const partnerRefs = (refsData || []).filter((r: any) => r.partner_id === p.id);
        return {
          ...p,
          referrals_count: partnerRefs.length,
          paid_referrals_count: partnerRefs.filter((r: any) => r.is_paid).length,
        };
      });

      setPartners(partnerList);
    } catch (err: any) {
      toast({
        title: 'Error Loading Partners',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPayouts = async () => {
    try {
      setLoadingPayouts(true);
      const { data, error } = await supabase
        .from('partner_payouts')
        .select('*, partner:partners(full_name, email, referral_code, payout_info)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayoutsList((data as any) || []);
    } catch (err: any) {
      console.error('Failed to load payouts:', err);
    } finally {
      setLoadingPayouts(false);
    }
  };

  // Update Category Handler
  const handleUpdateCategory = async () => {
    if (!selectedPartner) return;
    setSavingCategory(true);
    try {
      const commRate = newCategory === 'agency' ? 40 : newCategory === 'white_label' ? 100 : 33;
      const fixedCost = newCategory === 'white_label' ? 50000 : 0;

      const updatedTerms = {
        ...(selectedPartner.custom_terms || {}),
        upgrade_approved_at: new Date().toISOString(),
        previous_category: selectedPartner.category
      };
      delete updatedTerms.upgrade_requested;

      const { error } = await supabase
        .from('partners')
        .update({
          category: newCategory,
          commission_rate: parseFloat(newCommissionRate) || commRate,
          fixed_monthly_cost: fixedCost,
          custom_terms: updatedTerms,
        })
        .eq('id', selectedPartner.id);

      if (error) throw error;

      toast({
        title: 'Category Updated',
        description: `${selectedPartner.full_name} is now an ${newCategory.toUpperCase()} partner.`,
      });

      setCategoryModalOpen(false);
      fetchPartners();
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingCategory(false);
    }
  };

  // Toggle Partner Status
  const handleToggleStatus = async (partner: PartnerRecord, newStatus: 'active' | 'suspended') => {
    try {
      const { error } = await supabase
        .from('partners')
        .update({ status: newStatus })
        .eq('id', partner.id);

      if (error) throw error;

      toast({
        title: `Partner ${newStatus === 'active' ? 'Activated' : 'Suspended'}`,
        description: `${partner.full_name} status set to ${newStatus}.`,
      });

      fetchPartners();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Open Referrals Viewer
  const handleOpenReferrals = async (partner: PartnerRecord) => {
    setSelectedPartner(partner);
    setReferralsModalOpen(true);
    setLoadingReferrals(true);
    try {
      const { data, error } = await supabase
        .from('partner_referrals')
        .select('*')
        .eq('partner_id', partner.id)
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setPartnerReferrals(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingReferrals(false);
    }
  };

  // Settle Payout Handler
  const handleSettlePayout = async () => {
    if (!selectedPartner || !payoutAmount) return;
    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Invalid Amount', description: 'Enter a valid positive number', variant: 'destructive' });
      return;
    }

    setSettlingPayout(true);
    try {
      if (pendingPayoutId) {
        // Atomic RPC Settlement for pending requests
        const { error: rpcError } = await supabase.rpc('admin_settle_partner_payout', {
          p_payout_id: pendingPayoutId,
          p_reference_number: payoutRef.trim() || `PAY-${Date.now()}`,
          p_payment_method: payoutMethod,
          p_admin_notes: payoutNotes.trim() || null
        });

        if (rpcError) throw rpcError;
      } else {
        // Ad-hoc payout recording
        const { error: payoutError } = await supabase
          .from('partner_payouts')
          .insert({
            partner_id: selectedPartner.id,
            amount: amountNum,
            reference_number: payoutRef.trim() || `PAY-${Date.now()}`,
            payment_method: payoutMethod,
            status: 'completed',
            notes: payoutNotes.trim() || null,
            paid_at: new Date().toISOString()
          });

        if (payoutError) throw payoutError;

        const newPaid = (selectedPartner.paid_earnings || 0) + amountNum;
        const newPending = Math.max(0, (selectedPartner.pending_earnings || 0) - amountNum);

        const { error: updateError } = await supabase
          .from('partners')
          .update({
            paid_earnings: newPaid,
            pending_earnings: newPending,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedPartner.id);

        if (updateError) throw updateError;
      }

      toast({
        title: 'Payout Settled & Recorded',
        description: `Successfully logged ₹${amountNum.toLocaleString('en-IN')} payout for ${selectedPartner.full_name}.`,
      });

      setPayoutModalOpen(false);
      setPendingPayoutId(null);
      setPayoutNotes('');
      setPayoutRef('');
      fetchPartners();
      fetchPayouts();
    } catch (err: any) {
      toast({ title: 'Payout Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSettlingPayout(false);
    }
  };

  // Reject Payout Request
  const handleRejectPayout = async (payoutId: string) => {
    try {
      const { error } = await supabase
        .from('partner_payouts')
        .update({
          status: 'rejected',
          notes: 'Rejected by platform admin. Please verify bank/UPI details.'
        })
        .eq('id', payoutId);

      if (error) throw error;
      toast({ title: 'Payout Request Rejected', description: 'Request status marked as rejected.' });
      fetchPayouts();
      fetchPartners();
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err.message, variant: 'destructive' });
    }
  };

  // CSV Exporter: Partners
  const exportPartnersCSV = () => {
    if (partners.length === 0) {
      toast({ title: 'No partners to export' });
      return;
    }
    const headers = ['Partner ID', 'Full Name', 'Email', 'Phone', 'Company', 'Website', 'Category', 'Status', 'Referral Code', 'Commission Rate (%)', 'Total Referrals', 'Paid Referrals', 'Total Earnings (INR)', 'Pending Earnings (INR)', 'Paid Earnings (INR)', 'Created At'];
    const rows = partners.map(p => [
      p.id,
      `"${(p.full_name || '').replace(/"/g, '""')}"`,
      p.email,
      p.phone || '',
      `"${(p.company_name || '').replace(/"/g, '""')}"`,
      p.website || '',
      p.category,
      p.status,
      p.referral_code,
      p.commission_rate,
      p.referrals_count || 0,
      p.paid_referrals_count || 0,
      p.total_earnings || 0,
      p.pending_earnings || 0,
      p.paid_earnings || 0,
      p.created_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fastest_crm_partners_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Partners CSV Exported', description: `${partners.length} partners exported.` });
  };

  // CSV Exporter: All Referrals
  const exportReferralsCSV = async () => {
    try {
      setExportingReferrals(true);
      const { data: allRefs, error } = await supabase
        .from('partner_referrals')
        .select('*, partner:partners(full_name, referral_code, category)')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      if (!allRefs || allRefs.length === 0) {
        toast({ title: 'No referrals found to export' });
        return;
      }

      const headers = ['Referral ID', 'Partner Name', 'Referral Code', 'Track', 'Company Name', 'Admin Name', 'Admin Email', 'Plan Type', 'Paid Status', '1st Topup (INR)', 'Discount (INR)', 'Lifetime Revenue (INR)', 'Commission Earned (INR)', 'Commission Status', 'Registered At', 'Paid At'];
      const rows = allRefs.map((r: any) => [
        r.id,
        `"${(r.partner?.full_name || '').replace(/"/g, '""')}"`,
        r.partner?.referral_code || '',
        r.partner?.category || '',
        `"${(r.company_name || '').replace(/"/g, '""')}"`,
        `"${(r.admin_name || '').replace(/"/g, '""')}"`,
        r.admin_email || '',
        r.plan_type || '',
        r.is_paid ? 'Paid' : 'Pending',
        r.first_topup_amount || 0,
        r.first_topup_discount || 0,
        r.total_revenue_generated || 0,
        r.commission_earned || 0,
        r.commission_status || '',
        r.registered_at,
        r.paid_at || ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `fastest_crm_referrals_audit_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Referrals CSV Exported', description: `${allRefs.length} referral records exported.` });
    } catch (err: any) {
      toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
    } finally {
      setExportingReferrals(false);
    }
  };

  // Add Partner Manually
  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingPartner(true);
    try {
      const codeBase = (addCustomCode || addCompany || addName || 'PARTNER').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const referralCode = addCustomCode ? addCustomCode.toUpperCase() : `FAST-${codeBase.slice(0, 6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const commRate = addCategory === 'agency' ? 40 : addCategory === 'white_label' ? 100 : 33;
      const fixedCost = addCategory === 'white_label' ? 50000 : 0;

      const { error } = await supabase
        .from('partners')
        .insert({
          full_name: addName.trim(),
          email: addEmail.trim(),
          company_name: addCompany.trim() || null,
          category: addCategory,
          status: 'active',
          referral_code: referralCode,
          commission_rate: commRate,
          fixed_monthly_cost: fixedCost
        });

      if (error) throw error;

      toast({
        title: 'Partner Created',
        description: `Partner created with referral code: ${referralCode}`,
      });

      setAddPartnerOpen(false);
      setAddName('');
      setAddEmail('');
      setAddCompany('');
      setAddCustomCode('');
      fetchPartners();
    } catch (err: any) {
      toast({ title: 'Failed to Add Partner', description: err.message, variant: 'destructive' });
    } finally {
      setAddingPartner(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
        <XCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Restricted</h1>
        <p className="text-muted-foreground">Only platform administrators can manage partners.</p>
        <Button onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Summary Metrics
  const totalPartners = partners.length;
  const affiliateCount = partners.filter(p => p.category === 'affiliate').length;
  const agencyCount = partners.filter(p => p.category === 'agency').length;
  const whiteLabelCount = partners.filter(p => p.category === 'white_label').length;
  const totalReferrals = partners.reduce((sum, p) => sum + (p.referrals_count || 0), 0);
  const totalPaidReferrals = partners.reduce((sum, p) => sum + (p.paid_referrals_count || 0), 0);
  const totalAccruedCommissions = partners.reduce((sum, p) => sum + (p.total_earnings || 0), 0);
  const totalPendingCommissions = partners.reduce((sum, p) => sum + (p.pending_earnings || 0), 0);

  // Filter partners
  const filteredPartners = partners.filter(p => {
    const matchesSearch =
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.referral_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.company_name && p.company_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="icon" onClick={() => navigate('/platform')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold">Partner Program Administration</h1>
              <Badge className="bg-primary/20 text-primary">Super Admin</Badge>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Manage all SaaS partners, track client referrals, change categories, and settle commissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchPartners} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" className="gradient-primary font-semibold" onClick={() => setAddPartnerOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Partner Manually
            </Button>
          </div>
        </div>

        {/* Global Partner Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="rounded-2xl bg-card border border-border/60">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Total Partners</p>
              <div className="text-2xl font-extrabold text-foreground mt-1 font-mono">{totalPartners}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{agencyCount} Agencies · {affiliateCount} Affiliates</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-card border border-border/60">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">White-Label Partners</p>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">{whiteLabelCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">₹50K/mo base licensing</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-card border border-border/60">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Total Referrals</p>
              <div className="text-2xl font-extrabold text-primary mt-1 font-mono">{totalReferrals}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Company signups attributed</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-card border border-border/60">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Paid Conversions</p>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">{totalPaidReferrals}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Active paying client accounts</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-card border border-border/60">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Total Commissions</p>
              <div className="text-2xl font-extrabold text-foreground mt-1 font-mono">₹{totalAccruedCommissions.toLocaleString('en-IN')}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Accrued partner payouts</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-card border border-border/60">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Unsettled Payouts</p>
              <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">₹{totalPendingCommissions.toLocaleString('en-IN')}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Due for settlement</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Partner Directory vs Payout Settlements */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-secondary/40 p-1 border border-border/50">
              <TabsTrigger value="partners" className="gap-2">
                <Users className="h-4 w-4" />
                Partner Directory ({partners.length})
              </TabsTrigger>
              <TabsTrigger value="payouts" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Payout Settlements ({payoutsList.length})
                {payoutsList.filter(p => p.status === 'pending').length > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] ml-1">
                    {payoutsList.filter(p => p.status === 'pending').length} Pending
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportPartnersCSV} className="text-xs gap-1.5 border-border/60">
                <Download className="h-3.5 w-3.5 text-primary" />
                Export Partners CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportReferralsCSV}
                disabled={exportingReferrals}
                className="text-xs gap-1.5 border-border/60"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                {exportingReferrals ? 'Exporting...' : 'Export Referrals CSV'}
              </Button>
            </div>
          </div>

          {/* ── TAB 1: PARTNER DIRECTORY ── */}
          <TabsContent value="partners" className="space-y-4">
            <Card className="rounded-2xl bg-card border border-border/60">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                <div>
                  <CardTitle className="text-lg">Partner Directory</CardTitle>
                  <CardDescription>View performance, change partnership category, and manage payout settlements</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search partner, code, email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-36 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="affiliate">Affiliate</SelectItem>
                      <SelectItem value="agency">Agency (40%)</SelectItem>
                      <SelectItem value="white_label">White-Label</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                {filteredPartners.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No partners found matching criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Partner Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Referral Code</TableHead>
                          <TableHead>Referrals</TableHead>
                          <TableHead>Paid Deals</TableHead>
                          <TableHead>Total Earnings</TableHead>
                          <TableHead>Pending Payout</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPartners.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div>
                                <p className="font-bold text-foreground text-sm">{p.full_name}</p>
                                <p className="text-xs text-muted-foreground">{p.email}</p>
                                {p.company_name && (
                                  <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                                    <Building2 className="h-3 w-3" />
                                    {p.company_name}
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge
                                className={`cursor-pointer ${
                                  p.category === 'agency'
                                    ? 'bg-primary/20 text-primary border-primary/30'
                                    : p.category === 'white_label'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                }`}
                                onClick={() => {
                                  setSelectedPartner(p);
                                  setNewCategory(p.category);
                                  setNewCommissionRate(String(p.commission_rate || 40));
                                  setCategoryModalOpen(true);
                                }}
                              >
                                {p.category === 'agency' ? 'Agency (40%)' : p.category === 'white_label' ? 'White-Label' : 'Affiliate'}
                              </Badge>
                              {p.custom_terms?.upgrade_requested && (
                                <div className="mt-1">
                                  <Badge variant="outline" className="text-[9px] text-primary border-primary/40 animate-pulse">
                                    Req: {p.custom_terms.upgrade_requested}
                                  </Badge>
                                </div>
                              )}
                            </TableCell>

                            <TableCell>
                              <code className="text-xs font-mono font-bold bg-muted px-2 py-1 rounded">
                                {p.referral_code}
                              </code>
                            </TableCell>

                            <TableCell className="font-mono font-semibold text-sm">
                              {p.referrals_count || 0}
                            </TableCell>

                            <TableCell className="font-mono font-bold text-emerald-400 text-sm">
                              {p.paid_referrals_count || 0}
                            </TableCell>

                            <TableCell className="font-mono font-bold text-sm">
                              ₹{(p.total_earnings || 0).toLocaleString('en-IN')}
                            </TableCell>

                            <TableCell className="font-mono font-bold text-amber-400 text-sm">
                              ₹{(p.pending_earnings || 0).toLocaleString('en-IN')}
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline" className={p.status === 'active' ? 'text-emerald-500 border-emerald-500/30 font-mono text-[10px]' : 'text-red-500 border-red-500/30 font-mono text-[10px]'}>
                                {p.status}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedPartner(p);
                                    setNewCategory(p.category);
                                    setNewCommissionRate(String(p.commission_rate || 40));
                                    setCategoryModalOpen(true);
                                  }}>
                                    <Edit className="h-3.5 w-3.5 mr-2" />
                                    Change Category / Rate
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => handleOpenReferrals(p)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" />
                                    View Referrals ({p.referrals_count || 0})
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => {
                                    setSelectedPartner(p);
                                    setPendingPayoutId(null);
                                    setPayoutAmount(String(p.pending_earnings || 0));
                                    setPayoutModalOpen(true);
                                  }}>
                                    <DollarSign className="h-3.5 w-3.5 mr-2" />
                                    Record Payout Settlement
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    className={p.status === 'active' ? 'text-destructive' : 'text-emerald-500'}
                                    onClick={() => handleToggleStatus(p, p.status === 'active' ? 'suspended' : 'active')}
                                  >
                                    {p.status === 'active' ? (
                                      <>
                                        <XCircle className="h-3.5 w-3.5 mr-2" />
                                        Suspend Partner
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                        Activate Partner
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 2: PAYOUT SETTLEMENTS & REQUESTS ── */}
          <TabsContent value="payouts" className="space-y-6">
            {/* Pending Requests Alert & Table */}
            {payoutsList.filter(p => p.status === 'pending').length > 0 && (
              <Card className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-400" />
                    <CardTitle className="text-base text-amber-400">
                      Pending Payout Requests ({payoutsList.filter(p => p.status === 'pending').length})
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Partners have requested commission withdrawal. Verify bank/UPI transfer and record settlement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Partner</TableHead>
                          <TableHead>Requested Amount</TableHead>
                          <TableHead>Bank / UPI Details</TableHead>
                          <TableHead>Request Date</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payoutsList.filter(p => p.status === 'pending').map((p) => {
                          const partnerInfo = partners.find(ptr => ptr.id === p.partner_id) || p.partner;
                          const pInfo = partnerInfo?.payout_info || {};
                          return (
                            <TableRow key={p.id}>
                              <TableCell>
                                <p className="font-bold text-foreground text-sm">{partnerInfo?.full_name || 'Partner'}</p>
                                <p className="text-xs text-muted-foreground">{partnerInfo?.email}</p>
                                <code className="text-[10px] font-mono text-primary font-bold">{partnerInfo?.referral_code}</code>
                              </TableCell>
                              <TableCell className="font-mono font-bold text-base text-amber-400">
                                ₹{p.amount.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell className="text-xs">
                                <p><strong>Bank:</strong> {pInfo.bank_name || 'N/A'}</p>
                                <p><strong>Acc:</strong> {pInfo.account_number || 'N/A'}</p>
                                <p><strong>IFSC:</strong> {pInfo.ifsc_code || 'N/A'} | <strong>UPI:</strong> {pInfo.upi_id || 'N/A'}</p>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {new Date(p.created_at).toLocaleDateString('en-IN')}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                {p.notes || '-'}
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button
                                  size="sm"
                                  className="gradient-primary text-xs font-semibold"
                                  onClick={() => {
                                    const ptr = partners.find(x => x.id === p.partner_id);
                                    if (ptr) setSelectedPartner(ptr);
                                    setPendingPayoutId(p.id);
                                    setPayoutAmount(String(p.amount));
                                    setPayoutRef('');
                                    setPayoutModalOpen(true);
                                  }}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Settle Now
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={() => handleRejectPayout(p.id)}
                                >
                                  Reject
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payout History Ledger */}
            <Card className="rounded-2xl bg-card border border-border/60">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    All Completed Payout Settlements
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comprehensive ledger of all transferred partner commissions
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search UTR, partner name..."
                    value={payoutSearchQuery}
                    onChange={(e) => setPayoutSearchQuery(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingPayouts ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Loading payout history...</div>
                ) : payoutsList.filter(p => p.status === 'completed').length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No completed payout settlements logged yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Partner</TableHead>
                          <TableHead>Settled Amount</TableHead>
                          <TableHead>UTR / Reference ID</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead>Settled Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payoutsList
                          .filter(p => p.status === 'completed')
                          .filter(p => {
                            const name = p.partner?.full_name || '';
                            const ref = p.reference_number || '';
                            return name.toLowerCase().includes(payoutSearchQuery.toLowerCase()) ||
                              ref.toLowerCase().includes(payoutSearchQuery.toLowerCase());
                          })
                          .map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <p className="font-bold text-foreground text-sm">{p.partner?.full_name || 'Partner'}</p>
                                <p className="text-xs text-muted-foreground">{p.partner?.email}</p>
                              </TableCell>
                              <TableCell className="font-mono font-bold text-emerald-400 text-sm">
                                ₹{p.amount.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <code className="bg-muted px-2 py-0.5 rounded">{p.reference_number || 'N/A'}</code>
                              </TableCell>
                              <TableCell className="text-xs capitalize">
                                {p.payment_method?.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                  {p.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                {p.notes || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialog: Change Category ── */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Partner Category</DialogTitle>
            <DialogDescription>
              Update partnership tier and custom commission rate for {selectedPartner?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Partner Category</Label>
              <Select value={newCategory} onValueChange={(v: any) => setNewCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="affiliate">Affiliate (1-Month Bounty)</SelectItem>
                  <SelectItem value="agency">Agency &amp; Tech (40% Lifetime Recurring)</SelectItem>
                  <SelectItem value="white_label">White-Label Partner (₹50K/mo, 100% Margin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Commission Rate (%)</Label>
              <Input
                type="number"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
                placeholder="40"
              />
              <p className="text-[11px] text-muted-foreground">
                Default: Agency = 40%, Affiliate = 33% (1-month on quarterly), White-Label = 100%
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
            <Button className="gradient-primary font-semibold" onClick={handleUpdateCategory} disabled={savingCategory}>
              {savingCategory ? 'Saving...' : 'Update Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: View Referrals ── */}
      <Dialog open={referralsModalOpen} onOpenChange={setReferralsModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Referrals for {selectedPartner?.full_name}</DialogTitle>
            <DialogDescription>
              Referral Code: <span className="font-mono font-bold text-primary">{selectedPartner?.referral_code}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="pt-2">
            {loadingReferrals ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading referrals...</div>
            ) : partnerReferrals.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No referrals recorded yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>1st Topup</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerReferrals.map((ref) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-bold">{ref.company_name}</TableCell>
                      <TableCell className="text-xs font-mono">{new Date(ref.registered_at).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>
                        {ref.is_paid ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Paid</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-400 text-[10px]">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {ref.first_topup_amount > 0 ? `₹${ref.first_topup_amount.toLocaleString('en-IN')}` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-400">
                        {ref.first_topup_discount > 0 ? `₹${ref.first_topup_discount.toLocaleString('en-IN')}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">
                        ₹{(ref.commission_earned || 0).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Settle Payout ── */}
      <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingPayoutId ? 'Settle Partner Payout Request' : 'Record Payout Settlement'}</DialogTitle>
            <DialogDescription>
              Mark commissions as settled for {selectedPartner?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-secondary/15 border border-border/50 text-xs space-y-1">
              <p><strong>Bank Details:</strong> {selectedPartner?.payout_info?.bank_name || 'N/A'} - {selectedPartner?.payout_info?.account_number || 'N/A'}</p>
              <p><strong>IFSC:</strong> {selectedPartner?.payout_info?.ifsc_code || 'N/A'} | <strong>UPI:</strong> {selectedPartner?.payout_info?.upi_id || 'N/A'}</p>
              <p><strong>Current Pending:</strong> ₹{(selectedPartner?.pending_earnings || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payAmount">Payout Amount (₹) *</Label>
              <Input
                id="payAmount"
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payRef">Bank Transfer / UPI Ref ID (UTR)</Label>
              <Input
                id="payRef"
                placeholder="e.g. UTR-928472918"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer (NEFT/IMPS)</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="razorpay">Razorpay Payouts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payNotes">Admin Notes / Remarks (Optional)</Label>
              <Input
                id="payNotes"
                placeholder="e.g. Processed via Corporate Net Banking"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPayoutModalOpen(false);
              setPendingPayoutId(null);
            }}>Cancel</Button>
            <Button className="gradient-primary font-semibold" onClick={handleSettlePayout} disabled={settlingPayout}>
              {settlingPayout ? 'Recording...' : 'Confirm Payout Settled'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Add Partner Manually ── */}
      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Partner</DialogTitle>
            <DialogDescription>
              Directly register a new partner profile into the platform ecosystem.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddPartner} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="pName">Partner Full Name *</Label>
              <Input
                id="pName"
                required
                placeholder="Rajesh Mehta"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pEmail">Email *</Label>
              <Input
                id="pEmail"
                type="email"
                required
                placeholder="rajesh@agency.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pComp">Company / Agency Name</Label>
              <Input
                id="pComp"
                placeholder="Growth Consultants"
                value={addCompany}
                onChange={(e) => setAddCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={addCategory} onValueChange={(v: any) => setAddCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="affiliate">Affiliate Partner</SelectItem>
                  <SelectItem value="agency">Agency &amp; Tech (40% Lifetime)</SelectItem>
                  <SelectItem value="white_label">White-Label Partner (₹50k/mo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pCode">Custom Referral Code (Optional)</Label>
              <Input
                id="pCode"
                placeholder="e.g. FAST-GROWTH"
                value={addCustomCode}
                onChange={(e) => setAddCustomCode(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Will be auto-generated if left blank.</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddPartnerOpen(false)}>Cancel</Button>
              <Button type="submit" className="gradient-primary font-semibold" disabled={addingPartner}>
                {addingPartner ? 'Creating...' : 'Create Partner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
