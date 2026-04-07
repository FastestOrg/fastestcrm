import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Receipt, Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Send, DollarSign, Filter, AlertTriangle, TrendingUp, CreditCard } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  sent: { label: 'Sent', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  partially_paid: { label: 'Partial', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  paid: { label: 'Paid', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  overdue: { label: 'Overdue', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  refunded: { label: 'Refunded', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

export default function Invoices() {
  const navigate = useNavigate();
  const { invoices, isLoading, deleteInvoice } = useInvoices();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = invoices.filter((inv) => {
    const matchesSearch = !search ||
      inv.client_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.subject?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalReceived = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.amount_due, 0);
  const overdueCount = invoices.filter((i) => i.status === 'overdue' || (i.due_date && new Date(i.due_date) < new Date() && i.status === 'sent')).length;

  const stats = [
    { label: 'Total Invoiced', value: `₹${totalInvoiced.toLocaleString()}`, icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Received', value: `₹${totalReceived.toLocaleString()}`, icon: CreditCard, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { label: 'Outstanding', value: `₹${totalOutstanding.toLocaleString()}`, icon: DollarSign, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { label: 'Overdue', value: overdueCount.toString(), icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/10' },
  ];

  return (
    <>
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border px-6 md:px-8 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>Invoices</h1>
            <p className="text-muted-foreground text-sm">Create, manage, and track payment for invoices.</p>
          </div>
          <Button onClick={() => navigate('/dashboard/invoices/new')} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" /> New Invoice
          </Button>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="glass card-hover border-l-2" style={{ borderLeftColor: stat.color.replace('text-', '').includes('primary') ? 'hsl(var(--primary))' : undefined }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${stat.color}`} style={{ fontFamily: "'Syne', sans-serif" }}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
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
                <Receipt className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-semibold mb-1">No Invoices Found</p>
                <p className="text-sm">Create your first invoice to track payments.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled';
                    return (
                      <TableRow
                        key={inv.id}
                        className={`cursor-pointer hover:bg-primary/5 ${isOverdue ? 'bg-red-500/5' : ''}`}
                        onClick={() => navigate(`/dashboard/invoices/${inv.id}`)}
                      >
                        <TableCell className="font-mono font-semibold text-primary">{inv.invoice_number}</TableCell>
                        <TableCell className="font-medium">{inv.client_name}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig[isOverdue && inv.status === 'sent' ? 'overdue' : inv.status]?.color || ''} variant="outline">
                            {isOverdue && inv.status === 'sent' ? 'Overdue' : statusConfig[inv.status]?.label || inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{inv.currency} {inv.total.toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-400">{inv.currency} {inv.amount_paid.toLocaleString()}</TableCell>
                        <TableCell className={inv.amount_due > 0 ? 'text-amber-400 font-semibold' : 'text-muted-foreground'}>
                          {inv.currency} {inv.amount_due.toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-sm ${isOverdue ? 'text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                          {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(inv.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/invoices/${inv.id}`)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/invoices/${inv.id}?action=pay`)}>
                                <DollarSign className="h-4 w-4 mr-2" /> Record Payment
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete this invoice?')) deleteInvoice.mutate(inv.id); }}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
