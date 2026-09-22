import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setReferralCode } from '@/hooks/useReferralTracker';
import { Loader2 } from 'lucide-react';

export default function ReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      setReferralCode(code);
      // Navigate to register-company with referral code preserved in query param
      navigate(`/register-company?ref=${encodeURIComponent(code.toUpperCase())}`, { replace: true });
    } else {
      navigate('/register-company', { replace: true });
    }
  }, [code, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm font-medium">
        Applying partner referral &amp; securing your 10% discount...
      </p>
    </div>
  );
}
