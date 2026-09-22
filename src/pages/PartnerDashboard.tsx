import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Handshake, DollarSign, Copy, Check, ExternalLink,
  Gift, Sparkles, TrendingUp, Download, Shield, Clock, CheckCircle2,
  AlertCircle, Building2, Tag, ArrowUpRight, RefreshCw, Send, Loader2,
  QrCode, Lock, Share2, Layers, Globe, Palette, FileSpreadsheet
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Partner {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  website: string | null;
  category: 'affiliate' | 'agency' | 'white_label';
  status: 'active' | 'pending' | 'suspended';
  referral_code: string;
  commission_rate: number;
  fixed_monthly_cost: number;
  total_clicks: number;
  payout_info: {
    upi_id?: string;
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    pan_number?: string;
    gst_number?: string;
  };
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  custom_terms: any;
  created_at: string;
}

interface Referral {
  id: string;
  partner_id: string;
  company_name: string;
  admin_name: string | null;
  admin_email: string | null;
  plan_type: string;
  is_paid: boolean;
  first_topup_amount: number;
  first_topup_discount: number;
  commission_earned: number;
  commission_status: 'pending' | 'approved' | 'paid';
  registered_at: string;
  paid_at: string | null;
  notes?: string;
}

interface PayoutRecord {
  id: string;
  amount: number;
  reference_number: string;
  payment_method: string;
  status: string;
  notes: string | null;
  paid_at: string;
}

