import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Percent, Palette, Hash, Settings2, Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import { useInvoiceSettings, useInvoiceTaxes, useInvoiceTemplates, InvoiceTax, InvoiceTemplate } from '@/hooks/useInvoiceSettings';
import { useToast } from '@/hooks/use-toast';

export default function InvoiceSettings() {
  const { settings, settingsLoading, upsertSettings } = useInvoiceSettings();
  const { taxes, taxesLoading, createTax, updateTax, deleteTax } = useInvoiceTaxes();
  const { templates, templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useInvoiceTemplates();
  const { toast } = useToast();

  // ─── Business Profile State ──────
  const [bizName, setBizName] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizGstin, setBizGstin] = useState('');
  const [bizPan, setBizPan] = useState('');
  const [bankBank, setBankBank] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankUpi, setBankUpi] = useState('');
  const [defaultPayTerms, setDefaultPayTerms] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [invPrefix, setInvPrefix] = useState('INV-');
  const [quoPrefix, setQuoPrefix] = useState('QUO-');
  const [nextInvNum, setNextInvNum] = useState(1);
  const [nextQuoNum, setNextQuoNum] = useState(1);
  const [bizInitialized, setBizInitialized] = useState(false);

  // Initialize from loaded settings
  if (settings && !bizInitialized) {
    setBizName(settings.business_name || '');
    setBizAddress(settings.business_address || '');
    setBizEmail(settings.business_email || '');
    setBizPhone(settings.business_phone || '');
    setBizGstin(settings.business_gstin || '');
    setBizPan(settings.business_pan || '');
    setBankBank(settings.bank_details?.bank || '');
    setBankAccount(settings.bank_details?.account || '');
    setBankIfsc(settings.bank_details?.ifsc || '');
    setBankUpi(settings.bank_details?.upi || '');
    setDefaultPayTerms(settings.default_payment_terms || '');
    setDefaultNotes(settings.default_notes || '');
    setInvPrefix(settings.invoice_prefix || 'INV-');
    setQuoPrefix(settings.quotation_prefix || 'QUO-');
    setNextInvNum(settings.next_invoice_number || 1);
    setNextQuoNum(settings.next_quotation_number || 1);
    setBizInitialized(true);
  }

  const handleSaveProfile = () => {
    upsertSettings.mutate({
      business_name: bizName || null,
      business_address: bizAddress || null,
      business_email: bizEmail || null,
      business_phone: bizPhone || null,
      business_gstin: bizGstin || null,
      business_pan: bizPan || null,
      bank_details: { bank: bankBank, account: bankAccount, ifsc: bankIfsc, upi: bankUpi },
      default_payment_terms: defaultPayTerms || null,
      default_notes: defaultNotes || null,
      invoice_prefix: invPrefix,
      quotation_prefix: quoPrefix,
      next_invoice_number: nextInvNum,
      next_quotation_number: nextQuoNum,
    });
  };

  // ─── Tax Dialog ──────
  const [taxDialog, setTaxDialog] = useState(false);
  const [editingTax, setEditingTax] = useState<InvoiceTax | null>(null);
  const [taxName, setTaxName] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [taxDefault, setTaxDefault] = useState(false);

  const openTaxDialog = (tax?: InvoiceTax) => {
    if (tax) {
      setEditingTax(tax);
      setTaxName(tax.name);
      setTaxRate(tax.rate.toString());
      setTaxDefault(tax.is_default);
    } else {
      setEditingTax(null);
      setTaxName('');
      setTaxRate('');
      setTaxDefault(false);
    }
    setTaxDialog(true);
  };

  const saveTax = () => {
    if (!taxName.trim() || !taxRate) {
      toast({ title: 'Error', description: 'Name and Rate are required.', variant: 'destructive' });
      return;
    }
    const payload = { name: taxName.trim(), rate: parseFloat(taxRate), is_default: taxDefault };
    if (editingTax) {
      updateTax.mutate({ id: editingTax.id, ...payload });
    } else {
      createTax.mutate(payload);
    }
    setTaxDialog(false);
  };

  // ─── Template Dialog ──────
  const [tplDialog, setTplDialog] = useState(false);
  const [editingTpl, setEditingTpl] = useState<InvoiceTemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplType, setTplType] = useState<'both' | 'quotation' | 'invoice'>('both');
  const [tplPrimary, setTplPrimary] = useState('#6366f1');
  const [tplAccent, setTplAccent] = useState('#8b5cf6');
  const [tplShowLogo, setTplShowLogo] = useState(true);
  const [tplShowBank, setTplShowBank] = useState(true);

  const openTplDialog = (tpl?: InvoiceTemplate) => {
    if (tpl) {
      setEditingTpl(tpl);
      setTplName(tpl.name);
      setTplType(tpl.template_type);
      setTplPrimary(tpl.color_scheme?.primary || '#6366f1');
      setTplAccent(tpl.color_scheme?.accent || '#8b5cf6');
      setTplShowLogo(tpl.show_logo);
      setTplShowBank(tpl.show_bank_details);
    } else {
      setEditingTpl(null);
      setTplName('');
      setTplType('both');
      setTplPrimary('#6366f1');
      setTplAccent('#8b5cf6');
      setTplShowLogo(true);
      setTplShowBank(true);
    }
    setTplDialog(true);
  };

  const saveTpl = () => {
    if (!tplName.trim()) {
      toast({ title: 'Error', description: 'Template name is required.', variant: 'destructive' });
      return;
    }
    const payload = {
      name: tplName.trim(),
      template_type: tplType,
      color_scheme: { primary: tplPrimary, accent: tplAccent, text: '#1e293b' },
      show_logo: tplShowLogo,
      show_bank_details: tplShowBank,
    };
    if (editingTpl) {
      updateTemplate.mutate({ id: editingTpl.id, ...payload });
    } else {
      createTemplate.mutate(payload);
    }
    setTplDialog(false);
  };

  if (settingsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border px-6 md:px-8 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>Invoice Settings</h1>
            <p className="text-muted-foreground text-sm">Configure your business details, taxes, and templates.</p>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8">
        <Tabs defaultValue="business" className="space-y-6">
          <TabsList className="bg-card/50 backdrop-blur-sm border border-border/50 p-1">
            <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Building2 className="h-4 w-4" /> Business
            </TabsTrigger>
            <TabsTrigger value="taxes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Percent className="h-4 w-4" /> Taxes
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Palette className="h-4 w-4" /> Templates
            </TabsTrigger>
            <TabsTrigger value="numbering" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Hash className="h-4 w-4" /> Numbering
            </TabsTrigger>
            <TabsTrigger value="defaults" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Settings2 className="h-4 w-4" /> Defaults
            </TabsTrigger>
          </TabsList>

          {/* ═══ Business Profile ═══ */}
          <TabsContent value="business" className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>This appears on your quotations and invoices.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business / Legal Name</Label>
                    <Input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="e.g. Acme Corp Pvt Ltd" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} placeholder="billing@company.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="+91 98765 43210" />
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input value={bizGstin} onChange={(e) => setBizGstin(e.target.value)} placeholder="e.g. 29GGGGG1314R9Z6" />
                  </div>
                  <div className="space-y-2">
                    <Label>PAN</Label>
                    <Input value={bizPan} onChange={(e) => setBizPan(e.target.value)} placeholder="e.g. ABCDE1234F" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Full Address</Label>
                  <Textarea value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="123 Business Street, City, State - PIN" rows={3} />
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Bank Details</CardTitle>
                <CardDescription>Shown on invoices for payment reference.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input value={bankBank} onChange={(e) => setBankBank(e.target.value)} placeholder="e.g. HDFC Bank" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Account number" />
                  </div>
                  <div className="space-y-2">
                    <Label>IFSC Code</Label>
                    <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} placeholder="e.g. HDFC0001234" />
                  </div>
                  <div className="space-y-2">
                    <Label>UPI ID</Label>
                    <Input value={bankUpi} onChange={(e) => setBankUpi(e.target.value)} placeholder="e.g. business@upi" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={upsertSettings.isPending} className="gradient-primary px-8">
                {upsertSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" /> Save Business Profile
              </Button>
            </div>
          </TabsContent>

          {/* ═══ Taxes ═══ */}
          <TabsContent value="taxes" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Tax Configurations</h2>
                <p className="text-sm text-muted-foreground">Define taxes that can be applied to line items.</p>
              </div>
              <Button onClick={() => openTaxDialog()} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" /> Add Tax
              </Button>
            </div>

            <Card className="glass">
              <CardContent className="pt-6">
                {taxesLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : taxes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No taxes configured yet. Add your first tax.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxes.map((tax) => (
                        <TableRow key={tax.id}>
                          <TableCell className="font-medium">{tax.name}</TableCell>
                          <TableCell>{tax.rate}%</TableCell>
                          <TableCell>
                            {tax.is_default && <Badge className="bg-primary/20 text-primary border-primary/30">Default</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tax.is_active ? 'default' : 'secondary'}>
                              {tax.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openTaxDialog(tax)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => { if (confirm('Delete this tax?')) deleteTax.mutate(tax.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Dialog open={taxDialog} onOpenChange={setTaxDialog}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>{editingTax ? 'Edit Tax' : 'Add New Tax'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tax Name</Label>
                    <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="e.g. GST, IGST, SGST" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate (%)</Label>
                    <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="18" min="0" max="100" step="0.01" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={taxDefault} onCheckedChange={setTaxDefault} />
                    <Label>Apply by default to new items</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTaxDialog(false)}>Cancel</Button>
                  <Button onClick={saveTax}>Save Tax</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ═══ Templates ═══ */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Document Templates</h2>
                <p className="text-sm text-muted-foreground">Customize the appearance of your documents.</p>
              </div>
              <Button onClick={() => openTplDialog()} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" /> Add Template
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templatesLoading ? (
                <div className="col-span-full flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : templates.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates yet. A default style will be used.</p>
                </div>
              ) : (
                templates.map((tpl) => (
                  <Card key={tpl.id} className="glass card-hover overflow-hidden">
                    <div className="h-2" style={{ background: `linear-gradient(to right, ${tpl.color_scheme?.primary || '#6366f1'}, ${tpl.color_scheme?.accent || '#8b5cf6'})` }} />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{tpl.name}</h3>
                        {tpl.is_default && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Default</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{tpl.template_type}</Badge>
                        {tpl.show_logo && <Badge variant="outline" className="text-xs">Logo</Badge>}
                        {tpl.show_bank_details && <Badge variant="outline" className="text-xs">Bank</Badge>}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => openTplDialog(tpl)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm('Delete this template?')) deleteTemplate.mutate(tpl.id); }}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Dialog open={tplDialog} onOpenChange={setTplDialog}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingTpl ? 'Edit Template' : 'New Template'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Professional, Minimal" />
                  </div>
                  <div className="space-y-2">
                    <Label>Used For</Label>
                    <select className="w-full rounded-md border-input bg-background p-2 text-sm border" value={tplType} onChange={(e) => setTplType(e.target.value as any)}>
                      <option value="both">Both</option>
                      <option value="quotation">Quotation Only</option>
                      <option value="invoice">Invoice Only</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={tplPrimary} onChange={(e) => setTplPrimary(e.target.value)} className="w-10 h-10 border rounded cursor-pointer" />
                        <Input value={tplPrimary} onChange={(e) => setTplPrimary(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Accent Color</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={tplAccent} onChange={(e) => setTplAccent(e.target.value)} className="w-10 h-10 border rounded cursor-pointer" />
                        <Input value={tplAccent} onChange={(e) => setTplAccent(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch checked={tplShowLogo} onCheckedChange={setTplShowLogo} />
                      <Label>Show Logo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch checked={tplShowBank} onCheckedChange={setTplShowBank} />
                      <Label>Show Bank Details</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTplDialog(false)}>Cancel</Button>
                  <Button onClick={saveTpl}>Save Template</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ═══ Numbering ═══ */}
          <TabsContent value="numbering" className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Invoice Numbering</CardTitle>
                <CardDescription>Customize the prefix and starting number for your documents.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/50">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Invoice Numbers</h3>
                    <div className="space-y-2">
                      <Label>Prefix</Label>
                      <Input value={invPrefix} onChange={(e) => setInvPrefix(e.target.value)} placeholder="INV-" />
                    </div>
                    <div className="space-y-2">
                      <Label>Next Number</Label>
                      <Input type="number" value={nextInvNum} onChange={(e) => setNextInvNum(parseInt(e.target.value) || 1)} min="1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Preview: <span className="font-mono font-semibold text-primary">{invPrefix}{String(nextInvNum).padStart(4, '0')}</span></p>
                  </div>
                  <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/50">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Quotation Numbers</h3>
                    <div className="space-y-2">
                      <Label>Prefix</Label>
                      <Input value={quoPrefix} onChange={(e) => setQuoPrefix(e.target.value)} placeholder="QUO-" />
                    </div>
                    <div className="space-y-2">
                      <Label>Next Number</Label>
                      <Input type="number" value={nextQuoNum} onChange={(e) => setNextQuoNum(parseInt(e.target.value) || 1)} min="1" />
                    </div>
                    <p className="text-xs text-muted-foreground">Preview: <span className="font-mono font-semibold text-primary">{quoPrefix}{String(nextQuoNum).padStart(4, '0')}</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={upsertSettings.isPending} className="gradient-primary px-8">
                {upsertSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" /> Save Numbering
              </Button>
            </div>
          </TabsContent>

          {/* ═══ Defaults ═══ */}
          <TabsContent value="defaults" className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Default Values</CardTitle>
                <CardDescription>Pre-fill these values when creating new documents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Payment Terms</Label>
                  <Input value={defaultPayTerms} onChange={(e) => setDefaultPayTerms(e.target.value)} placeholder="e.g. Net 30, Due on Receipt" />
                </div>
                <div className="space-y-2">
                  <Label>Default Thank-You / Notes</Label>
                  <Textarea value={defaultNotes} onChange={(e) => setDefaultNotes(e.target.value)} placeholder="e.g. Thank you for your business!" rows={4} />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={upsertSettings.isPending} className="gradient-primary px-8">
                {upsertSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" /> Save Defaults
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
