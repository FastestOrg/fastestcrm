import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Loader2, Save, Package, Wand2, Edit, ArrowRightCircle, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuotations, QuotationItem, Quotation } from '@/hooks/useQuotations';
import { SendDocumentDialog } from '@/components/financial/SendDocumentDialog';
import { DocumentView } from '@/components/financial/DocumentView';

import { useInvoiceTaxes } from '@/hooks/useInvoiceSettings';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useLeads } from '@/hooks/useLeads';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useDebounce } from '@/hooks/useDebounce';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'SGD', 'AUD', 'CAD', 'JPY'];

export default function QuotationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { company } = useCompany();
  const { createQuotation, updateQuotation, fetchQuotationWithItems } = useQuotations();
  const { taxes } = useInvoiceTaxes();
  const { products } = useProducts();

  const isEditing = !!id;
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [subject, setSubject] = useState('');
  const [currency, setCurrency] = useState(company?.default_currency || 'INR');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage' | ''>('');
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadTable, setLeadTable] = useState<string | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [openLeadSelector, setOpenLeadSelector] = useState(false);
  const [status, setStatus] = useState<'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'>('draft');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  
  const debouncedSearch = useDebounce(leadSearch, 300);
  const { tableName } = useLeadsTable();
  const { data: leadsData } = useLeads({ search: debouncedSearch, pageSize: 5 });
  const leads = leadsData?.leads || [];

  // AI Suggestion Logic
  const suggestAIItems = async () => {
    if (!clientName && !subject) {
      toast({ title: 'Context Needed', description: 'Please enter a Client Name or Subject to give AI some context.', variant: 'destructive' });
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke('ai-closing-orchestrator', {
        body: { 
          transcript: `Generate a quotation for ${clientName}. Subject: ${subject}. Target Industry: ${company?.industry}. Use these products if possible: ${products?.map(p => p.name).join(', ')}`,
          companyId: company?.id,
          mode: 'quotation_suggestion'
        }
      });

      if (error) throw error;
      
      const suggestedItems: QuotationItem[] = [];
      const aiItems = data.result?.line_items || [];
      
      aiItems.forEach((aiItem: any, idx: number) => {
          // Find closest product match
          const matchedProduct = products?.find(p => aiItem.description.toLowerCase().includes(p.name.toLowerCase()));
          
          suggestedItems.push({
              product_id: matchedProduct?.id || null,
              description: aiItem.description,
              hsn_sac_code: null,
              quantity: aiItem.quantity || 1,
              unit_price: aiItem.unit_price || (matchedProduct?.price || 0),
              discount_percentage: 0,
              tax_ids: taxes.filter(t => t.is_default).map(t => t.id),
              tax_amount: 0,
              line_total: 0,
              sort_order: items.length + idx
          });
      });

      if (suggestedItems.length > 0) {
          setItems([...items, ...suggestedItems]);
          toast({ title: 'AI Suggestions Added', description: 'Based on your context, we added some initial line items.' });
      } else {
          toast({ title: 'AI Recommendation', description: data.result?.summary_battlecard || "No specific items found." });
      }

    } catch (err: any) {
      console.error('AI Quote Error:', err);
      toast({ title: 'AI Suggestion Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Edit Item Modal State
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<QuotationItem | null>(null);

  const openEditModal = (idx: number) => {
    setEditingItemIdx(idx);
    setEditingItem({ ...items[idx] });
  };

  const saveEditedItem = () => {
    if (editingItemIdx !== null && editingItem) {
      const updated = [...items];
      updated[editingItemIdx] = editingItem;
      setItems(updated);
      setEditingItemIdx(null);
      setEditingItem(null);
    }
  };

  // Load existing quotation
  useEffect(() => {
    if (isEditing) {
      fetchQuotationWithItems(id!).then((data) => {
        setClientName(data.client_name);
        setClientEmail(data.client_email || '');
        setClientPhone(data.client_phone || '');
        setClientAddress(data.client_address || '');
        setClientGstin(data.client_gstin || '');
        setSubject(data.subject || '');
        setCurrency(data.currency || 'INR');
        setDiscountType(data.discount_type || '');
        setDiscountValue(data.discount_value || 0);
        setNotes(data.notes || '');
        setTermsAndConditions(data.terms_and_conditions || '');
        setValidUntil(data.valid_until || '');
        setItems(data.items || []);
        setLeadId(data.lead_id || null);
        setLeadTable(data.lead_table || null);
        setStatus(data.status || 'draft');
        setLoading(false);
      }).catch(() => {
        toast({ title: 'Error', description: 'Quotation not found.', variant: 'destructive' });
        navigate('/dashboard/quotations');
      });
    }
  }, [id]);

  // Sync default currency from company when loading new document
  useEffect(() => {
    if (!isEditing && company?.default_currency && currency === 'INR' && !items.length) {
      setCurrency(company.default_currency);
    }
  }, [company?.default_currency, isEditing]);

  // Add empty item
  const addItem = () => {
    setItems([...items, {
      product_id: null,
      description: '',
      hsn_sac_code: null,
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      tax_ids: [],
      tax_amount: 0,
      line_total: 0,
      sort_order: items.length,
    }]);
  };

  // Add from product catalog
  const addFromProduct = (productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (!product) return;

    const defaultTaxIds = taxes.filter((t) => t.is_default && t.is_active).map((t) => t.id);
    setItems([...items, {
      product_id: product.id,
      description: `${product.category} — ${product.name}`,
      hsn_sac_code: null,
      quantity: 1,
      unit_price: product.price,
      discount_percentage: 0,
      tax_ids: defaultTaxIds,
      tax_amount: 0,
      line_total: 0,
      sort_order: items.length,
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  // Computed totals
  const computedItems = items.map((item) => {
    const base = item.quantity * item.unit_price;
    const discountAmt = base * (item.discount_percentage / 100);
    const afterDiscount = base - discountAmt;

    const taxRate = item.tax_ids.reduce((sum, tid) => {
      const tax = taxes.find((t) => t.id === tid);
      return sum + (tax?.rate || 0);
    }, 0);

    const taxAmt = afterDiscount * (taxRate / 100);
    const lineTotal = afterDiscount + taxAmt;

    return { ...item, tax_amount: Math.round(taxAmt * 100) / 100, line_total: Math.round(lineTotal * 100) / 100 };
  });

  const subtotal = computedItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const itemDiscountTotal = computedItems.reduce((s, i) => s + (i.quantity * i.unit_price * i.discount_percentage / 100), 0);
  const totalTax = computedItems.reduce((s, i) => s + i.tax_amount, 0);

  let docDiscountAmount = 0;
  if (discountType === 'flat') docDiscountAmount = discountValue;
  else if (discountType === 'percentage') docDiscountAmount = (subtotal - itemDiscountTotal) * (discountValue / 100);

  const grandTotal = subtotal - itemDiscountTotal - docDiscountAmount + totalTax;

  const handleSave = async (asDraft = true) => {
    if (!clientName.trim()) {
      toast({ title: 'Error', description: 'Client name is required.', variant: 'destructive' });
      return;
    }
    if (computedItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one item.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        client_name: clientName.trim(),
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        client_address: clientAddress || null,
        client_gstin: clientGstin || null,
        subject: subject || null,
        subtotal: Math.round(subtotal * 100) / 100,
        discount_type: discountType || null,
        discount_value: discountValue,
        discount_amount: Math.round(docDiscountAmount * 100) / 100,
        tax_amount: Math.round(totalTax * 100) / 100,
        total: Math.round(grandTotal * 100) / 100,
        currency,
        notes: notes || null,
        terms_and_conditions: termsAndConditions || null,
        valid_until: validUntil || null,
        status: status === 'draft' && !asDraft ? 'sent' : (asDraft && status === 'draft' ? 'draft' : status),
        lead_id: leadId,
        lead_table: leadTable,
        items: computedItems,
      };

      const res = isEditing 
        ? await updateQuotation.mutateAsync({ id: id!, ...payload })
        : await createQuotation.mutateAsync(payload);
        
      if (status === 'accepted') {
        toast({
          title: 'Quotation Accepted!',
          description: 'Would you like to create an invoice now?',
          action: (
            <Button size="sm" onClick={() => navigate(`/dashboard/invoices/new?from_quotation=${id || (res as any).id}`)}>
              Create Invoice
            </Button>
          ),
        });
      } else {
        navigate('/dashboard/quotations');
      }
    } catch {
      // error handled in hook
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border px-6 md:px-8 py-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quotations')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                {isEditing ? 'Edit Quotation' : 'New Quotation'}
              </h1>
              <p className="text-muted-foreground text-sm">Fill in the details below.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex bg-muted p-1 rounded-lg mr-2">
              <Button 
                variant={viewMode === 'edit' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8 px-4"
                onClick={() => setViewMode('edit')}
              >
                Edit
              </Button>
              <Button 
                variant={viewMode === 'preview' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8 px-4"
                onClick={() => setViewMode('preview')}
              >
                Preview
              </Button>
            </div>
            {isEditing && (
              <Button variant="outline" onClick={() => setSendDialogOpen(true)}>
                <Mail className="h-4 w-4 mr-2" /> Send via Email
              </Button>
            )}
            {isEditing && status === 'accepted' && (
              <Button 
                variant="outline" 
                onClick={() => navigate(`/dashboard/invoices/new?from_quotation=${id}`)}
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                <ArrowRightCircle className="h-4 w-4 mr-2" /> Convert to Invoice
              </Button>
            )}
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" /> Save Draft
            </Button>
            <Button onClick={() => handleSave(false)} disabled={saving} className="gradient-primary">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save & Send
            </Button>
          </div>
        </div>
      </header>

      {viewMode === 'edit' && (
      <div className="p-4 md:p-8 space-y-6">
        {/* Client Details */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Client Details</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden md:inline">Select from CRM:</span>
                <Popover open={openLeadSelector} onOpenChange={setOpenLeadSelector}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openLeadSelector}
                      className="w-[250px] justify-between h-9 text-xs"
                    >
                      {leadId 
                        ? leads.find((l) => l.id === leadId)?.name || clientName || "Select lead..."
                        : "Search CRM Leads..."}
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 glass">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search by name, email, phone..." 
                        value={leadSearch}
                        onValueChange={setLeadSearch}
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No leads found.</CommandEmpty>
                        <CommandGroup>
                          {leads.map((lead) => (
                            <CommandItem
                              key={lead.id}
                              value={lead.id}
                              onSelect={() => {
                                setClientName(lead.name);
                                setClientEmail(lead.email || '');
                                setClientPhone(lead.phone || '');
                                setClientAddress(lead.college || lead.state || ''); // Fallback for address
                                setLeadId(lead.id);
                                setLeadTable(tableName);
                                setOpenLeadSelector(false);
                                toast({ 
                                  title: 'Lead Selected', 
                                  description: `Client details populated for ${lead.name}`,
                                  className: 'bg-primary/20 border-primary/20'
                                });
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  leadId === lead.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{lead.name}</span>
                                <span className="text-[10px] text-muted-foreground">{lead.email || lead.phone || 'No contact info'}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client / Company Name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Full address" />
              </div>
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input value={clientGstin} onChange={(e) => setClientGstin(e.target.value)} placeholder="Client GSTIN" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quotation Meta */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Quotation Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Subject / Title</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Website Development Proposal" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="converted" disabled>Converted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Line Items</CardTitle>
              <div className="flex gap-2">
                {products && products.length > 0 && (
                  <Select onValueChange={addFromProduct}>
                    <SelectTrigger className="w-[200px]">
                      <Package className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Add from catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — ₹{p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button 
                  variant="outline" 
                  onClick={suggestAIItems} 
                  disabled={isGeneratingAI}
                  className="shadow-inner hover:bg-primary/10 transition-colors border-primary/20"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2 text-primary" />
                  )}
                  AI Suggest
                </Button>
                <Button variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {computedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No items added yet. Add items from the catalog or manually.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[250px]">Description</TableHead>
                      <TableHead className="w-[80px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Unit Price</TableHead>
                      <TableHead className="w-[80px]">Disc %</TableHead>
                      <TableHead className="w-[160px]">Tax</TableHead>
                      <TableHead className="w-[100px]">Tax Amt</TableHead>
                      <TableHead className="w-[120px]">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computedItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            placeholder="Item description"
                            className="border-0 bg-transparent px-0 focus-visible:ring-0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="border-0 bg-transparent px-0 focus-visible:ring-0 w-16"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="border-0 bg-transparent px-0 focus-visible:ring-0 w-24"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.discount_percentage}
                            onChange={(e) => updateItem(idx, 'discount_percentage', parseFloat(e.target.value) || 0)}
                            className="border-0 bg-transparent px-0 focus-visible:ring-0 w-16"
                            min="0"
                            max="100"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {taxes.filter((t) => t.is_active).map((tax) => (
                              <Badge
                                key={tax.id}
                                variant={item.tax_ids.includes(tax.id) ? 'default' : 'outline'}
                                className="cursor-pointer text-xs"
                                onClick={() => {
                                  const newIds = item.tax_ids.includes(tax.id)
                                    ? item.tax_ids.filter((tid) => tid !== tax.id)
                                    : [...item.tax_ids, tax.id];
                                  updateItem(idx, 'tax_ids', newIds);
                                }}
                              >
                                {tax.name} {tax.rate}%
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{currency} {item.tax_amount.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">{currency} {item.line_total.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(idx)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Summary */}
            {computedItems.length > 0 && (
              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-sm space-y-3 p-4 rounded-xl bg-card/50 border border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{currency} {subtotal.toLocaleString()}</span>
                  </div>
                  {itemDiscountTotal > 0 && (
                    <div className="flex justify-between text-sm text-amber-400">
                      <span>Item Discounts</span>
                      <span>-{currency} {itemDiscountTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Select value={discountType || 'none'} onValueChange={(v) => setDiscountType(v === 'none' ? '' : v as any)}>
                      <SelectTrigger className="w-[130px] text-xs h-8">
                        <SelectValue placeholder="Discount" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                    {discountType && (
                      <Input
                        type="number"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        className="w-24 h-8 text-sm"
                        min="0"
                      />
                    )}
                    {docDiscountAmount > 0 && (
                      <span className="text-amber-400 text-sm ml-auto">-{currency} {docDiscountAmount.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{currency} {totalTax.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{currency} {Math.round(grandTotal * 100 / 100).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes & Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes for the client..." rows={4} />
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader><CardTitle className="text-lg">Terms & Conditions</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} placeholder="Payment terms, delivery terms, etc." rows={4} />
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {viewMode === 'preview' && (
          <div className="p-4 md:p-8 max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-border relative">
                  <DocumentView 
                    type="quotation" 
                    document={{
                        status,
                        quotation_number: isEditing ? (id ? "Loading..." : "QUO-NEW") : "QUO-NEW",
                        currency,
                        subtotal,
                        discount_amount: docDiscountAmount,
                        tax_amount: totalTax,
                        total: grandTotal,
                        client_name: clientName,
                        client_email: clientEmail,
                        client_phone: clientPhone,
                        client_address: clientAddress,
                        client_gstin: clientGstin,
                        notes,
                        terms_and_conditions: termsAndConditions,
                        valid_until: validUntil,
                        issued_at: new Date().toISOString()
                    }}
                    items={computedItems}
                    company={{
                        name: company?.name || 'FastestCRM',
                        logo_url: company?.logo_url || null,
                        primary_color: company?.primary_color || '#3b82f6',
                        address: company?.address || null,
                        email: company?.email || null,
                        phone: company?.phone || null,
                        gstin: null
                    }}
                  />
              </div>
          </div>
      )}

      {isEditing && (
          <SendDocumentDialog 
            open={sendDialogOpen}
            onOpenChange={setSendDialogOpen}
            document={{
                id: id!,
                client_name: clientName,
                client_email: clientEmail,
                lead_id: leadId,
                lead_table: leadTable,
                quotation_number: "Preview" // Will be fetched properly by the component if needed, or we just pass the object
            } as any}
            type="quotation"
            onSuccess={() => {
                // If it was draft, maybe update to sent
                if (status === 'draft') {
                    // We could trigger updateStatus mutation here
                }
            }}
          />
      )}

      <Dialog open={editingItemIdx !== null} onOpenChange={(open) => !open && setEditingItemIdx(null)}>
        <DialogContent className="sm:max-w-[500px] glass">
          <DialogHeader>
            <DialogTitle>Edit Line Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={editingItem.description} 
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="Item description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input 
                    type="number" 
                    value={editingItem.quantity} 
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input 
                    type="number" 
                    value={editingItem.unit_price} 
                    onChange={(e) => setEditingItem({ ...editingItem, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input 
                    type="number" 
                    value={editingItem.discount_percentage} 
                    onChange={(e) => setEditingItem({ ...editingItem, discount_percentage: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>HSN/SAC Code</Label>
                  <Input 
                    value={editingItem.hsn_sac_code || ''} 
                    onChange={(e) => setEditingItem({ ...editingItem, hsn_sac_code: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tax applied</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {taxes.filter((t) => t.is_active).map((tax) => (
                    <Badge
                      key={tax.id}
                      variant={editingItem.tax_ids.includes(tax.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const newIds = editingItem.tax_ids.includes(tax.id)
                          ? editingItem.tax_ids.filter((tid) => tid !== tax.id)
                          : [...editingItem.tax_ids, tax.id];
                        setEditingItem({ ...editingItem, tax_ids: newIds });
                      }}
                    >
                      {tax.name} {tax.rate}%
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItemIdx(null)}>Cancel</Button>
            <Button onClick={saveEditedItem} className="gradient-primary">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
