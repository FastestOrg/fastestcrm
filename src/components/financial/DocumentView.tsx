import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

interface DocumentViewProps {
    type: 'quotation' | 'invoice';
    document: any;
    items: any[];
    company: {
        name: string;
        logo_url: string | null;
        primary_color: string | null;
        address: string | null;
        email: string | null;
        phone: string | null;
        gstin: string | null;
        pan?: string | null;
        bank_name?: string | null;
        account_number?: string | null;
        ifsc_code?: string | null;
        upi_id?: string | null;
        show_bank_details?: boolean;
        show_logo?: boolean;
    };
}

export function DocumentView({ type, document, items, company }: DocumentViewProps) {
    const isQuotation = type === 'quotation';
    const statusColor = {
        draft: 'bg-slate-100 text-slate-700',
        sent: 'bg-blue-100 text-blue-700',
        accepted: 'bg-green-100 text-green-700',
        rejected: 'bg-red-100 text-red-700',
        expired: 'bg-orange-100 text-orange-700',
        converted: 'bg-indigo-100 text-indigo-700',
        paid: 'bg-green-100 text-green-700',
        unpaid: 'bg-orange-100 text-orange-700',
        overdue: 'bg-red-100 text-red-700',
        partial: 'bg-blue-100 text-blue-700',
        cancelled: 'bg-slate-100 text-slate-700',
    }[document.status] || 'bg-slate-100 text-slate-700';

    const currency = document.currency || 'INR';

    return (
        <CardContent className="p-8 sm:p-12 bg-white text-slate-900">
            {/* Header Banner - Company Color */}
            <div className="absolute top-0 left-0 h-2 w-full" style={{ backgroundColor: company.primary_color || '#3b82f6' }} />
            
            {/* Company & Document Meta */}
            <div className="flex flex-col md:flex-row justify-between gap-8 mb-12">
                <div className="space-y-4">
                    {company.show_logo !== false && (company.logo_url || '/logo.png') && (
                        <img 
                            src={company.logo_url || '/logo.png'} 
                            alt={company.name} 
                            className="h-12 w-auto object-contain" 
                            onError={(e) => (e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png')}
                        />
                    )}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{company.name}</h2>
                        <div className="text-slate-500 text-sm space-y-1 mt-2">
                            {company.address && <p className="whitespace-pre-line">{company.address}</p>}
                            {company.email && <p>Email: {company.email}</p>}
                            {company.phone && <p>Phone: {company.phone}</p>}
                            {company.gstin && <p>GSTIN: {company.gstin}</p>}
                            {company.pan && <p>PAN: {company.pan}</p>}
                        </div>
                    </div>
                </div>

                <div className="text-left md:text-right space-y-4">
                    <Badge className={`${statusColor} capitalize px-3 py-1 text-xs border-none shadow-none`}>
                        {document.status || 'Draft'}
                    </Badge>
                    <div className="space-y-1">
                        <p className="text-slate-500 text-sm uppercase tracking-wider font-semibold">Document No</p>
                        <p className="text-2xl font-bold text-slate-900">
                            {isQuotation ? (document.quotation_number || 'QUO-XXXX') : (document.invoice_number || 'INV-XXXX')}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-2">
                        <div>
                            <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">Issue Date</p>
                            <p className="text-slate-900 font-semibold">
                                {document.issued_at ? format(new Date(document.issued_at), 'MMM dd, yyyy') : format(new Date(), 'MMM dd, yyyy')}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">
                                {isQuotation ? 'Valid Until' : 'Due Date'}
                            </p>
                            <p className="text-slate-900 font-semibold">
                                {isQuotation 
                                    ? (document.valid_until ? format(new Date(document.valid_until), 'MMM dd, yyyy') : 'N/A')
                                    : (document.due_date ? format(new Date(document.due_date), 'MMM dd, yyyy') : 'N/A')
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Separator className="my-12 opacity-50" />

            {/* Client Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">Bill To</p>
                    <h3 className="text-lg font-bold text-slate-900">{document.client_name || 'Client Name'}</h3>
                    <div className="text-slate-500 text-sm space-y-1 mt-2">
                        {document.client_address && <p className="whitespace-pre-line">{document.client_address}</p>}
                        {document.client_email && <p>{document.client_email}</p>}
                        {document.client_phone && <p>{document.client_phone}</p>}
                        {document.client_gstin && <p className="mt-1">GSTIN: {document.client_gstin}</p>}
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto -mx-8 sm:mx-0">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                            <th className="py-4 px-8 sm:px-4 rounded-l-lg">Description</th>
                            <th className="py-4 px-4 text-center">Qty</th>
                            <th className="py-4 px-4 text-right">Unit Price</th>
                            <th className="py-4 px-4 text-right">Discount</th>
                            <th className="py-4 px-4 text-right">Tax</th>
                            <th className="py-4 px-8 sm:px-4 text-right rounded-r-lg">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400 italic">No items added yet.</td>
                            </tr>
                        ) : items.map((item, idx) => (
                            <tr key={idx} className="text-slate-700">
                                <td className="py-6 px-8 sm:px-4">
                                    <p className="font-semibold text-slate-900">{item.description || 'New Item'}</p>
                                    {item.hsn_sac_code && <p className="text-xs text-slate-400 mt-1">HSN/SAC: {item.hsn_sac_code}</p>}
                                </td>
                                <td className="py-6 px-4 text-center">{item.quantity}</td>
                                <td className="py-6 px-4 text-right">{currency} {item.unit_price?.toLocaleString()}</td>
                                <td className="py-6 px-4 text-right">
                                    {item.discount_percentage > 0 ? (
                                        <span className="text-slate-500">-{item.discount_percentage}%</span>
                                    ) : '-'}
                                </td>
                                <td className="py-6 px-4 text-right">
                                    {item.tax_amount > 0 ? `${currency} ${item.tax_amount.toLocaleString()}` : '-'}
                                </td>
                                <td className="py-6 px-8 sm:px-4 text-right font-bold text-slate-900">
                                    {currency} {item.line_total?.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            <div className="flex flex-col md:flex-row justify-between gap-12 mt-12">
                <div className="flex-1 space-y-6">
                    {document.notes && (
                        <div>
                            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-2">Notes</p>
                            <p className="text-slate-600 text-sm whitespace-pre-line bg-slate-50 p-4 rounded-lg border border-slate-100">
                                {document.notes}
                            </p>
                        </div>
                    )}
                    {document.terms_and_conditions && (
                        <div>
                            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-2">Terms & Conditions</p>
                            <p className="text-slate-500 text-xs whitespace-pre-line italic">
                                {document.terms_and_conditions}
                            </p>
                        </div>
                    )}
                    {company.show_bank_details !== false && (company.bank_name || company.account_number || company.ifsc_code || company.upi_id) && (
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-3 mt-4">
                            <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">Bank Details (For Payment)</p>
                            <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-700 max-w-md">
                                {company.bank_name && (
                                    <>
                                        <span className="font-medium text-slate-400">Bank Name</span>
                                        <span className="font-semibold text-slate-800">{company.bank_name}</span>
                                    </>
                                )}
                                {company.account_number && (
                                    <>
                                        <span className="font-medium text-slate-400">Account Number</span>
                                        <span className="font-semibold text-slate-800">{company.account_number}</span>
                                    </>
                                )}
                                {company.ifsc_code && (
                                    <>
                                        <span className="font-medium text-slate-400">IFSC Code</span>
                                        <span className="font-semibold text-slate-800">{company.ifsc_code}</span>
                                    </>
                                )}
                                {company.upi_id && (
                                    <>
                                        <span className="font-medium text-slate-400">UPI ID</span>
                                        <span className="font-semibold text-slate-800">{company.upi_id}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-full md:w-80 space-y-3">
                    <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span>{currency} {document.subtotal?.toLocaleString()}</span>
                    </div>
                    {document.discount_amount > 0 && (
                        <div className="flex justify-between text-red-500">
                            <span>Discount</span>
                            <span>-{currency} {document.discount_amount?.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-slate-500">
                        <span>Tax Amount</span>
                        <span>{currency} {document.tax_amount?.toLocaleString()}</span>
                    </div>
                    <Separator className="my-4" />
                    <div className="flex justify-between text-2xl font-black text-slate-900">
                        <span>Total</span>
                        <span style={{ color: company.primary_color || '#3b82f6' }}>
                            {currency} {document.total?.toLocaleString()}
                        </span>
                    </div>
                    
                    {!isQuotation && (
                        <div className="pt-4">
                            {document.status === 'paid' && (
                                <div className="bg-green-50 text-green-700 border border-green-100 rounded-lg p-4 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Fully Paid
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Brand Footer */}
            <div className="mt-16 pt-6 border-t border-slate-100 flex justify-between items-center text-slate-400 text-xs select-none">
                <span>{isQuotation ? 'Quotation' : 'Invoice'} #{isQuotation ? (document.quotation_number || 'QUO-XXXX') : (document.invoice_number || 'INV-XXXX')}</span>
                <span>Invoicing by <a href="https://fastestcrm.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary font-semibold transition-colors">FastestCRM.com</a></span>
            </div>
        </CardContent>
    );
}
