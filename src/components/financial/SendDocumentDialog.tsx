import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Send, AlertCircle } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { Quotation } from '@/hooks/useQuotations';
import { Invoice } from '@/hooks/useInvoices';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from 'sonner';

interface SendDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    document: Quotation | Invoice;
    type: 'quotation' | 'invoice';
    onSuccess?: () => void;
}

export function SendDocumentDialog({ open, onOpenChange, document, type, onSuccess }: SendDocumentDialogProps) {
    const { accounts, isLoading: accountsLoading, sendDirectEmail } = useEmailAccounts();
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [recipientEmail, setRecipientEmail] = useState(document.client_email || '');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    const isQuotation = type === 'quotation';
    const documentNumber = isQuotation ? (document as Quotation).quotation_number : (document as Invoice).invoice_number;
    
    // Construct the public URL
    const publicUrl = `${window.location.origin}/public/${isQuotation ? 'quotation' : 'invoice'}/${document.id}`;

    useEffect(() => {
        if (open) {
            setSubject(`${isQuotation ? 'Quotation' : 'Invoice'} ${documentNumber} from FastestCRM`);
            setBody(`Dear ${document.client_name},\n\nPlease find the ${isQuotation ? 'quotation' : 'invoice'} ${documentNumber} attached for your review.\n\nYou can view and download the document here:\n${publicUrl}\n\nBest regards,\nTeam FastestCRM`);
            
            // Auto-select first connected account
            const connectedAccount = accounts.find(a => a.status === 'connected');
            if (connectedAccount) {
                setSelectedAccountId(connectedAccount.id);
            } else if (accounts.length > 0) {
                setSelectedAccountId(accounts[0].id);
            }
        }
    }, [open, document, accounts, type, publicUrl]);

    const handleSend = async () => {
        if (!selectedAccountId) {
            toast.error('Please select a sending account');
            return;
        }
        if (!recipientEmail) {
            toast.error('Recipient email is required');
            return;
        }

        try {
            await sendDirectEmail.mutateAsync({
                accountId: selectedAccountId,
                to: recipientEmail,
                subject,
                bodyHtml: body.replace(/\n/g, '<br>'),
                leadId: document.lead_id || undefined,
                leadTable: document.lead_table || undefined,
            });
            
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            // Error handled by mutation toast
        }
    };

    const connectedAccounts = accounts.filter(a => a.status === 'connected');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Mail className="h-5 w-5 text-primary" />
                        Send {isQuotation ? 'Quotation' : 'Invoice'} via Email
                    </DialogTitle>
                    <DialogDescription>
                        Choose a FastSend account and customize the message for your client.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {accounts.length === 0 && !accountsLoading && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Email Accounts Found</AlertTitle>
                            <AlertDescription>
                                Please connect an email account in FastSend settings before sending documents.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="account">Send From</Label>
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                            <SelectTrigger id="account" className="h-11">
                                <SelectValue placeholder={accountsLoading ? 'Loading accounts...' : 'Select an account'} />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                        <div className="flex flex-col text-left">
                                            <span className="font-medium">{account.display_name || account.email_address}</span>
                                            <span className="text-xs text-muted-foreground">{account.provider} • {account.status}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="to">To</Label>
                        <Input 
                            id="to" 
                            placeholder="client@example.com" 
                            value={recipientEmail} 
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            className="h-11"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input 
                            id="subject" 
                            placeholder="Email Subject" 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)}
                            className="h-11"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea 
                            id="message" 
                            rows={6} 
                            placeholder="Type your message here..." 
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            className="resize-none"
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                            * The public link is automatically included in the message above.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-6">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={sendDirectEmail.isPending || !selectedAccountId || accounts.length === 0}
                        className="h-11 px-8 gradient-primary"
                    >
                        {sendDirectEmail.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Document
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
