import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SubdomainProvider, useSubdomainContext } from "@/contexts/SubdomainContext";
import { SubdomainGate } from "@/components/SubdomainGate";
import { CompanyBrandingProvider } from "@/contexts/CompanyBrandingContext";
import { SubdomainAccessGuard } from "@/components/SubdomainAccessGuard";
import AppLayout from "@/components/layout/AppLayout";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ─── Page imports ─────────────────────────────────────────────────────────────
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import RegisterCompany from "./pages/RegisterCompany";
import Dashboard from "./pages/Dashboard";
import AllLeads from "./pages/AllLeads";
import LGDashboard from "./pages/LGDashboard";
import Interested from "./pages/Interested";
import Paid from "./pages/Paid";
import PendingPayments from "./pages/PendingPayments";
import AutoDialer from "./pages/AutoDialer";
import AIInsights from "./pages/AIInsights";
import Team from "./pages/Team";
import Automations from "./pages/Automations";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Forms from "./pages/Forms";
import FormResponses from "./pages/FormResponses";
import FormBuilder from "./pages/FormBuilder";
import PublicForm from "./pages/PublicForm";
import ResetPassword from "./pages/ResetPassword";
import ManageCompany from "./pages/ManageCompany";
import ManageStatuses from "./pages/ManageStatuses";
import ManageProducts from "./pages/ManageProducts";
import PlatformAdmin from "./pages/PlatformAdmin";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RealEstateAllLeads from "./industries/real_estate/RealEstateAllLeads";
import ManageLeadProfiling from "./industries/real_estate/ManageLeadProfiling";
import ManageProperties from "./industries/real_estate/pages/ManageProperties";
import ManageInsurancePlans from "./industries/insurance/ManageInsurancePlans";
import InsuranceLeadProfiling from "./industries/insurance/InsuranceLeadProfiling";
import { useCompany } from "@/hooks/useCompany";
import Report from "./pages/Report";
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BigdataSQL from "./pages/BigdataSQL";
import Tasks from "./pages/Tasks";
import RedirectToApp from "./pages/RedirectToApp";
import Documentation from "./pages/Documentation";
import CalendarPage from "./pages/CalendarPage";
import PublicBooking from "./pages/PublicBooking";
import EmailDashboard from "./pages/EmailDashboard";
import ManageEmailAliases from "./pages/ManageEmailAliases";
import WhatsAppCampaign from "./pages/WhatsAppCampaign";

import { isAndroidWebView } from "@/lib/platform";

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Prevent crashes from unhandled query errors
      throwOnError: false,
    },
    mutations: {
      retry: 1,
      throwOnError: false,
    },
  },
});

// ─── Route Components ──────────────────────────────────────────────────────────

/** Redirect already-logged-in users. Redirect logic centrally managed here. */
function AuthRoute() {
  const { user, loading: authLoading } = useAuth();
  const { data: isPlatformAdmin, isLoading: isCheckingAdmin } = usePlatformAdmin();

  // If the user IS logged in, we wait to check admin status before redirecting.
  if (user) {
    if (isCheckingAdmin) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    return <Navigate to={isPlatformAdmin ? '/platform' : '/dashboard'} replace />;
  }

  // If auth is still loading, we render the <Auth /> page IMMEDIATELY.
  // This fulfills the "subdomain pages must load instantly" requirement.
  // If they turn out to be logged in when auth finishes, it will re-render and redirect them.
  return <Auth />;
}

/** Basic protected route guard — also blocks deactivated users */
function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [deactivated, setDeactivated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkDeactivation() {
      if (!user) {
        setChecking(false);
        return;
      }
      const { data } = await (await import('@/integrations/supabase/client')).supabase
        .from('profiles')
        .select('is_deactivated')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (data?.is_deactivated) {
        setDeactivated(true);
        toast({
          title: 'Account Deactivated',
          description: 'Your account has been deactivated. Please contact your administrator.',
          variant: 'destructive',
        });
        await signOut();
      }
      setChecking(false);
    }
    checkDeactivation();
    return () => { cancelled = true; };
  }, [user]);

  if (authLoading || checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user || deactivated) return <Navigate to="/auth" state={{ from: location }} replace />;

  return <>{children}</>;
}