export default function PartnerDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Payout Settings Form
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  // Upgrade Modal
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [requestedTier, setRequestedTier] = useState<'agency' | 'white_label'>('agency');
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);

  // Deal Registration Modal
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [dealCompany, setDealCompany] = useState('');
  const [dealAdmin, setDealAdmin] = useState('');
  const [dealEmail, setDealEmail] = useState('');
  const [dealSeats, setDealSeats] = useState('10');
  const [dealNotes, setDealNotes] = useState('');
  const [registeringDeal, setRegisteringDeal] = useState(false);

  // QR Code Modal
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Custom UTM Campaign Generator
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmSource, setUtmSource] = useState('linkedin');

  // White-Label Settings (for White-Label partners)
  const [wlDomain, setWlDomain] = useState('');
  const [wlBrandName, setWlBrandName] = useState('');
  const [savingWl, setSavingWl] = useState(false);

  // Request Payout Modal State
  const [requestPayoutOpen, setRequestPayoutOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [submittingPayoutRequest, setSubmittingPayoutRequest] = useState(false);

  // Activation State for users without partner profile
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (user) {
      loadPartnerData();
    }
  }, [user]);

  // Social Sharing
  const shareWhatsApp = () => {
    if (!partner) return;
    const link = `${window.location.origin}/register-company?ref=${partner.referral_code}`;
    const text = encodeURIComponent(
      `Hey! I recommend Fastest CRM for high-velocity outbound sales. Use my partner code '${partner.referral_code}' to get an exclusive 10% discount on your first wallet recharge! Check it out: ${link}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareLinkedIn = () => {
    if (!partner) return;
    const link = `${window.location.origin}/register-company?ref=${partner.referral_code}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, '_blank');
  };

  const shareTwitter = () => {
    if (!partner) return;
    const link = `${window.location.origin}/register-company?ref=${partner.referral_code}`;
    const text = encodeURIComponent(
      `Scale your sales pipeline with @FastestCRM. Get 10% off your first topup with partner code ${partner.referral_code}: ${link}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  // Request Payout Handler
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;

    const hasDetails = upiId.trim() || accountNumber.trim();
    if (!hasDetails) {
      toast({
        title: 'Bank Details Required',
        description: 'Please save your UPI ID or Bank Account in Settlements & Payouts tab first.',
        variant: 'destructive',
      });
      return;
    }

    const available = Number(partner.pending_earnings || 0);
    const amountNum = parseFloat(requestAmount || String(available));
    if (isNaN(amountNum) || amountNum < 1000) {
      toast({
        title: 'Minimum Payout Threshold',
        description: 'Minimum payout request amount is ₹1,000.',
        variant: 'destructive',
      });
      return;
    }

    if (amountNum > available) {
      toast({
        title: 'Amount Exceeds Available',
        description: `You only have ₹${available.toLocaleString('en-IN')} pending settlement.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmittingPayoutRequest(true);
    try {
      const { data, error } = await supabase.rpc('request_partner_payout', {
        p_amount: amountNum,
        p_notes: requestNotes.trim() || null
      });

      if (error) throw error;

      toast({
        title: 'Payout Request Submitted! 🎉',
        description: `Request for ₹${amountNum.toLocaleString('en-IN')} submitted. Our finance team will transfer funds to your registered account.`,
      });

      setRequestPayoutOpen(false);
      setRequestAmount('');
      setRequestNotes('');
      loadPartnerData();
    } catch (err: any) {
      toast({
        title: 'Request Failed',
        description: err.message || 'Could not submit payout request',
        variant: 'destructive',
      });
    } finally {
      setSubmittingPayoutRequest(false);
    }
  };

  const loadPartnerData = async () => {
    try {
      setLoading(true);
      let { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      // If not found by user_id, check if a partner registered with the user's email
      if (!partnerData && user?.email) {
        const { data: fallbackPartner } = await supabase
          .from('partners')
          .select('*')
          .ilike('email', user.email.trim())
          .maybeSingle();

        if (fallbackPartner) {
          await supabase
            .from('partners')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', fallbackPartner.id);

          partnerData = { ...fallbackPartner, user_id: user.id };
        }
      }

      if (partnerData) {
        setPartner(partnerData as any);
        if (partnerData.payout_info) {
          const p = partnerData.payout_info as any;
          setUpiId(p.upi_id || '');
          setBankName(p.bank_name || '');
          setAccountNumber(p.account_number || '');
          setIfscCode(p.ifsc_code || '');
          setPanNumber(p.pan_number || '');
        }

        if (partnerData.custom_terms) {
          setWlDomain(partnerData.custom_terms.white_label_domain || '');
          setWlBrandName(partnerData.custom_terms.white_label_brand_name || '');
        }

        // Fetch referrals
        const { data: refData, error: refError } = await supabase
          .from('partner_referrals')
          .select('*')
          .eq('partner_id', partnerData.id)
          .order('registered_at', { ascending: false });

        if (!refError && refData) {
          setReferrals(refData as any);
        }

        // Fetch payouts history
        const { data: payoutData, error: payoutError } = await supabase
          .from('partner_payouts')
          .select('*')
          .eq('partner_id', partnerData.id)
          .order('paid_at', { ascending: false });

        if (!payoutError && payoutData) {
          setPayouts(payoutData as any);
        }
      } else {
        setPartner(null);
      }
    } catch (err: any) {
      console.error('Error loading partner data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Activate Partner Account for authenticated user
  const handleActivatePartner = async () => {
    if (!user) return;
    setActivating(true);
    try {
      const codeBase = (profile?.full_name || 'PARTNER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newRefCode = `FAST-${codeBase || 'CRM'}-${randomSuffix}`;

      const { data: newPartner, error: insertError } = await supabase
        .from('partners')
        .insert({
          user_id: user.id,
          full_name: profile?.full_name || user.email?.split('@')[0] || 'Fastest Partner',
          email: user.email || '',
          category: 'affiliate',
          status: 'active',
          referral_code: newRefCode,
          commission_rate: 33, // 1 month of quarterly
          fixed_monthly_cost: 0
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'Partner Portal Activated! 🎉',
        description: `Your unique referral code is ${newRefCode}`,
      });

      loadPartnerData();
    } catch (err: any) {
      toast({
        title: 'Activation Failed',
        description: err.message || 'Could not activate partner account',
        variant: 'destructive',
      });
    } finally {
      setActivating(false);
    }
  };

  // Copy helpers
  const handleCopyCode = () => {
    if (!partner?.referral_code) return;
    navigator.clipboard.writeText(partner.referral_code);
    setCopiedCode(true);
    toast({ title: 'Referral Code Copied', description: partner.referral_code });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = (customUrl?: string) => {
    const linkToCopy = customUrl || `${window.location.origin}/register-company?ref=${partner?.referral_code}`;
    navigator.clipboard.writeText(linkToCopy);
    setCopiedLink(true);
    toast({ title: 'Tracking Link Copied', description: linkToCopy });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Save Payout Settings
  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setSavingPayout(true);
    try {
      const updatedInfo = {
        upi_id: upiId.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: ifscCode.trim(),
        pan_number: panNumber.trim(),
      };

      const { error } = await supabase
        .from('partners')
        .update({ payout_info: updatedInfo })
        .eq('id', partner.id);

      if (error) throw error;
      toast({ title: 'Payout Settings Saved', description: 'Your bank and settlement details have been updated.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save payout info', variant: 'destructive' });
    } finally {
      setSavingPayout(false);
    }
  };

  // Register Deal (Lead Protection for Agencies)
  const handleRegisterDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setRegisteringDeal(true);
    try {
      const { error } = await supabase
        .from('partner_referrals')
        .insert({
          partner_id: partner.id,
          company_name: dealCompany.trim(),
          admin_name: dealAdmin.trim() || null,
          admin_email: dealEmail.trim(),
          plan_type: `${dealSeats}-seat Deal Registration`,
          is_paid: false,
          notes: `Protected Deal Registration. Notes: ${dealNotes.trim()}`
        });

      if (error) throw error;

      toast({
        title: 'Deal Registered & Protected (90 Days)',
        description: `${dealCompany} is now locked under your partner account with non-compete guarantee.`,
      });

      setDealModalOpen(false);
      setDealCompany('');
      setDealAdmin('');
      setDealEmail('');
      setDealNotes('');
      loadPartnerData();
    } catch (err: any) {
      toast({ title: 'Deal Registration Failed', description: err.message, variant: 'destructive' });
    } finally {
      setRegisteringDeal(false);
    }
  };

  // Save White-Label Settings
  const handleSaveWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setSavingWl(true);
    try {
      const terms = {
        ...(partner.custom_terms || {}),
        white_label_domain: wlDomain.trim(),
        white_label_brand_name: wlBrandName.trim(),
        white_label_updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('partners')
        .update({ custom_terms: terms })
        .eq('id', partner.id);

      if (error) throw error;
      toast({ title: 'White-Label Branding Saved', description: 'Our engineering team will provision your domain routing.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingWl(false);
    }
  };

  // Request Tier Upgrade
  const handleRequestUpgrade = async () => {
    if (!partner) return;
    setRequestingUpgrade(true);
    try {
      const { error } = await supabase
        .from('partners')
        .update({
          custom_terms: {
            ...(partner.custom_terms || {}),
            upgrade_requested: requestedTier,
            upgrade_notes: upgradeNotes,
            upgrade_requested_at: new Date().toISOString()
          }
        })
        .eq('id', partner.id);

      if (error) throw error;

      toast({
        title: 'Upgrade Request Submitted!',
        description: `Our partner management team will review your request to upgrade to ${requestedTier.toUpperCase()}.`,
      });
      setUpgradeOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to submit upgrade request', variant: 'destructive' });
    } finally {
      setRequestingUpgrade(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your partner portal...</p>
      </div>
    );
  }

  // Not a partner yet screen
  if (!partner) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
          <Handshake className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
          Activate Your Fastest CRM Partner Account
        </h1>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          Join the partner program in 1 click. You will receive your unique referral code, track who signs up, and earn commissions on client subscriptions.
        </p>
        <div className="p-6 rounded-2xl bg-card border border-border/60 text-left space-y-3 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>Earn 1 month license fees or up to 40% lifetime recurring</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>Offer your clients an automatic 10% discount on first topup</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>Instant transparent payout tracking &amp; reporting</span>
          </div>
        </div>
        <Button
          size="lg"
          className="font-bold gradient-primary px-8 py-6 shadow-xl shadow-primary/20"
          onClick={handleActivatePartner}
          disabled={activating}
        >
          {activating ? 'Generating Partner Code...' : 'Activate Free Partner Account'}
        </Button>
      </div>
    );
  }

  // Partner Metrics & Funnel
  const totalClicks = Number(partner.total_clicks || 0);
  const totalReferrals = referrals.length;
  const paidReferrals = referrals.filter(r => r.is_paid).length;
  const clickToSignupRate = totalClicks > 0 ? Math.round((totalReferrals / totalClicks) * 100) : 0;
  const signupToPaidRate = totalReferrals > 0 ? Math.round((paidReferrals / totalReferrals) * 100) : 0;
  const totalCommission = referrals.reduce((sum, r) => sum + (r.commission_earned || 0), 0);
  const totalRevenueDriven = referrals.reduce((sum, r) => sum + (r.first_topup_amount || 0), 0);

  const origin = window.location.origin;
  const referralLink = `${origin}/register-company?ref=${partner.referral_code}`;
  const customCampaignLink = utmCampaign
    ? `${referralLink}&utm_source=${utmSource}&utm_campaign=${encodeURIComponent(utmCampaign)}`
    : referralLink;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(referralLink)}`;

  const filteredReferrals = referrals.filter(r =>
    r.company_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (r.admin_name && r.admin_name.toLowerCase().includes(searchFilter.toLowerCase())) ||
    (r.admin_email && r.admin_email.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-16">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Partner Portal
            </h1>
            <Badge className={
              partner.category === 'agency'
                ? 'bg-primary/20 text-primary border-primary/30'
                : partner.category === 'white_label'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }>
              {partner.category === 'agency' ? 'Agency (40% Lifetime)' : partner.category === 'white_label' ? 'White-Label Distributor' : 'Affiliate Partner'}
            </Badge>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 font-mono text-[10px] uppercase">
              {partner.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {partner.full_name}. Real-time analytics, link attribution, and commission settlements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setDealModalOpen(true)} className="gap-1.5 font-semibold border-primary/30">
            <Lock className="h-4 w-4 text-primary" />
            Protect a Deal
          </Button>
          <Button variant="outline" size="sm" onClick={loadPartnerData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gradient-primary font-semibold"
            onClick={() => setUpgradeOpen(true)}
          >
            Upgrade Track
          </Button>
        </div>
      </div>

      {/* ── Unique Referral Links & Code Box ── */}
      <Card className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card relative overflow-hidden">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Your Unique Referral Code
              </span>
              <div className="flex items-center gap-3">
                <code className="text-xl md:text-2xl font-black font-mono text-foreground tracking-wider bg-background px-3 py-1 rounded-lg border border-border">
                  {partner.referral_code}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopyCode} className="gap-1.5 font-mono text-xs">
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy Code'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setQrModalOpen(true)} className="gap-1.5 text-xs">
                  <QrCode className="h-3.5 w-3.5 text-primary" />
                  QR Code
                </Button>
                <Button size="sm" variant="outline" onClick={shareWhatsApp} className="gap-1.5 text-xs text-emerald-400 hover:text-emerald-300">
                  <Share2 className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={shareLinkedIn} className="gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                  <Share2 className="h-3.5 w-3.5" />
                  LinkedIn
                </Button>
                <Button size="sm" variant="outline" onClick={shareTwitter} className="gap-1.5 text-xs text-sky-400 hover:text-sky-300">
                  <Share2 className="h-3.5 w-3.5" />
                  X / Post
                </Button>
              </div>
            </div>

            <div className="space-y-1 md:max-w-md w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Direct Registration Link
              </span>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={referralLink}
                  className="font-mono text-xs bg-background truncate"
                />
                <Button size="sm" className="gradient-primary shrink-0 gap-1.5" onClick={() => handleCopyLink(referralLink)}>
                  {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy Link'}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background/70 border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary shrink-0" />
              <span>
                <strong>Audience Value:</strong> Anyone registering with your link receives a guaranteed <strong>10% discount on their first wallet topup</strong>.
              </span>
            </div>
            <a href={referralLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 shrink-0 font-medium">
              Test Link <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── Conversion Funnel Analytics Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="rounded-2xl bg-card border border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Total Clicks</p>
            <div className="text-2xl font-extrabold text-foreground mt-1 font-mono">{totalClicks}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Unique link visits</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Signups</p>
            <div className="text-2xl font-extrabold text-primary mt-1 font-mono">{totalReferrals}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{clickToSignupRate}% click-to-signup</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Paid Clients</p>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">{paidReferrals}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{signupToPaidRate}% conversion rate</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Revenue Driven</p>
            <div className="text-2xl font-extrabold text-foreground mt-1 font-mono">₹{totalRevenueDriven.toLocaleString('en-IN')}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Client topups processed</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Total Earnings</p>
            <div className="text-2xl font-extrabold text-primary mt-1 font-mono">₹{totalCommission.toLocaleString('en-IN')}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Accrued commissions</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border border-border/60 flex flex-col justify-between">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Pending Settlement</p>
            <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">₹{(partner.pending_earnings || 0).toLocaleString('en-IN')}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Available for payout</p>
            {(partner.pending_earnings || 0) >= 1000 ? (
              <Button
                size="sm"
                className="mt-2.5 w-full text-[11px] font-bold gradient-primary h-7"
                onClick={() => {
                  setRequestAmount(String(partner.pending_earnings || 0));
                  setRequestPayoutOpen(true);
                }}
              >
                Request Payout
              </Button>
            ) : (
              <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono">Min ₹1k threshold</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dashboard Tabs ── */}
      <Tabs defaultValue="referrals" className="space-y-6">
        <TabsList className="bg-card border border-border/60 p-1 rounded-xl flex-wrap">
          <TabsTrigger value="referrals" className="gap-2">
            <Users className="h-4 w-4" />
            Referred Clients ({referrals.length})
          </TabsTrigger>
          <TabsTrigger value="link_builder" className="gap-2">
            <Share2 className="h-4 w-4" />
            Campaign Link Builder
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <Download className="h-4 w-4" />
            Marketing &amp; Swipe Kit
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Settlements &amp; Payouts ({payouts.length})
          </TabsTrigger>
          {partner.category === 'white_label' && (
            <TabsTrigger value="white_label_settings" className="gap-2 text-emerald-400">
              <Globe className="h-4 w-4" />
              White-Label Branding
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Referrals Tab ── */}
        <TabsContent value="referrals" className="space-y-4">
          <Card className="rounded-2xl bg-card border border-border/60">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Referred Companies &amp; Protected Deals</CardTitle>
                <CardDescription>Track all accounts registered via your partner link and their payment statuses</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search company or email..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="max-w-xs text-xs"
                />
                <Button size="sm" onClick={() => setDealModalOpen(true)} className="gradient-primary text-xs font-semibold shrink-0">
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Protect New Deal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredReferrals.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-foreground">No referrals recorded yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Share your unique referral link to start acquiring clients and earning monthly commissions!
                  </p>
                  <Button size="sm" onClick={() => handleCopyLink(referralLink)} className="gradient-primary font-semibold mt-2">
                    Copy Your Referral Link
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead>Plan / Deal</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <TableHead>1st Topup</TableHead>
                        <TableHead>Discount Saved</TableHead>
                        <TableHead className="text-right">Your Commission</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReferrals.map((ref) => (
                        <TableRow key={ref.id}>
                          <TableCell className="font-bold text-foreground">
                            {ref.company_name}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-medium text-foreground">{ref.admin_name || 'Admin'}</p>
                              <p className="text-muted-foreground">{ref.admin_email || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {new Date(ref.registered_at).toLocaleDateString('en-IN')}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <Badge variant="outline" className="text-[10px]">
                              {ref.plan_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {ref.is_paid ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                Paid Customer
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
                                Pending 1st Topup
                              </Badge>
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
                          <TableCell>
                            <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">
                              {ref.commission_status}
                            </span>
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

        {/* ── Campaign Link Builder Tab ── */}
        <TabsContent value="link_builder" className="space-y-6 max-w-2xl">
          <Card className="rounded-2xl bg-card border border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">UTM Campaign Tracking Link Generator</CardTitle>
              <CardDescription>
                Customize links for LinkedIn, email newsletters, or webinars to see which campaigns drive the most revenue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="utmSource">Traffic Source</Label>
                  <Select value={utmSource} onValueChange={setUtmSource}>
                    <SelectTrigger id="utmSource">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="twitter">X / Twitter</SelectItem>
                      <SelectItem value="newsletter">Email Newsletter</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="utmCamp">Campaign Name</Label>
                  <Input
                    id="utmCamp"
                    placeholder="e.g. q1_webinar"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label>Generated Trackable Link</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={customCampaignLink} className="font-mono text-xs bg-secondary/20" />
                  <Button size="sm" className="gradient-primary shrink-0" onClick={() => handleCopyLink(customCampaignLink)}>
                    Copy Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Marketing Assets Kit ── */}
        <TabsContent value="assets" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="rounded-2xl bg-card border border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Sales Pitch Decks
                </CardTitle>
                <CardDescription className="text-xs">
                  Editable 15-slide client pitch deck covering FastAI features and ROI numbers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => toast({ title: 'Download Started', description: 'FastestCRM_Partner_Deck_2025.pdf' })}>
                  <Download className="h-3.5 w-3.5" />
                  Download Deck (PDF)
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-card border border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Competitor Battlecards
                </CardTitle>
                <CardDescription className="text-xs">
                  Head-to-head comparison matrices vs Zoho CRM, HubSpot, and LeadSquared.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => toast({ title: 'Download Started', description: 'Battlecard_Zoho_HubSpot_Comparison.pdf' })}>
                  <Download className="h-3.5 w-3.5" />
                  Download Battlecards
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-card border border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  10% Discount Banners
                </CardTitle>
                <CardDescription className="text-xs">
                  Pre-designed social banners and email graphics advertising your discount code.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => toast({ title: 'Download Started', description: 'Promo_Banners_Pack.zip' })}>
                  <Download className="h-3.5 w-3.5" />
                  Download Banners Pack
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl bg-card border border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Ready-to-Use Email / LinkedIn Swipe Copy</CardTitle>
              <CardDescription className="text-xs">Copy and paste this template to share with your network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-secondary/15 border border-border/50 text-xs text-muted-foreground font-mono space-y-3">
                <p>
                  "Hey team! We recently evaluated multiple CRMs for high-velocity sales teams and partnered with @FastestCRM. Their 300ms lead routing from Meta &amp; Google Ads + autonomous telecalling dialer is unbeatable.
                </p>
                <p>
                  If you are scaling outbound sales, check it out here: {referralLink}
                </p>
                <p>
                  Use my partner code '{partner.referral_code}' to claim an extra 10% discount on your first wallet recharge!"
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2 text-xs font-mono"
                onClick={() => {
                  navigator.clipboard.writeText(`Hey team! Check out Fastest CRM for high-velocity outbound sales. Use my link ${referralLink} with partner code '${partner.referral_code}' for 10% off your first recharge!`);
                  toast({ title: 'Swipe Copy Copied to Clipboard!' });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Swipe Copy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settlements & Payouts Tab ── */}
        <TabsContent value="payouts" className="space-y-6 max-w-4xl">
          {/* Payout Summary & Request Banner */}
          <Card className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Available for Withdrawal</p>
                <div className="text-3xl font-black text-foreground mt-1 font-mono">
                  ₹{(partner.pending_earnings || 0).toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lifetime Settled: <span className="text-emerald-400 font-bold font-mono">₹{(partner.paid_earnings || 0).toLocaleString('en-IN')}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  className="gradient-primary font-bold shadow-lg shadow-primary/20"
                  disabled={(partner.pending_earnings || 0) < 1000}
                  onClick={() => {
                    setRequestAmount(String(partner.pending_earnings || 0));
                    setRequestPayoutOpen(true);
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-1.5" />
                  Request Payout Settlement
                </Button>
              </div>
            </div>
            {(partner.pending_earnings || 0) < 1000 && (
              <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/40">
                Minimum withdrawal threshold is ₹1,000. Your earnings accumulate automatically as your referred clients pay for licenses and top up their wallets.
              </p>
            )}
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Payout Bank Form */}
            <Card className="rounded-2xl bg-card border border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Bank &amp; Settlement Account</CardTitle>
                <CardDescription className="text-xs">
                  Update bank details or UPI ID for direct monthly automated commission payouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePayout} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="upi" className="text-xs">UPI ID (Fastest Transfer)</Label>
                    <Input
                      id="upi"
                      placeholder="name@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bank" className="text-xs">Bank Name</Label>
                      <Input
                        id="bank"
                        placeholder="HDFC Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ifsc" className="text-xs">IFSC Code</Label>
                      <Input
                        id="ifsc"
                        placeholder="HDFC0001234"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="acc" className="text-xs">Account Number</Label>
                    <Input
                      id="acc"
                      placeholder="50100234567890"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pan" className="text-xs">PAN / GST Number</Label>
                    <Input
                      id="pan"
                      placeholder="ABCDE1234F"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <Button type="submit" size="sm" className="gradient-primary font-semibold w-full mt-2" disabled={savingPayout}>
                    {savingPayout ? 'Saving...' : 'Save Bank Details'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Payout History */}
            <Card className="rounded-2xl bg-card border border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Settlement History</CardTitle>
                <CardDescription className="text-xs">Audit log of all payouts transferred to your account</CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No past payout records yet. Commissions are settled monthly.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payouts.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-secondary/15 border border-border/40 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold font-mono text-sm text-foreground">₹{p.amount.toLocaleString('en-IN')}</p>
                          <p className="text-muted-foreground text-[11px]">Ref: {p.reference_number}</p>
                          <p className="text-[10px] text-muted-foreground/80">{new Date(p.paid_at).toLocaleDateString('en-IN')}</p>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                          {p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── White-Label Branding Settings Tab ── */}
        {partner.category === 'white_label' && (
          <TabsContent value="white_label_settings" className="space-y-6 max-w-2xl">
            <Card className="rounded-2xl bg-card border border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-emerald-400" />
                  White-Label Domain &amp; Infrastructure
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure your custom domain routing and proprietary brand name.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveWhiteLabel} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wlBrand">Your Brand Name</Label>
                    <Input
                      id="wlBrand"
                      placeholder="e.g. Apex Sales Cloud"
                      value={wlBrandName}
                      onChange={(e) => setWlBrandName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wlDom">Custom Domain / Subdomain</Label>
                    <Input
                      id="wlDom"
                      placeholder="crm.youragency.com"
                      value={wlDomain}
                      onChange={(e) => setWlDomain(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Point CNAME record to `cname.vercel-dns.com` for automated SSL provisioning.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                    <p className="font-bold">White-Label License Active</p>
                    <p>Flat platform cost: ₹50,000 / month. You retain 100% of all customer software billing.</p>
                  </div>

                  <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold" disabled={savingWl}>
                    {savingWl ? 'Updating...' : 'Save Branding Config'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Deal Registration Modal ── */}
      <Dialog open={dealModalOpen} onOpenChange={setDealModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Register a Deal (90-Day Protection)
            </DialogTitle>
            <DialogDescription>
              Protect your prospective client opportunities. Fastest CRM direct sales will never solicit or compete with your registered accounts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterDeal} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="dealComp">Prospect Company / Website *</Label>
              <Input
                id="dealComp"
                required
                placeholder="e.g. Solaris Tech Labs (solaris.io)"
                value={dealCompany}
                onChange={(e) => setDealCompany(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dealAdm">Contact Person</Label>
                <Input
                  id="dealAdm"
                  placeholder="Karan Patel"
                  value={dealAdmin}
                  onChange={(e) => setDealAdmin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dealEm">Work Email *</Label>
                <Input
                  id="dealEm"
                  required
                  type="email"
                  placeholder="karan@solaris.io"
                  value={dealEmail}
                  onChange={(e) => setDealEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dealSt">Expected Team Size</Label>
              <Select value={dealSeats} onValueChange={setDealSeats}>
                <SelectTrigger id="dealSt">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Seats (Starter)</SelectItem>
                  <SelectItem value="15">15 Seats (Growth)</SelectItem>
                  <SelectItem value="30">30 Seats (Mid-Market)</SelectItem>
                  <SelectItem value="50+">50+ Seats (Enterprise)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dealNt">Project Scope / Deal Notes</Label>
              <Input
                id="dealNt"
                placeholder="Replacing Zoho CRM; needs outbound telecaller dialer"
                value={dealNotes}
                onChange={(e) => setDealNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDealModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="gradient-primary font-semibold" disabled={registeringDeal}>
                {registeringDeal ? 'Registering...' : 'Lock Deal (90 Days)'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── QR Code Modal ── */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Your Partner Referral QR Code</DialogTitle>
            <DialogDescription>
              Scan to open registration with your referral code pre-applied.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-2xl shadow-md border border-border">
              <img src={qrCodeUrl} alt="Referral QR code" className="w-52 h-52 object-contain" />
            </div>
            <code className="text-xs font-mono font-bold text-primary">{partner.referral_code}</code>
            <a href={qrCodeUrl} download={`fastestcrm_qr_${partner.referral_code}.png`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download QR Code
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Upgrade Request Dialog ── */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Partner Tier Upgrade</DialogTitle>
            <DialogDescription>
              Upgrade from Affiliate to Agency Partner (40% Lifetime Recurring) or White-Label Distributor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Select Target Track</Label>
              <Select value={requestedTier} onValueChange={(v: any) => setRequestedTier(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency &amp; Tech Partner (40% Lifetime Recurring)</SelectItem>
                  <SelectItem value="white_label">White-Label Partner (₹50K/mo, 100% Margin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Client Portfolio / Monthly Volume Overview</Label>
              <Input
                placeholder="e.g. 8 active B2B clients, managing ~60 sales seats"
                value={upgradeNotes}
                onChange={(e) => setUpgradeNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Cancel</Button>
            <Button className="gradient-primary font-semibold" onClick={handleRequestUpgrade} disabled={requestingUpgrade}>
              {requestingUpgrade ? 'Submitting...' : 'Submit Upgrade Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Request Payout Settlement ── */}
      <Dialog open={requestPayoutOpen} onOpenChange={setRequestPayoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Request Commission Settlement
            </DialogTitle>
            <DialogDescription>
              Submit a withdrawal request for your accrued affiliate and agency commissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestPayout} className="space-y-4 pt-2">
            <div className="p-3.5 rounded-xl bg-secondary/15 border border-border/50 text-xs space-y-1.5">
              <p className="font-semibold text-foreground">Receiving Account Details:</p>
              <p><strong>UPI ID:</strong> {upiId || 'Not configured'}</p>
              <p><strong>Bank:</strong> {bankName || 'Not configured'} ({accountNumber ? `••••${accountNumber.slice(-4)}` : 'Not configured'})</p>
              <p className="text-muted-foreground text-[11px] pt-1 border-t border-border/40">
                To update bank or UPI info, go to the Settlements &amp; Payouts tab.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reqAmount">Withdrawal Amount (₹) *</Label>
              <Input
                id="reqAmount"
                type="number"
                min="1000"
                max={partner.pending_earnings || 0}
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder={String(partner.pending_earnings || 0)}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Minimum: ₹1,000</span>
                <span>Available: <strong>₹{(partner.pending_earnings || 0).toLocaleString('en-IN')}</strong></span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reqNotes">Transfer Remarks (Optional)</Label>
              <Input
                id="reqNotes"
                placeholder="e.g. Please settle to primary UPI ID"
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setRequestPayoutOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                className="gradient-primary font-bold"
                disabled={submittingPayoutRequest || (partner.pending_earnings || 0) < 1000}
              >
                {submittingPayoutRequest ? 'Submitting...' : `Request ₹${(Number(requestAmount) || partner.pending_earnings || 0).toLocaleString('en-IN')} Payout`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
