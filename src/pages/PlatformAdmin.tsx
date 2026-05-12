import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2, Users, Search, Plus, Wallet, Gift, Tag,
  Loader2, ArrowLeft, CheckCircle, XCircle, Eye, RefreshCw,
  Calendar, Clock, DollarSign, BarChart3, Download, Trash2, Edit, Megaphone, FileDown
} from 'lucide-react';
import { AnalyticsTab } from '@/components/platform/AnalyticsTab';
import { AnnouncementsTab } from '@/components/platform/AnnouncementsTab';
import { CompanyUsersPanel, type CompanyForPanel } from '@/components/platform/CompanyUsersPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Company {
  id: string;
  name: string;
  slug: string;
  total_licenses: number;
  used_licenses: number;
  is_active: boolean;
  created_at: string;
  subscription_status: string | null;
  subscription_valid_until: string | null;
  wallet_balance: number;
}

interface Stats {
  totalCompanies: number;
  activeCompanies: number;
  inactiveCompanies: number;
  totalLicenses: number;
  usedLicenses: number;
  availableLicenses: number;
  totalWalletBalance: number;
  expiringSoon: number;
}

interface DiscountCode {
  code: string;
  discount_percentage: number;
  uses_count: number;
  total_uses: number;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}

interface GiftCard {
  code: string;
  amount: number;
  active: boolean;
  is_redeemed: boolean;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function PlatformAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCompanies: 0,
    activeCompanies: 0,
    inactiveCompanies: 0,
    totalLicenses: 0,
    usedLicenses: 0,
    availableLicenses: 0,
    totalWalletBalance: 0,
    expiringSoon: 0
  });
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);

  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [userMgmtCompany, setUserMgmtCompany] = useState<CompanyForPanel | null>(null);
  const [downloadingCompanyId, setDownloadingCompanyId] = useState<string | null>(null);

  // Dialog states
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [addLicensesOpen, setAddLicensesOpen] = useState(false);
  const [companyDetailsOpen, setCompanyDetailsOpen] = useState(false);
  const [companyDetails, setCompanyDetails] = useState<any>(null);

  // Form states
  const [creditsAmount, setCreditsAmount] = useState('1000');
  const [creditsDescription, setCreditsDescription] = useState('');
  const [licensesToAdd, setLicensesToAdd] = useState(1);
  const [newSubDate, setNewSubDate] = useState('');
  const [newSubStatus, setNewSubStatus] = useState('active');

  // Discount code form
  const [newDiscountCode, setNewDiscountCode] = useState('');
  const [newDiscountPercentage, setNewDiscountPercentage] = useState('10');
  const [newDiscountUses, setNewDiscountUses] = useState('10');
  const [newDiscountExpiry, setNewDiscountExpiry] = useState('');
  const [createDiscountOpen, setCreateDiscountOpen] = useState(false);

  // Gift card form
  const [newGiftCode, setNewGiftCode] = useState('');
  const [newGiftAmount, setNewGiftAmount] = useState('1000');
  const [newGiftExpiry, setNewGiftExpiry] = useState('');
  const [bulkGiftCount, setBulkGiftCount] = useState('10');
  const [createGiftOpen, setCreateGiftOpen] = useState(false);
  const [bulkGiftOpen, setBulkGiftOpen] = useState(false);

  useEffect(() => {
    if (user) {
      checkPlatformAdmin();
    }
  }, [user]);

  const checkPlatformAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error || !data) {
        setIsPlatformAdmin(false);
        setLoading(false);
        return;
      }

      setIsPlatformAdmin(true);
      fetchAllData();
    } catch (err) {
      setIsPlatformAdmin(false);
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCompaniesAndStats(),
        fetchDiscountCodes(),
        fetchGiftCards()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompaniesAndStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'get_all_stats' }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStats(data.stats);
      setCompanies(data.companies || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to load companies',
        variant: 'destructive',
      });
    }
  };

  const fetchDiscountCodes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'get_discount_codes' }
      });

      if (error) throw error;
      setDiscountCodes(data?.codes || []);
    } catch (err) {
      console.error('Failed to load discount codes:', err);
    }
  };

  const fetchGiftCards = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'get_gift_cards' }
      });

      if (error) throw error;
      setGiftCards(data?.cards || []);
    } catch (err) {
      console.error('Failed to load gift cards:', err);
    }
  };

  const fetchCompanyDetails = async (companyId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'get_company_details', company_id: companyId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCompanyDetails(data);
      setCompanyDetailsOpen(true);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to load company details',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (company: Company) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: {
          action: 'toggle_active',
          company_id: company.id,
          is_active: !company.is_active
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: data.message });
      fetchCompaniesAndStats();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update company status',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedCompany || !creditsAmount) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: {
          action: 'add_wallet_credits',
          company_id: selectedCompany.id,
          amount: parseInt(creditsAmount),
          description: creditsDescription || undefined
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: data.message });
      setAddCreditsOpen(false);
      setCreditsAmount('1000');
      setCreditsDescription('');
      fetchCompaniesAndStats();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add credits',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleAddLicenses = async () => {
    if (!selectedCompany || licensesToAdd < 1) return;

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('add_company_licenses', {
        _company_id: selectedCompany.id,
        _quantity: licensesToAdd
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Added ${licensesToAdd} license(s) to ${selectedCompany.name}`,
      });
      setAddLicensesOpen(false);
      setLicensesToAdd(1);
      fetchCompaniesAndStats();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add licenses',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleEditSubscription = async () => {
    if (!selectedCompany) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: {
          action: 'edit_subscription',
          company_id: selectedCompany.id,
          subscription_valid_until: newSubDate || null,
          subscription_status: newSubStatus
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: data.message });
      setEditSubOpen(false);
      fetchCompaniesAndStats();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update subscription',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateDiscount = async () => {
    if (!newDiscountCode || !newDiscountPercentage) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: {
          action: 'create_discount_code',
          code: newDiscountCode,
          discount_percentage: parseFloat(newDiscountPercentage),
          total_uses: parseInt(newDiscountUses) || 1,
          valid_until: newDiscountExpiry || null
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: 'Discount code created' });
      setCreateDiscountOpen(false);
      setNewDiscountCode('');
      setNewDiscountPercentage('10');
      setNewDiscountUses('10');
      setNewDiscountExpiry('');
      fetchDiscountCodes();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create discount code',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleDiscount = async (code: string, active: boolean) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'toggle_discount_code', code, active: !active }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: data.message });
      fetchDiscountCodes();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to toggle discount code',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteDiscount = async (code: string) => {
    if (!confirm(`Delete discount code ${code}?`)) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'delete_discount_code', code }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: 'Discount code deleted' });
      fetchDiscountCodes();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete discount code',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateGiftCard = async () => {
    if (!newGiftCode || !newGiftAmount) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: {
          action: 'create_gift_card',
          code: newGiftCode,
          amount: parseInt(newGiftAmount),
          expires_at: newGiftExpiry || null
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: 'Gift card created' });
      setCreateGiftOpen(false);
      setNewGiftCode('');
      setNewGiftAmount('1000');
      setNewGiftExpiry('');
      fetchGiftCards();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create gift card',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkGiftCards = async () => {
    if (!newGiftAmount || !bulkGiftCount) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: {
          action: 'create_bulk_gift_cards',
          amount: parseInt(newGiftAmount),
          count: parseInt(bulkGiftCount),
          expires_at: newGiftExpiry || null
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: data.message });

      // Offer download
      if (data.codes) {
        const csv = 'Code,Amount\n' + data.codes.map((c: string) => `${c},${newGiftAmount}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gift_cards_${Date.now()}.csv`;
        a.click();
      }

      setBulkGiftOpen(false);
      setNewGiftAmount('1000');
      setBulkGiftCount('10');
      setNewGiftExpiry('');
      fetchGiftCards();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create gift cards',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteGiftCard = async (code: string) => {
    if (!confirm(`Delete gift card ${code}?`)) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'delete_gift_card', code }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Success', description: 'Gift card deleted' });
      fetchGiftCards();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete gift card',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * Download all leads for a company as CSV.
   * The correct table is resolved server-side based on industry / custom_leads_table,
   * mirroring exactly what the company admin sees in "All Leads".
   */
  const handleDownloadCompanyData = async (company: Company) => {
    setDownloadingCompanyId(company.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-company', {
        body: { action: 'download_company_data', company_id: company.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const leads: Record<string, any>[] = data.leads || [];

      if (leads.length === 0) {
        toast({
          title: 'No Data',
          description: `${company.name} has no leads to download.`,
        });
        return;
      }

      // Build CSV: derive headers from first row, skip internal Supabase cols
      const skipCols = new Set(['company_id']);
      const allKeys = Object.keys(leads[0]).filter(k => !skipCols.has(k));

      // Put friendly columns first
      const priorityCols = [
        'name', 'email', 'phone', 'status', 'lead_source',
        '_owner_name', '_pre_sales_owner_name', '_post_sales_owner_name',
        '_created_by_name', 'product_purchased', 'created_at', 'updated_at',
      ];
      const orderedKeys = [
        ...priorityCols.filter(k => allKeys.includes(k)),
        ...allKeys.filter(k => !priorityCols.includes(k)),
      ];

      const escapeCell = (val: any): string => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/\r\n|\n|\r/g, ' ');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const header = orderedKeys.join(',');
      const rows = leads.map(lead =>
        orderedKeys.map(k => escapeCell(lead[k])).join(',')
      );
      const csv = [header, ...rows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `${company.slug}_leads_${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: `Downloaded ${leads.length} leads for ${company.name} (${data.table_name}).`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to download company data',
        variant: 'destructive',
      });
    } finally {
      setDownloadingCompanyId(null);
    }
  };

  const generateRandomCode = (prefix: string = '') => {
    return prefix + Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <XCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You are not authorized to view this page.</p>
        <Button onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Platform Administration</h1>
            </div>
            <p className="text-muted-foreground">Manage all companies, licenses, discounts and gift cards</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchAllData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Badge className="bg-primary/20 text-primary">Platform Admin</Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <Card className="col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                  <div className="text-sm text-muted-foreground">Total Companies</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.activeCompanies}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.usedLicenses}/{stats.totalLicenses}</div>
                  <div className="text-sm text-muted-foreground">Licenses</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Wallet className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">₹{stats.totalWalletBalance.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Wallets</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="companies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="discounts" className="gap-2">
              <Tag className="h-4 w-4" />
              Discount Codes
            </TabsTrigger>
            <TabsTrigger value="giftcards" className="gap-2">
              <Gift className="h-4 w-4" />
              Gift Cards
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Announcements
            </TabsTrigger>
          </TabsList>

          {/* Companies Tab */}
          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Companies</CardTitle>
                    <CardDescription>Manage all registered companies</CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search companies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Licenses</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => setUserMgmtCompany({ id: company.id, name: company.name, slug: company.slug })}
                            className="text-left font-semibold hover:text-primary hover:underline transition-colors cursor-pointer"
                          >
                            {company.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {company.slug}
                          </code>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{company.used_licenses}</span>
                          <span className="text-muted-foreground"> / {company.total_licenses}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">₹{(company.wallet_balance || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="outline"
                              className={
                                company.subscription_status === 'active' ? 'border-green-500 text-green-500' :
                                  company.subscription_status === 'past_due' ? 'border-amber-500 text-amber-500' :
                                    'border-muted-foreground'
                              }
                            >
                              {company.subscription_status || 'None'}
                            </Badge>
                            {company.subscription_valid_until && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(company.subscription_valid_until).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={company.is_active ? 'default' : 'destructive'}
                            className={company.is_active ? 'bg-green-500/20 text-green-500' : ''}
                          >
                            {company.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(company.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">Actions</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => fetchCompanyDetails(company.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setUserMgmtCompany({ id: company.id, name: company.name, slug: company.slug })}>
                                <Users className="h-4 w-4 mr-2" />
                                Manage Users
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedCompany(company);
                                setAddCreditsOpen(true);
                              }}>
                                <Wallet className="h-4 w-4 mr-2" />
                                Add Credits
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedCompany(company);
                                setAddLicensesOpen(true);
                              }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Licenses
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedCompany(company);
                                setNewSubDate(company.subscription_valid_until?.split('T')[0] || '');
                                setNewSubStatus(company.subscription_status || 'active');
                                setEditSubOpen(true);
                              }}>
                                <Calendar className="h-4 w-4 mr-2" />
                                Edit Subscription
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDownloadCompanyData(company)}
                                disabled={downloadingCompanyId === company.id}
                                className="text-blue-500 focus:text-blue-500"
                              >
                                {downloadingCompanyId === company.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <FileDown className="h-4 w-4 mr-2" />
                                )}
                                Download Data (CSV)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(company)}
                                className={company.is_active ? 'text-destructive' : 'text-green-500'}
                              >
                                {company.is_active ? (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No companies found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discount Codes Tab */}
          <TabsContent value="discounts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Discount Codes</CardTitle>
                    <CardDescription>Manage promotional discount codes</CardDescription>
                  </div>
                  <Button onClick={() => {
                    setNewDiscountCode(generateRandomCode('DISC'));
                    setCreateDiscountOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Code
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discountCodes.map((code) => (
                      <TableRow key={code.code}>
                        <TableCell>
                          <code className="font-bold bg-muted px-2 py-1 rounded">
                            {code.code}
                          </code>
                        </TableCell>
                        <TableCell className="font-medium">{code.discount_percentage}%</TableCell>
                        <TableCell>
                          {code.uses_count} / {code.total_uses}
                        </TableCell>
                        <TableCell>
                          {code.valid_until ? new Date(code.valid_until).toLocaleDateString() : 'No expiry'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={code.active ? 'default' : 'secondary'}>
                            {code.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleDiscount(code.code, code.active)}
                              disabled={processing}
                            >
                              {code.active ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDeleteDiscount(code.code)}
                              disabled={processing}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {discountCodes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No discount codes created yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gift Cards Tab */}
          <TabsContent value="giftcards">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gift Cards</CardTitle>
                    <CardDescription>Manage gift cards for wallet credits</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      setNewGiftAmount('1000');
                      setBulkGiftCount('10');
                      setBulkGiftOpen(true);
                    }}>
                      <Download className="h-4 w-4 mr-2" />
                      Bulk Create
                    </Button>
                    <Button onClick={() => {
                      setNewGiftCode(generateRandomCode('GC'));
                      setCreateGiftOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Card
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {giftCards.map((card) => (
                      <TableRow key={card.code}>
                        <TableCell>
                          <code className="font-bold bg-muted px-2 py-1 rounded">
                            {card.code}
                          </code>
                        </TableCell>
                        <TableCell className="font-medium">₹{card.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              card.is_redeemed ? 'secondary' :
                                !card.active ? 'destructive' :
                                  'default'
                            }
                            className={
                              card.is_redeemed ? '' :
                                !card.active ? '' :
                                  'bg-green-500/20 text-green-500'
                            }
                          >
                            {card.is_redeemed ? 'Redeemed' : card.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {card.expires_at ? new Date(card.expires_at).toLocaleDateString() : 'No expiry'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(card.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {!card.is_redeemed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDeleteGiftCard(card.code)}
                              disabled={processing}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {giftCards.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No gift cards created yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <AnnouncementsTab />
          </TabsContent>
        </Tabs>

        {/* Company Users Panel */}
        <CompanyUsersPanel
          company={userMgmtCompany}
          onClose={() => setUserMgmtCompany(null)}
          onCompanyDeleted={fetchAllData}
        />

        {/* Add Credits Dialog */}
        <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Wallet Credits</DialogTitle>
              <DialogDescription>
                Add credits to {selectedCompany?.name}'s wallet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="Admin credit adjustment"
                  value={creditsDescription}
                  onChange={(e) => setCreditsDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddCreditsOpen(false)}>Cancel</Button>
              <Button onClick={handleAddCredits} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add ₹{creditsAmount}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Licenses Dialog */}
        <Dialog open={addLicensesOpen} onOpenChange={setAddLicensesOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Licenses</DialogTitle>
              <DialogDescription>
                Add licenses to {selectedCompany?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Number of Licenses</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={licensesToAdd}
                  onChange={(e) => setLicensesToAdd(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddLicensesOpen(false)}>Cancel</Button>
              <Button onClick={handleAddLicenses} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add {licensesToAdd} License{licensesToAdd > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog open={editSubOpen} onOpenChange={setEditSubOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Subscription</DialogTitle>
              <DialogDescription>
                Update subscription for {selectedCompany?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newSubStatus} onValueChange={setNewSubStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={newSubDate}
                  onChange={(e) => setNewSubDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSubOpen(false)}>Cancel</Button>
              <Button onClick={handleEditSubscription} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Discount Dialog */}
        <Dialog open={createDiscountOpen} onOpenChange={setCreateDiscountOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Discount Code</DialogTitle>
              <DialogDescription>
                Create a new promotional discount code
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={newDiscountCode}
                  onChange={(e) => setNewDiscountCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={newDiscountPercentage}
                    onChange={(e) => setNewDiscountPercentage(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Uses</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newDiscountUses}
                    onChange={(e) => setNewDiscountUses(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valid Until (optional)</Label>
                <Input
                  type="date"
                  value={newDiscountExpiry}
                  onChange={(e) => setNewDiscountExpiry(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDiscountOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateDiscount} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Gift Card Dialog */}
        <Dialog open={createGiftOpen} onOpenChange={setCreateGiftOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Gift Card</DialogTitle>
              <DialogDescription>
                Create a new gift card for wallet credits
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={newGiftCode}
                  onChange={(e) => setNewGiftCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  value={newGiftAmount}
                  onChange={(e) => setNewGiftAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Expires At (optional)</Label>
                <Input
                  type="date"
                  value={newGiftExpiry}
                  onChange={(e) => setNewGiftExpiry(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateGiftOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateGiftCard} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Gift Cards Dialog */}
        <Dialog open={bulkGiftOpen} onOpenChange={setBulkGiftOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Create Gift Cards</DialogTitle>
              <DialogDescription>
                Generate multiple gift cards at once (CSV will be downloaded)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newGiftAmount}
                    onChange={(e) => setNewGiftAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Count</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={bulkGiftCount}
                    onChange={(e) => setBulkGiftCount(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expires At (optional)</Label>
                <Input
                  type="date"
                  value={newGiftExpiry}
                  onChange={(e) => setNewGiftExpiry(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkGiftOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkGiftCards} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create {bulkGiftCount} Cards
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Company Details Dialog */}
        <Dialog open={companyDetailsOpen} onOpenChange={setCompanyDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{companyDetails?.company?.name}</DialogTitle>
              <DialogDescription>
                Detailed view of company information
              </DialogDescription>
            </DialogHeader>
            {companyDetails && (
              <div className="space-y-6 pt-4">
                {/* Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Wallet</div>
                      <div className="text-xl font-bold">₹{companyDetails.wallet?.balance?.toLocaleString() || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Licenses</div>
                      <div className="text-xl font-bold">
                        {companyDetails.company?.used_licenses}/{companyDetails.company?.total_licenses}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Leads</div>
                      <div className="text-xl font-bold">{companyDetails.leads_count || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Team</div>
                      <div className="text-xl font-bold">{companyDetails.team_members?.length || 0}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Products */}
                <div>
                  <h4 className="font-semibold mb-2">Products ({companyDetails.products?.length || 0})</h4>
                  {companyDetails.products?.length > 0 ? (
                    <div className="space-y-2">
                      {companyDetails.products.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-muted rounded">
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <Badge variant="outline" className="ml-2">{p.category}</Badge>
                          </div>
                          <span>₹{p.price}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No products</p>
                  )}
                </div>

                {/* Team Members */}
                <div>
                  <h4 className="font-semibold mb-2">Team Members ({companyDetails.team_members?.length || 0})</h4>
                  {companyDetails.team_members?.length > 0 ? (
                    <div className="space-y-2">
                      {companyDetails.team_members.map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-muted rounded">
                          <span className="font-medium">{m.full_name || 'Unnamed'}</span>
                          <span className="text-muted-foreground text-sm">{m.email}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No team members</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
