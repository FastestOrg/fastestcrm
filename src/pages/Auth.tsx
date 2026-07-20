/**
 * Auth page — login form only.
 *
 * Redirect logic is handled by <AuthRoute> in App.tsx.
 * This component's only job: collect credentials → call signIn → show result.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubdomainContext } from '@/contexts/SubdomainContext';
import { useCompanyBranding } from '@/contexts/CompanyBrandingContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Building2, WifiOff, RefreshCw } from 'lucide-react';
import { z } from 'zod';

// ─── Validation schema ────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function Auth() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auth — only used for signIn.  Redirect handled by AuthRoute in App.tsx.
  const { signIn } = useAuth();

  // Subdomain / branding — purely cosmetic, never blocks login
  const { isSubdomain, isCustomDomain, company: subdomainCompany } = useSubdomainContext();
  const isWorkspaceDomain = isSubdomain || isCustomDomain;
  const { companyName, logoUrl, applyBranding } = useCompanyBranding();

  const { toast } = useToast();

  // ── Form validation ────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    setErrors({});
    try {
      loginSchema.parse({ email, password });
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) fieldErrors[e.path[0] as string] = e.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  // ── Forgot-password ────────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      z.string().email('Please enter a valid email').parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) setErrors({ email: err.errors[0].message });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Check your email', description: 'We sent you a password reset link.' });
        setIsForgotPassword(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Sign-in ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: 'Sign in failed',
          description: error.message || 'Invalid email or password. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Normal auth UI ─────────────────────────────────────────────────────────

  // If we are on a workspace domain, WAIT for the company to load before showing any UI.
  // This prevents the "flash" of the generic fastestcrm login page.
  const isSubdomainLoading = useSubdomainContext().loading;

  if (isWorkspaceDomain && isSubdomainLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 dot-grid-bg opacity-40" />
        <div className="absolute top-1/4 left-1/5 w-80 h-80 bg-primary/15 rounded-full blur-[90px] animate-float" />
        <div className="absolute bottom-1/4 right-1/5 w-72 h-72 bg-primary/10 rounded-full blur-[80px] animate-float-slow" />

        <div className="w-full max-w-md relative text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground animate-pulse">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 dot-grid-bg opacity-40" />
      <div className="absolute top-1/4 left-1/5 w-80 h-80 bg-primary/15 rounded-full blur-[90px] animate-float" />
      <div className="absolute bottom-1/4 right-1/5 w-72 h-72 bg-primary/10 rounded-full blur-[80px] animate-float-slow" />

      <div className="w-full max-w-md relative">
        {/* Back link or workspace label */}
        {isWorkspaceDomain && subdomainCompany ? (
          <div className="mb-8 text-center">
            <p className="text-sm text-muted-foreground">
              Signing in to{' '}
              <span className="font-medium text-foreground">
                {companyName || subdomainCompany.name}
              </span>
            </p>
          </div>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        )}

        <Card
          className="glass border-border/50 shadow-2xl"
          style={{ boxShadow: '0 0 60px hsl(175 80% 48% / 0.08), 0 20px 60px hsl(0 0% 0% / 0.3)' }}
        >
          <CardHeader className="text-center">
            {/* Logo / branding */}
            {applyBranding && logoUrl ? (
              <div className="mx-auto w-16 h-16 rounded-xl overflow-hidden mb-4 border border-border/50 bg-background/50">
                <img src={logoUrl} alt={companyName || 'Company logo'} className="w-full h-full object-cover" />
              </div>
            ) : applyBranding && companyName ? (
              <div className="mx-auto w-16 h-16 rounded-xl gradient-primary flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-primary-foreground" />
              </div>
            ) : (
              <div className="mx-auto w-12 h-12 flex items-center justify-center mb-4">
                <img src="/fastestcrmlogo.png" alt="Fastest CRM" className="w-12 h-12 object-contain" />
              </div>
            )}

            {/* Company name badge */}
            {applyBranding && companyName && (
              <div className="mb-2">
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {companyName}
                </span>
              </div>
            )}

            <CardTitle className="text-2xl" style={{ fontFamily: "'Syne', sans-serif" }}>
              {isForgotPassword ? 'Reset your password' : 'Welcome back'}
            </CardTitle>
            <CardDescription>
              {isForgotPassword
                ? 'Enter your email to receive a reset link'
                : applyBranding
                  ? `Sign in to ${companyName}'s workspace`
                  : 'Sign in to access your CRM dashboard'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isForgotPassword ? (
              /* ── Forgot-password form ── */
              <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className={errors.email ? 'border-destructive' : ''}
                    autoComplete="email"
                    autoFocus
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-primary shimmer-overlay font-semibold"
                  style={{ color: 'hsl(222 28% 5%)' }}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitting ? 'Sending…' : 'Send Reset Link'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-primary hover:underline font-medium text-sm"
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
            ) : (
              /* ── Sign-in form ── */
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className={errors.email ? 'border-destructive' : ''}
                    autoComplete="email"
                    autoFocus
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className={errors.password ? 'border-destructive' : ''}
                    autoComplete="current-password"
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-primary shimmer-overlay font-semibold"
                  style={{ color: 'hsl(222 28% 5%)' }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-primary">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
        </p>

        <footer className="mt-8 flex flex-col items-center gap-4">
          <p className="text-xs text-center text-muted-foreground">
            © 2025-∞ Fastest CRM by Upmarking.com. Built for Fastest Sales Teams.
          </p>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Download FastestCRM App
            </p>
            <a href="https://play.google.com/store/apps/details?id=com.fastestcrm" target="_blank" rel="noopener noreferrer">
              <img src="/getitongoogleplay.png" alt="Get it on Google Play" className="h-7 hover:opacity-90 transition-opacity" />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}