import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

export default function GoogleOAuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { company } = useCompany();
    const [status, setStatus] = useState('Verifying authentication...');
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    useEffect(() => {
        async function processOAuth() {
            if (!user || !company?.id) return;
            
            const params = new URLSearchParams(location.search);
            const code = params.get('code');
            const error = params.get('error');

            if (error) {
                toast.error(`OAuth Error: ${error}`);
                navigate('/dashboard/fastsend');
                return;
            }

            if (!code) {
                navigate('/dashboard/fastsend');
                return;
            }

            setStatus('Exchanging token with Google...');
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;
                
                // Current path used as redirect URI
                const redirectUri = window.location.origin + '/google-oauth-callback';

                const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-oauth`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        action: 'exchange', 
                        code, 
                        companyId: company.id,
                        redirectUri
                    }),
                });

                const data = await res.json();
                if (data.error) throw new Error(data.error);
                
                toast.success('Gmail account connected successfully!');
                navigate('/dashboard/fastsend');
            } catch (err: any) {
                toast.error(err.message || 'Failed to connect Gmail');
                navigate('/dashboard/fastsend');
            }
        }

        processOAuth();
    }, [location.search, user, company?.id, navigate, projectId]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <h2 className="text-xl font-semibold tracking-tight">Connecting Gmail</h2>
                <p className="text-muted-foreground">{status}</p>
            </div>
        </div>
    );
}
