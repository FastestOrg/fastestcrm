import { useState, useEffect } from 'react';
// DashboardLayout removed
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { proxifySupabaseUrl } from '@/lib/utils';
import {
  Building2, Users, CreditCard, Globe, Palette,
  Loader2, Save, ExternalLink, Copy, CheckCircle, AlertCircle, Upload,
  RefreshCw, Trash2, Link2, Wallet, Plus, Calendar, Gift, Tag, Shield
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

interface Company {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  domain_status: string | null;
  logo_url: string | null;
  primary_color: string | null;
  total_licenses: number;
  used_licenses: number;
  is_active: boolean;
  subscription_valid_until: string | null;
  subscription_status: string | null;
  features: Record<string, boolean> | null;
  mask_leads: boolean;
  default_currency: string | null;
  ai_calling_button_active: boolean;
}

interface WalletData {
  balance: number;
  currency: string;
}

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  status: string;
  created_at: string;
}

const PRICE_PER_SEAT = 999;

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function ManageCompany() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, currency: 'INR' });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Branding
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#8B5CF6');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [maskLeads, setMaskLeads] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState('INR');
  const [aiCallingButtonActive, setAiCallingButtonActive] = useState(false);

  // Data Sync
  const [syncCountryCode, setSyncCountryCode] = useState('91');
  const [syncTotalDigits, setSyncTotalDigits] = useState('10');
  const [syncingLeads, setSyncingLeads] = useState(false);

  // Domain
  const [savingDomain, setSavingDomain] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [domainError, setDomainError] = useState('');
  const [vercelTxtRecord, setVercelTxtRecord] = useState<{ type: string; domain: string; value: string } | null>(null);

  // Wallet & Licenses
  const [addCreditOpen, setAddCreditOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState<string>('1000');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amount: number } | null>(null);
  const [processingRecharge, setProcessingRecharge] = useState(false);

  const [giftCardCode, setGiftCardCode] = useState('');
  const [redeemingGift, setRedeemingGift] = useState(false);

  const [buySeatsOpen, setBuySeatsOpen] = useState(false);
  const [extendSubOpen, setExtendSubOpen] = useState(false);
  const [seatsToBuy, setSeatsToBuy] = useState(1);
  const [extensionMonths, setExtensionMonths] = useState<string>('1');
  const [processingSub, setProcessingSub] = useState(false);

  // ─── Subscription Grace Period ──────────────────────────────────────────────
  const {
    isInGracePeriod,
    graceDaysRemaining,
    graceTotalDays,
    deletionDate,
  } = useSubscriptionStatus();

  const graceProgressPercent = Math.max(
    0,
    Math.min(100, ((graceTotalDays - graceDaysRemaining) / graceTotalDays) * 100)
  );

  const gracePeriodInfo = isInGracePeriod ? (
    <Card className="border-2 border-red-500/60 bg-red-500/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5 pointer-events-none" />
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/20 shrink-0">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <CardTitle className="text-red-500 text-lg">
              {graceDaysRemaining <= 7 ? '🚨 CRITICAL' : '⚠️'} Subscription Expired
            </CardTitle>
            <CardDescription className="text-red-400/80 font-medium">
              Your team members are locked out. Renew now to restore access.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20 text-center">
            <div className={`text-4xl font-bold font-mono tabular-nums ${graceDaysRemaining <= 7 ? 'text-red-500 animate-pulse' : graceDaysRemaining <= 30 ? 'text-orange-500' : 'text-amber-500'}`}>
              {graceDaysRemaining}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
              Days Remaining
            </div>
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20 text-center">
            <div className="text-sm font-bold text-foreground">
              {deletionDate?.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
              Data Deletion Date
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="h-2 rounded-full bg-red-500/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${graceDaysRemaining <= 7 ? 'bg-red-500' : graceDaysRemaining <= 30 ? 'bg-orange-500' : 'bg-amber-500'}`}
              style={{ width: `${graceProgressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Grace period: {Math.round(graceProgressPercent)}% elapsed
          </p>
        </div>

        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-foreground">
            <strong>What will happen:</strong> After {graceDaysRemaining} days, ALL company data — 
            leads, contacts, forms, invoices, quotations, and team accounts — will be 
            <strong className="text-red-500"> permanently and irreversibly deleted</strong>.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
            onClick={() => setAddCreditOpen(true)}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Add Funds to Wallet
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10 font-bold"
            onClick={() => setExtendSubOpen(true)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Extend Subscription
          </Button>
        </div>
      </CardContent>
    </Card>
  ) : null;

  useEffect(() => {
    if (user) {
      fetchCompanyData();
    }
  }, [user]);

  const fetchCompanyData = async () => {
    try {
      setLoading(true);
      // Get user's company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.company_id) {
        setLoading(false);
        return;
      }

      // Get company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      if (companyError) throw companyError;

      // Map to Company interface with proper typing
      const mappedCompany: Company = {
        id: companyData.id,
        name: companyData.name,
        slug: companyData.slug,
        custom_domain: companyData.custom_domain,
        domain_status: companyData.domain_status,
        logo_url: companyData.logo_url,
        primary_color: companyData.primary_color,
        total_licenses: companyData.total_licenses,
        used_licenses: companyData.used_licenses,
        is_active: companyData.is_active ?? true,
        subscription_valid_until: companyData.subscription_valid_until,
        subscription_status: companyData.subscription_status,
        features: (companyData.features as Record<string, boolean>) || null,
        mask_leads: companyData.mask_leads || false,
        default_currency: companyData.default_currency || 'INR',
        ai_calling_button_active: companyData.ai_calling_button_active || false,
      };

      setCompany(mappedCompany);
      setCompanyName(mappedCompany.name);
      setCompanySlug(mappedCompany.slug);
      setCustomDomain(mappedCompany.custom_domain || '');
      setPrimaryColor(mappedCompany.primary_color || '#8B5CF6');
      setLogoUrl(proxifySupabaseUrl(mappedCompany.logo_url));
      setMaskLeads(mappedCompany.mask_leads);
      setDefaultCurrency(mappedCompany.default_currency || 'INR');
      setAiCallingButtonActive(mappedCompany.ai_calling_button_active);

      // Get Wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance, currency')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      setWallet(walletData ? { balance: Number(walletData.balance), currency: walletData.currency } : { balance: 0, currency: 'INR' });

      // Get Transactions
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('id, amount, type, description, status, created_at')
        .eq('wallet_id', profile.company_id)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(10);

      setTransactions((txData || []) as WalletTransaction[]);

      // Load TXT verification (existing logic)
      if (companyData.custom_domain) {
        const { data: verificationData } = await (supabase
          .from('domain_verification' as any)
          .select('txt_record_name, txt_record_value')
          .eq('company_id', profile.company_id)
          .eq('domain', companyData.custom_domain.toLowerCase())
          .maybeSingle()) as any;

        if (verificationData) {
          setVercelTxtRecord({
            type: 'TXT',
            domain: verificationData.txt_record_name,
            value: verificationData.txt_record_value
          });
        }
      }

    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to load company data',
        variant: 'destructive',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: companyName,
          primary_color: primaryColor,
          logo_url: logoUrl,
          mask_leads: maskLeads,
          default_currency: defaultCurrency,
          ai_calling_button_active: aiCallingButtonActive,
        })
        .eq('id', company.id);

      if (error) throw error;
      toast({ title: 'Settings saved', description: 'Company settings updated.' });
      fetchCompanyData();
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncLeads = async () => {
    if (!company) return;
    if (!syncCountryCode || !syncTotalDigits) {
      toast({ title: "Error", description: "Please enter both country code and total digits.", variant: "destructive" });
      return;
    }

    if (!confirm(`Are you sure you want to run this synchronization? It will update all leads in the database and mark non-matching lengths as 'Wrong Number'.`)) return;

    setSyncingLeads(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-leads-phone', {
        body: { countryCode: syncCountryCode, phoneDigits: syncTotalDigits }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Synchronization Complete', description: data.message });
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncingLeads(false);
    }
  };

  const validateSlug = (slug: string): boolean => {
    const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!slug) { setSlugError('Slug is required'); return false; }
    if (slug.length < 3) { setSlugError('Slug must be at least 3 characters'); return false; }
    if (slug.length > 32) { setSlugError('Slug must be 32 characters or less'); return false; }
    if (!slugRegex.test(slug)) { setSlugError('Only lowercase letters, numbers, and hyphens allowed'); return false; }
    if (slug.includes('--')) { setSlugError('No consecutive hyphens allowed'); return false; }
    const reserved = ['www', 'api', 'app', 'admin', 'dashboard', 'mail', 'smtp', 'ftp'];
    if (reserved.includes(slug)) { setSlugError('This slug is reserved'); return false; }
    setSlugError('');
    return true;
  };

  // Feature Unlocking
  const [purchasingFeature, setPurchasingFeature] = useState<string | null>(null);

  // Discount Validation
  const [validatingCode, setValidatingCode] = useState(false);
  const [discountInfo, setDiscountInfo] = useState<{ valid: boolean; message: string; finalAmount?: number } | null>(null);

  const checkFeature = (feature: string) => {
    const features = (company?.features as any) || {};
    return !!features[feature];
  };

  const handlePurchaseFeature = async (feature: string, cost: number) => {
    if (!company) return;
    if (wallet.balance < cost) {
      toast({ title: "Insufficient Funds", description: `You need ₹${cost - wallet.balance} more.`, variant: "destructive" });
      setAddCreditOpen(true);
      return;
    }

    if (!confirm(`Unlock this feature for ₹${cost}?`)) return;

    setPurchasingFeature(feature);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-addon', {
        body: { feature }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Unlocked!", description: "Feature is now available." });
      fetchCompanyData(); // Reload to get updated features
    } catch (err: any) {
      toast({ title: "Purchase Failed", description: err.message, variant: "destructive" });
    } finally {
      setPurchasingFeature(null);
    }
  };

  const handleApplyCode = async () => {
    if (!discountCode || !rechargeAmount || parseInt(rechargeAmount) < 100) {
      toast({ title: "Invalid Input", description: "Enter valid amount (>100) and code.", variant: "destructive" });
      return;
    }
    setValidatingCode(true);
    setDiscountInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-discount', {
        body: { amount: parseInt(rechargeAmount), code: discountCode }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setDiscountInfo({
        valid: data.valid,
        message: data.message,
        finalAmount: data.final_amount
      });

      if (data.valid) {
        toast({ title: 'Code Applied', description: data.message });
      } else {
        toast({ title: 'Invalid Code', description: data.message, variant: 'destructive' });
      }

    } catch (err: any) {
      toast({ title: "Validation Failed", description: err.message, variant: "destructive" });
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSlugChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setCompanySlug(normalized);
    if (normalized) validateSlug(normalized);
  };

  const handleSaveSlugAction = async () => {
    if (!company || !validateSlug(companySlug)) return;
    setSavingSlug(true);
    try {
      const { data: existing } = await supabase.from('companies').select('id').eq('slug', companySlug).neq('id', company.id).maybeSingle();
      if (existing) { setSlugError('This slug is already taken'); setSavingSlug(false); return; }
      const { error } = await supabase.from('companies').update({ slug: companySlug }).eq('id', company.id);
      if (error) throw error;
      toast({ title: 'Workspace URL updated', description: `New URL: ${companySlug}.fastestcrm.com` });
      fetchCompanyData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingSlug(false); }
  };

  const handleVerifyDomain = async () => {
    if (!company?.custom_domain) return;
    setVerifyingDomain(true);
    setDomainError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-domain', { body: { action: 'check', domain: company.custom_domain, company_id: company.id } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
      setDnsRecords(data.records || []);
      if (data.valid) { toast({ title: 'Domain Verified!', description: 'Custom domain active.' }); fetchCompanyData(); }
      else { toast({ title: 'DNS Not Ready', description: 'Check CNAME record.', variant: 'destructive' }); }
    } catch (err: any) { setDomainError(err.message); toast({ title: 'Verification Failed', description: err.message, variant: 'destructive' }); }
    finally { setVerifyingDomain(false); }
  };

  const handleSaveDomain = async () => {
    if (!company) return;
    setSavingDomain(true); setDomainError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-domain', { body: { action: 'save', domain: customDomain || null, company_id: company.id } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
      setDnsRecords(data.records || []); setVercelTxtRecord(data.vercelTxtRecord || null);
      toast({ title: data.dnsValid ? 'Domain Activated!' : 'Domain Saved', description: data.message });
      fetchCompanyData();
    } catch (err: any) { setDomainError(err.message); toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setSavingDomain(false); }
  };

  const handleWalletRecharge = async () => {
    const amount = parseInt(rechargeAmount);
    if (!amount || amount < 100) {
      toast({ title: "Invalid Amount", description: "Minimum recharge is ₹100", variant: "destructive" });
      return;
    }

    setProcessingRecharge(true);
    try {
      const { data, error } = await supabase.functions.invoke('initiate-wallet-recharge', {
        body: { amount, discount_code: discountCode || undefined }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Open Razorpay
      const options = {
        key: data.key_id,
        amount: data.amount * 100, // Make sure it matches order
        currency: data.currency,
        name: 'Fastest CRM',
        description: 'Wallet Recharge',
        order_id: data.order_id,
        handler: async function (response: any) {
          // Verify
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-wallet-recharge', {
              body: {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }
            });
            if (verifyError || verifyData?.error) throw new Error(verifyData?.error || 'Verification failed');

            toast({ title: 'Recharge Successful', description: `Wallet credited with ₹${data.credit_amount}` });
            setAddCreditOpen(false);
            fetchCompanyData();
          } catch (vErr: any) {
            toast({ title: 'Verification Failed', description: vErr.message, variant: 'destructive' });
          }
        },
        prefill: { email: user?.email },
        theme: { color: primaryColor }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (err: any) {
      toast({ title: 'Recharge Failed', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingRecharge(false);
    }
  };

  const handleRedeemGiftCard = async () => {
    if (!giftCardCode) return;
    setRedeemingGift(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem-gift-card', {
        body: { code: giftCardCode }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Redeemed!', description: `₹${data.amount} added to wallet.` });
      setGiftCardCode('');
      fetchCompanyData();
    } catch (err: any) {
      toast({ title: 'Redemption Failed', description: err.message, variant: 'destructive' });
    } finally {
      setRedeemingGift(false);
    }
  };

  const handleManageSubscription = async (action: 'add_seats' | 'extend_subscription') => {
    setProcessingSub(true);
    try {
      const body = action === 'add_seats'
        ? { action, quantity: seatsToBuy }
        : { action, months: parseInt(extensionMonths) };

      const { data, error } = await supabase.functions.invoke('manage-subscription', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: 'Subscription updated successfully.' });
      setBuySeatsOpen(false);
      setExtendSubOpen(false);
      fetchCompanyData();
    } catch (err: any) {
      toast({ title: 'Transaction Failed', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingSub(false);
    }
  };

  const calculateExtensionCost = () => {
    if (!company) return 0;
    const months = parseInt(extensionMonths);
    const totalSeats = company.total_licenses || 0;
    const baseCost = totalSeats * PRICE_PER_SEAT * months;
    let discount = 0;
    if (months === 3) discount = 0.10;
    else if (months === 6) discount = 0.20;
    else if (months === 12) discount = 0.40;
    return Math.ceil(baseCost * (1 - discount));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Copied to clipboard' });
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!company) return null;

  return (
    <>
      <div className="space-y-8 pb-10">
        <div>
          <h1 className="text-2xl font-bold">Manage Company</h1>
          <p className="text-muted-foreground">Configure your company settings, wallet, and subscription.</p>
        </div>

        {/* ═══ Subscription Expired Warning ═══ */}
        {gracePeriodInfo}

        <div className="grid gap-6 md:grid-cols-2">

          <Card className="glass relative overflow-hidden border-primary/20">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Wallet className="h-24 w-24" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Wallet Balance
              </CardTitle>
              <CardDescription>Manage your credits and payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div>
                <div className="text-4xl font-bold font-mono tracking-tight text-primary">
                  ₹{wallet.balance.toLocaleString('en-IN')}
                </div>
                {wallet.balance < 1500 && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    Low Balance: Renewals may fail.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Dialog open={addCreditOpen} onOpenChange={setAddCreditOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Credits
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Credits to Wallet</DialogTitle>
                      <DialogDescription>
                        Credits can be used for subscriptions and add-ons.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Amount (₹)</Label>
                        <Input
                          type="number"
                          value={rechargeAmount}
                          onChange={e => setRechargeAmount(e.target.value)}
                          min="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Discount Code</Label>
                        <div className="flex gap-2">
                          <Input
                            value={discountCode}
                            onChange={e => { setDiscountCode(e.target.value); setDiscountInfo(null); }}
                            placeholder="Enter code"
                          />
                          <Button
                            variant="secondary"
                            onClick={handleApplyCode}
                            disabled={!discountCode || validatingCode}
                          >
                            {validatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                          </Button>
                        </div>
                        {discountInfo && (
                          <div className={`text-xs p-2 rounded flex justify-between items-center ${discountInfo.valid ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                            <span>{discountInfo.message}</span>
                            {discountInfo.valid && discountInfo.finalAmount && (
                              <span className="font-bold">Final Pay: ₹{discountInfo.finalAmount}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleWalletRecharge} disabled={processingRecharge}>
                        {processingRecharge && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Pay & Recharge
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <Gift className="h-4 w-4 mr-2" />
                      Redeem Gift Card
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Redeem Gift Card</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Gift Card Code</Label>
                        <Input
                          value={giftCardCode}
                          onChange={e => setGiftCardCode(e.target.value)}
                          placeholder="XXXX-XXXX-XXXX"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleRedeemGiftCard} disabled={redeemingGift}>
                        {redeemingGift && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Redeem
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-muted-foreground">Recent Transactions</p>
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center text-sm p-2 bg-muted/40 rounded border">
                      <div className="flex flex-col">
                        <span className="font-medium">{tx.description}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className={`font-mono font-medium ${tx.type.startsWith('credit') ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type.startsWith('credit') ? '+' : '-'}₹{tx.amount}
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="text-xs text-muted-foreground">No transactions yet.</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Subscription & Licenses
              </CardTitle>
              <CardDescription>₹{PRICE_PER_SEAT}/seat/month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Seats</span>
                  <div className="text-2xl font-bold mt-1">{company.total_licenses}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {company.used_licenses} used
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={company.subscription_status === 'active' ? 'default' : 'destructive'}>
                      {company.subscription_status?.toUpperCase() || 'INACTIVE'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Expires: {company.subscription_valid_until ? new Date(company.subscription_valid_until).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Dialog open={buySeatsOpen} onOpenChange={setBuySeatsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>Add More Seats</span>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Seats</DialogTitle>
                      <DialogDescription>
                        Seats will be prorated until your next renewal date.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => setSeatsToBuy(Math.max(1, seatsToBuy - 1))}>-</Button>
                        <div className="text-xl font-bold w-12 text-center">{seatsToBuy}</div>
                        <Button variant="outline" size="icon" onClick={() => setSeatsToBuy(seatsToBuy + 1)}>+</Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Estimated Cost: Calculation handled by server based on remaining days.
                        Ensure you have at least <span className="text-foreground font-medium">₹{seatsToBuy * PRICE_PER_SEAT}</span> in your wallet.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => handleManageSubscription('add_seats')} disabled={processingSub}>
                        {processingSub && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Confirm & Buy
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={extendSubOpen} onOpenChange={setExtendSubOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full justify-between">
                      <span>Extend Subscription</span>
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Extend Subscription</DialogTitle>
                      <DialogDescription>
                        Pre-pay and save on your subscription.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Label>Duration</Label>
                      <Select value={extensionMonths} onValueChange={setExtensionMonths}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Month (No Discount)</SelectItem>
                          <SelectItem value="3">3 Months (10% Off)</SelectItem>
                          <SelectItem value="6">6 Months (20% Off)</SelectItem>
                          <SelectItem value="12">12 Months (40% Off)</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Cost</span>
                        <span className="text-xl font-bold text-primary">₹{calculateExtensionCost().toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Current Wallet Balance: ₹{wallet.balance.toLocaleString('en-IN')}
                      </p>
                      {wallet.balance < calculateExtensionCost() && (
                        <p className="text-xs text-destructive font-medium">
                          Insufficient funds. Please add credits first.
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => handleManageSubscription('extend_subscription')}
                        disabled={processingSub || wallet.balance < calculateExtensionCost()}
                      >
                        {processingSub && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Pay & Extend
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="grid gap-6 md:grid-cols-2">

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Branding</CardTitle>
              <CardDescription>Customize your company appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg border border-border flex items-center justify-center overflow-hidden bg-muted/50 relative group">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <Building2 className="h-8 w-8 text-muted-foreground" />}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => document.getElementById('logo-upload')?.click()}>
                      <Upload className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <Input id="logo-upload" type="file" accept="image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file || !company) return;
                        setUploadingLogo(true);
                        try {
                          const fileExt = file.name.split('.').pop();
                          const filePath = `${company.id}/${crypto.randomUUID()}.${fileExt}`;
                          const { error } = await supabase.storage.from('company_assets').upload(filePath, file);
                          if (error) throw error;
                          const { data: { publicUrl } } = supabase.storage.from('company_assets').getPublicUrl(filePath);
                          setLogoUrl(proxifySupabaseUrl(publicUrl));
                          toast({ title: "Logo uploaded", description: "Remember to save." });
                        } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
                        finally { setUploadingLogo(false); }
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()} disabled={uploadingLogo}>
                      {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />} Upload Logo
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'SGD', 'AUD', 'CAD', 'JPY'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Default currency for new quotations and invoices.</p>
              </div>
              <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} Save Branding
              </Button>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Domain</CardTitle>
              <CardDescription>Workspace URL & Custom Domain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Default Workspace URL</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 bg-muted rounded-md overflow-hidden">
                    <Input
                      value={companySlug}
                      onChange={e => handleSlugChange(e.target.value)}
                      className="border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
                      disabled={!checkFeature('custom_slug')}
                    />
                    <span className="px-3 py-2 text-sm text-muted-foreground border-l border-border bg-muted/50">.fastestcrm.com</span>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(`https://${companySlug}.fastestcrm.com`)}><Copy className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => window.open(`https://${companySlug}.fastestcrm.com`, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                </div>

                {!checkFeature('custom_slug') ? (
                  <Button
                    variant="secondary"
                    onClick={() => handlePurchaseFeature('custom_slug', 100)}
                    disabled={!!purchasingFeature}
                    className="w-full mt-2"
                  >
                    {purchasingFeature === 'custom_slug' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Tag className="mr-2 h-4 w-4 text-primary" /> Unlock Custom URL (100 Credits)
                  </Button>
                ) : (
                  slugError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{slugError}</p>
                )}

                {checkFeature('custom_slug') && companySlug !== company.slug && !slugError && (
                  <Button onClick={handleSaveSlugAction} disabled={savingSlug} size="sm" className="mt-2">
                    {savingSlug ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} Save New Slug
                  </Button>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Custom Domain</Label>
                  {company.custom_domain && (
                    <Badge variant={company.domain_status === 'active' ? 'default' : 'outline'} className={company.domain_status === 'active' ? 'bg-green-500/20 text-green-600 border-green-500/30' : ''}>
                      {company.domain_status === 'active' ? 'Verified' : 'Pending'}
                    </Badge>
                  )}
                </div>

                {!checkFeature('custom_domain') ? (
                  <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg text-center space-y-3">
                    <Globe className="h-8 w-8 text-primary mx-auto opacity-50" />
                    <div>
                      <h4 className="font-semibold">White Label Custom Domain</h4>
                      <p className="text-xs text-muted-foreground">Use your own domain (e.g. crm.yourcompany.com)</p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handlePurchaseFeature('custom_domain', 5000)}
                      disabled={!!purchasingFeature}
                    >
                      {purchasingFeature === 'custom_domain' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Wallet className="mr-2 h-4 w-4" /> Unlock for 5000 Credits
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Input value={customDomain} onChange={e => setCustomDomain(e.target.value.toLowerCase())} placeholder="crm.acme.com" className="flex-1" />
                      {company.custom_domain && (
                        <>
                          <Button variant="outline" size="icon" onClick={handleVerifyDomain} disabled={verifyingDomain}><RefreshCw className={`h-4 w-4 ${verifyingDomain ? 'animate-spin' : ''}`} /></Button>
                          <Button variant="outline" size="icon" onClick={() => window.open(`https://${company.custom_domain}`, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                    {domainError && <p className="text-xs text-destructive">{domainError}</p>}

                    <div className="flex gap-2">
                      {customDomain !== company.custom_domain && (
                        <Button size="sm" onClick={handleSaveDomain} disabled={savingDomain} className="flex-1">
                          {savingDomain ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} Save Domain
                        </Button>
                      )}
                      {company.custom_domain && (
                        <Button size="sm" variant="destructive" onClick={async () => {
                          if (!confirm("Remove domain?")) return;
                          setSavingDomain(true);
                          try {
                            const { error } = await supabase.functions.invoke('verify-domain', { body: { action: 'remove', company_id: company.id } });
                            if (error) throw error;
                            setCustomDomain(''); setDnsRecords([]);
                            toast({ title: "Removed", description: "Domain removed." }); fetchCompanyData();
                          } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                          finally { setSavingDomain(false); }
                        }} disabled={savingDomain} className="flex-1">
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>

                    {dnsRecords.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-md text-xs space-y-2 font-mono">
                        <p className="font-sans font-medium">Configuration Required:</p>
                        <div className="grid grid-cols-3 gap-2 border-b pb-2">
                          <span className="font-semibold">Type</span><span className="font-semibold">Host</span><span className="font-semibold">Value</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span>CNAME</span><span>@</span><span>dns.fastestcrm.com</span>
                        </div>
                        {vercelTxtRecord && (
                          <div className="grid grid-cols-3 gap-2 break-all">
                            <span>{vercelTxtRecord.type}</span><span>{vercelTxtRecord.domain}</span><span>{vercelTxtRecord.value.substring(0, 10)}...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <Card className="glass border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Privacy & Security</CardTitle>
                <CardDescription>Manage how data is displayed and secured.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-1">
                    <Label htmlFor="mask-leads" className="text-base">Mask Contact Information</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide lead phone numbers and email addresses by default.
                      Users can click to reveal.
                    </p>
                  </div>
                  <Switch
                    id="mask-leads"
                    checked={maskLeads}
                    onCheckedChange={setMaskLeads}
                  />
                </div>
                <Separator />

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-1">
                    <Label htmlFor="ai-calling-button-active" className="text-base">AI Calling Button Activation</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable manual AI call initiation button in the lead panel.
                    </p>
                  </div>
                  <Switch
                    id="ai-calling-button-active"
                    checked={aiCallingButtonActive}
                    onCheckedChange={setAiCallingButtonActive}
                  />
                </div>
                <Separator />
                
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <Label className="text-base text-primary">Data Synchronisation</Label>
                    <p className="text-sm text-muted-foreground">
                      Standardize phone numbers across all leads. This will prepend the specified country code to any number matching the exact total digits. If the number has fewer digits than required, it will be marked as "Wrong Number".
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Country Code</Label>
                      <Input 
                        placeholder="e.g. 91" 
                        value={syncCountryCode} 
                        onChange={(e) => setSyncCountryCode(e.target.value)} 
                        type="number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Digits Allowed (without code)</Label>
                      <Input 
                        placeholder="e.g. 10" 
                        value={syncTotalDigits} 
                        onChange={(e) => setSyncTotalDigits(e.target.value)} 
                        type="number"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    variant="secondary" 
                    onClick={handleSyncLeads} 
                    disabled={syncingLeads}
                    className="w-full sm:w-auto"
                  >
                    {syncingLeads ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />} 
                    Synchronise Leads Data
                  </Button>
                </div>

                <Separator />
                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
