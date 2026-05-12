import { useParams } from 'react-router-dom';
import { usePublicDocument } from '@/hooks/usePublicDocument';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Download, Printer, CheckCircle2, XCircle, CreditCard } from 'lucide-react';
import { DocumentView } from '@/components/financial/DocumentView';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface PublicDocumentProps {
    type: 'quotation' | 'invoice';
}

export default function PublicDocument({ type }: PublicDocumentProps) {
    const { id } = useParams();
    const { data: data, isLoading, refetch } = usePublicDocument(type, id);
    const [actionLoading, setActionLoading] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleAction = async (action: 'accepted' | 'rejected') => {
        if (!id) return;
        setActionLoading(true);
        try {
            const table = type === 'quotation' ? 'quotations' : 'invoices';
            const { error } = await supabase
                .from(table as any)
                .update({ status: action, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            toast.success(`Document marked as ${action}`);
            refetch();
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading {type}...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full p-10 text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="h-8 w-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">Document Not Found</h2>
                        <p className="text-slate-500 mt-2">This document might have been deleted or the link is incorrect.</p>
                        <Button className="mt-6" variant="outline" onClick={() => window.close()}>Close Window</Button>
                </Card>
            </div>
        );
    }

    const { document, items, company } = data;
    const isQuotation = type === 'quotation';

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:py-12 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
            <div className="max-w-4xl mx-auto">
                {/* Top Action Bar - Hidden in Print */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white rounded-lg shadow-sm border flex items-center justify-center">
                            <img src={company.logo_url || '/logo.png'} alt="Logo" className="h-6 w-auto" onError={(e) => (e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png')} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">{isQuotation ? 'Quotation' : 'Invoice'}</h1>
                            <p className="text-sm text-slate-500">{document[isQuotation ? 'quotation_number' : 'invoice_number']}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toast.info('PDF Generation coming soon!')}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                        {isQuotation && document.status === 'sent' && (
                            <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={actionLoading} onClick={() => handleAction('accepted')}>
                                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    Approve
                                </Button>
                                <Button size="sm" variant="destructive" disabled={actionLoading} onClick={() => handleAction('rejected')}>
                                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                                    Reject
                                </Button>
                            </>
                        )}
                        {!isQuotation && document.status === 'unpaid' && (
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => toast.info('Payment integration coming soon!')}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Pay Now
                            </Button>
                        )}
                    </div>
                </div>

                {/* Main Document Card */}
                <Card className="relative border-none shadow-xl overflow-hidden print:shadow-none print:border print:border-slate-200">
                    <DocumentView type={type} document={document} items={items} company={company} />
                    
                    {/* Footer Information */}
                    <div className="bg-slate-50 p-8 border-t border-slate-100 text-center text-slate-400 text-xs">
                        <p>© {new Date().getFullYear()} {company.name}. Generated by FastestCRM.</p>
                        <p className="mt-1">For any queries regarding this document, please contact {company.email || 'the sender'}.</p>
                    </div>
                </Card>
            </div>
            
            {/* Powered By */}
            <div className="mt-12 text-center text-slate-300 text-sm flex items-center justify-center gap-2 print:hidden">
                Powered by 
                <span className="font-bold tracking-tight text-slate-400 flex items-center">
                    Fastest<span className="text-blue-400">CRM</span>
                </span>
            </div>
        </div>
    );
}
