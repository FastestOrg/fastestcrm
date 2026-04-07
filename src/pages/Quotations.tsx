import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileText, Plus, Search, MoreHorizontal, Eye, Pencil, Copy, ArrowRightCircle, Trash2, Loader2, Send, Download, Filter } from 'lucide-react';
import { useQuotations } from '@/hooks/useQuotations';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  sent: { label: 'Sent', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  accepted: { label: 'Accepted', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  expired: { label: 'Expired', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  converted: { label: 'Converted', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
};

export default function Quotations() {
  const navigate = useNavigate();
  const { quotations, isLoading, deleteQuotation, updateStatus } = useQuotations();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = quotations.filter((q) => {
    const matchesSearch = !search ||
      q.client_name.toLowerCase().includes(search.toLowerCase()) ||
      q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
      q.subject?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = [
    { label: 'Total', value: quotations.length, color: 'text-foreground' },
    { label: 'Draft', value: quotations.filter((q) => q.status === 'draft').length, color: 'text-slate-400' },
    { label: 'Sent', value: quotations.filter((q) => q.status === 'sent').length, color: 'text-blue-400' },
    { label: 'Accepted', value: quotations.filter((q) => q.status === 'accepted').length, color: 'text-emerald-400' },
    { label: 'Total Value', value: `₹${quotations.reduce((s, q) => s + q.total, 0).toLocaleString()}`, color: 'text-primary', isAmount: true },
  ];

  return (
    <>
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border px-6 md:px-8 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>Quotations</h1>
            <p className="text-muted-foreground text-sm">Create and manage quotations for your leads.</p>
          </div>
          <Button onClick={() => navigate('/dashboard/quotations/new')} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" /> New Quotation
          </Button>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="glass card-hover">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`} style={{ fontFamily: "'Syne', sans-serif" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by client, number, or subject..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="glass">
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-semibold mb-1">No Quotations Found</p>
                <p className="text-sm">Create your first quotation to start sending proposals.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-primary/5" onClick={() => navigate(`/dashboard/quotations/${q.id}`)}>
                      <TableCell className="font-mono font-semibold text-primary">{q.quotation_number}</TableCell>
                      <TableCell className="font-medium">{q.client_name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{q.subject || '—'}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[q.status]?.color || ''} variant="outline">
                          {statusConfig[q.status]?.label || q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{q.currency} {q.total.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {q.valid_until ? format(new Date(q.valid_until), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(q.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/dashboard/quotations/${q.id}`)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            {q.status === 'draft' && (
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: q.id, status: 'sent' })}>
                                <Send className="h-4 w-4 mr-2" /> Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {q.status === 'sent' && (
                              <>
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: q.id, status: 'accepted' })}>
                                  <ArrowRightCircle className="h-4 w-4 mr-2" /> Accept
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ id: q.id, status: 'rejected' })}>
                                  <ArrowRightCircle className="h-4 w-4 mr-2" /> Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {(q.status === 'accepted' || q.status === 'sent') && !q.converted_to_invoice_id && (
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/invoices/new?from_quotation=${q.id}`)}>
                                <ArrowRightCircle className="h-4 w-4 mr-2" /> Convert to Invoice
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete this quotation?')) deleteQuotation.mutate(q.id); }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