/** Routes lead profiling to correct industry component */
function LeadProfilingRouter() {
  const { company } = useCompany();
  if (company?.industry === 'insurance') return <InsuranceLeadProfiling />;
  return <ManageLeadProfiling />;
}

/** The main route structure, unified for both main domain and subdomains */
function AppRoutes() {
  const { isMainDomain } = useSubdomainContext();
  const isWebView = isAndroidWebView();

  return (
    <Routes>
      {/* Home Path Logic */}
      {isMainDomain ? (
        <Route path="/" element={isWebView ? <Navigate to="/auth" replace /> : <Landing />} />
      ) : (
        <Route path="/" element={<AuthRoute />} />
      )}

      {/* Shared Auth/Public Routes */}
      <Route path="/auth" element={<AuthRoute />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/register-company" element={<RegisterCompany />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/form/:id" element={<PublicForm />} />
      <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/app" element={<RedirectToApp />} />
      <Route path="/documentation" element={<Documentation />} />
      <Route path="/book/:slug" element={<PublicBooking />} />

      {/* Platform Admin */}
      <Route path="/platform" element={<Protected><PlatformAdmin /></Protected>} />

      {/* Dashboard Routes — Wrapped in Layout & Guards */}
      <Route element={<Protected><SubdomainAccessGuard><AppLayout /></SubdomainAccessGuard></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/lg" element={<LGDashboard />} />
        <Route path="/dashboard/leads" element={<AllLeads />} />
        <Route path="/dashboard/interested" element={<Interested />} />
        <Route path="/dashboard/paid" element={<Paid />} />
        <Route path="/dashboard/pending" element={<PendingPayments />} />
        <Route path="/dashboard/dialer" element={<AutoDialer />} />
        <Route path="/dashboard/report" element={<Report />} />
        <Route path="/dashboard/ai" element={<AIInsights />} />
        <Route path="/dashboard/team" element={<Team />} />
        <Route path="/dashboard/automations" element={<Automations />} />
        <Route path="/dashboard/integrations" element={<Integrations />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/dashboard/forms" element={<Forms />} />
        <Route path="/dashboard/forms/:id/responses" element={<FormResponses />} />
        <Route path="/dashboard/forms/new" element={<FormBuilder />} />
        <Route path="/dashboard/forms/:id" element={<FormBuilder />} />
        <Route path="/dashboard/company" element={<ManageCompany />} />
        <Route path="/dashboard/statuses" element={<ManageStatuses />} />
        <Route path="/dashboard/products" element={<ManageProducts />} />
        <Route path="/dashboard/real-estate-leads" element={<RealEstateAllLeads />} />
        <Route path="/dashboard/properties" element={<ManageProperties />} />
        <Route path="/dashboard/lead-profiling" element={<LeadProfilingRouter />} />
        <Route path="/dashboard/insurance-plans" element={<ManageInsurancePlans />} />
        <Route path="/dashboard/bigdata-sql" element={<BigdataSQL />} />
        <Route path="/dashboard/tasks" element={<Tasks />} />
        <Route path="/dashboard/calendar" element={<CalendarPage />} />
        <Route path="/dashboard/email" element={<EmailDashboard />} />
        <Route path="/dashboard/email-settings" element={<ManageEmailAliases />} />
        <Route path="/dashboard/whatsapp" element={<WhatsAppCampaign />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SubdomainProvider>
            <CompanyBrandingProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                {/* Gate only handles showing a spinner while resolving non-main domains */}
                <SubdomainGate mainDomainContent={<AppRoutes />}>
                  <AppRoutes />
                </SubdomainGate>
              </TooltipProvider>
            </CompanyBrandingProvider>
          </SubdomainProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
