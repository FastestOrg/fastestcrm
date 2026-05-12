import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
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

// ─── Public Pages (Essential) ──────────────────────────────────────────────────
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import RegisterCompany from "./pages/RegisterCompany";

// ─── Dashboard Pages (Lazy Loaded) ─────────────────────────────────────────────
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AllLeads = lazy(() => import("./pages/AllLeads"));
const LGDashboard = lazy(() => import("./pages/LGDashboard"));
const Interested = lazy(() => import("./pages/Interested"));
const Paid = lazy(() => import("./pages/Paid"));
const PendingPayments = lazy(() => import("./pages/PendingPayments"));
const AutoDialer = lazy(() => import("./pages/AutoDialer"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const Team = lazy(() => import("./pages/Team"));
const Automations = lazy(() => import("./pages/Automations"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Settings = lazy(() => import("./pages/Settings"));
const Forms = lazy(() => import("./pages/Forms"));
const FormResponses = lazy(() => import("./pages/FormResponses"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ManageCompany = lazy(() => import("./pages/ManageCompany"));
const ManageStatuses = lazy(() => import("./pages/ManageStatuses"));
const ManageProducts = lazy(() => import("./pages/ManageProducts"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RealEstateAllLeads = lazy(() => import("./industries/real_estate/RealEstateAllLeads"));
const ManageLeadProfiling = lazy(() => import("./industries/real_estate/ManageLeadProfiling"));
const ManageProperties = lazy(() => import("./industries/real_estate/pages/ManageProperties"));
const ManageInsurancePlans = lazy(() => import("./industries/insurance/ManageInsurancePlans"));
const InsuranceLeadProfiling = lazy(() => import("./industries/insurance/InsuranceLeadProfiling"));
const Report = lazy(() => import("./pages/Report"));
const MetaOAuthCallback = lazy(() => import("./pages/MetaOAuthCallback"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BigdataSQL = lazy(() => import("./pages/BigdataSQL"));
const Tasks = lazy(() => import("./pages/Tasks"));
const RedirectToApp = lazy(() => import("./pages/RedirectToApp"));
const Documentation = lazy(() => import("./pages/Documentation"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const EmailDashboard = lazy(() => import("./pages/EmailDashboard"));
const ManageEmailAliases = lazy(() => import("./pages/ManageEmailAliases"));
const GoogleOAuthCallback = lazy(() => import("./pages/GoogleOAuthCallback"));
const WhatsAppCampaign = lazy(() => import("./pages/WhatsAppCampaign"));
const FastSend = lazy(() => import("./pages/FastSend"));
const RealEstateCRM = lazy(() => import("./pages/RealEstateCRM"));
const EdTechCRM = lazy(() => import("./pages/EdTechCRM"));
const SaasCRM = lazy(() => import("./pages/SaasCRM"));
const Quotations = lazy(() => import("./pages/Quotations"));
const QuotationBuilder = lazy(() => import("./pages/QuotationBuilder"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceBuilder = lazy(() => import("./pages/InvoiceBuilder"));
const InvoiceSettings = lazy(() => import("./pages/InvoiceSettings"));
const IndustrySolutionTemplate = lazy(() => import("./pages/IndustrySolutionTemplate"));
const ComparisonTemplate = lazy(() => import("./pages/ComparisonTemplate"));
const RegionalSolutionTemplate = lazy(() => import("./pages/RegionalSolutionTemplate"));
const GlossaryPage = lazy(() => import("./pages/GlossaryPage"));
const GlossaryTermPage = lazy(() => import("./pages/GlossaryTermPage"));
const SalesToolsPage = lazy(() => import("./pages/SalesToolsPage"));
const PressKitPage = lazy(() => import("./pages/PressKitPage"));
const AIClosingAssistant = lazy(() => import("./pages/AIClosingAssistant"));
const AIOpsDashboard = lazy(() => import("./pages/AIOpsDashboard"));
const FastestAIHub = lazy(() => import("./pages/FastestAIHub"));
const AgenticWorkflows = lazy(() => import("./pages/AgenticWorkflows"));
const DealIntelligence = lazy(() => import("./pages/DealIntelligence"));
const RevenueForecast = lazy(() => import("./pages/RevenueForecast"));
const CustomerHealth = lazy(() => import("./pages/CustomerHealth"));
const PersonalizationEngine = lazy(() => import("./pages/PersonalizationEngine"));
const ManageAIEmployees = lazy(() => import("./pages/ManageAIEmployees"));
const AIGrowthHacker = lazy(() => import("./pages/AIGrowthHacker"));
const MarketScout = lazy(() => import("./pages/MarketScout"));
const FastestScout = lazy(() => import("./pages/FastestScout"));
const AIMissionControl = lazy(() => import("./pages/AIMissionControl"));
const PublicDocument = lazy(() => import("./pages/PublicDocument"));

import { useCompany } from "@/hooks/useCompany";
import { solutionsData } from "./data/solutions";
import { comparisonsData } from "./data/comparisons";
import { citiesData } from "./data/cities";
import { glossaryTerms } from "./data/glossary";

import { isAndroidWebView } from "@/lib/platform";

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      throwOnError: false,
    },
    mutations: {
      retry: 1,
      throwOnError: false,
    },
  },
});

// ─── Route Components ──────────────────────────────────────────────────────────

const PageLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
    <div className="relative">
      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-110 animate-pulse" />
      <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
    </div>
    <p className="text-muted-foreground mt-4 text-sm font-medium animate-pulse">Initializing Interface...</p>
  </div>
);

/** Redirect already-logged-in users. Redirect logic centrally managed here. */
function AuthRoute() {
  const { user, loading: authLoading } = useAuth();
  const { data: isPlatformAdmin, isLoading: isCheckingAdmin } = usePlatformAdmin();

  if (user) {
    if (isCheckingAdmin) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    return <Navigate to={isPlatformAdmin ? '/platform' : '/dashboard'} replace />;
  }
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
        .select('id, is_deactivated')
        .eq('id', user.id)
        .maybeSingle() as any;

      if (cancelled) return;

      if ((data as any)?.is_deactivated) {
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
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/public/quotation/:id" element={<PublicDocument type="quotation" />} />
        <Route path="/public/invoice/:id" element={<PublicDocument type="invoice" />} />
        <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
        <Route path="/google-oauth-callback" element={<GoogleOAuthCallback />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/crm-for-real-estate" element={<RealEstateCRM />} />
        <Route path="/crm-for-edtech" element={<EdTechCRM />} />
        <Route path="/crm-for-saas" element={<SaasCRM />} />
        <Route path="/crm-for-healthcare" element={<IndustrySolutionTemplate {...solutionsData.healthcare} />} />
        <Route path="/crm-for-education" element={<IndustrySolutionTemplate {...solutionsData.education} />} />
        
        {/* Comparison Pages */}
        <Route path="/vs/zoho" element={<ComparisonTemplate {...comparisonsData.zoho} />} />
        <Route path="/vs/hubspot" element={<ComparisonTemplate {...comparisonsData.hubspot} />} />
        <Route path="/vs/leadsquared" element={<ComparisonTemplate {...comparisonsData.leadsquared} />} />
        <Route path="/vs/freshsales" element={<ComparisonTemplate {...comparisonsData.freshsales} />} />
        
        {/* Regional Pages */}
        <Route path="/solutions/bangalore" element={<RegionalSolutionTemplate {...citiesData.bangalore} />} />
        <Route path="/solutions/mumbai" element={<RegionalSolutionTemplate {...citiesData.mumbai} />} />
        <Route path="/solutions/delhi" element={<RegionalSolutionTemplate {...citiesData.delhi} />} />
        <Route path="/solutions/hyderabad" element={<RegionalSolutionTemplate {...citiesData.hyderabad} />} />
        
        {/* 10,000X SEO Knowledge Hub & Tools */}
        <Route path="/glossary" element={<GlossaryPage />} />
        <Route path="/glossary/:slug" element={<GlossaryTermPage />} />
        <Route path="/tools" element={<SalesToolsPage />} />
        <Route path="/press" element={<PressKitPage />} />
        
        <Route path="/app" element={<RedirectToApp />} />
        <Route path="/documentation" element={<Documentation />} />


        {/* Platform Admin */}
        <Route path="/platform" element={<Protected><PlatformAdmin /></Protected>} />

        {/* Dashboard Routes — Wrapped in Layout & Guards */}
        <Route element={<Protected><SubdomainAccessGuard><AppLayout /></SubdomainAccessGuard></Protected>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/lg" element={<AIGrowthHacker />} />
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
          <Route path="/dashboard/ai-closing" element={<AIClosingAssistant />} />
          <Route path="/dashboard/ai-ops" element={<AIOpsDashboard />} />
          <Route path="/dashboard/ai-mission-control" element={<AIMissionControl />} />
          <Route path="/dashboard/market-scout" element={<MarketScout />} />
          <Route path="/dashboard/fastest-scout" element={<FastestScout />} />
          <Route path="/dashboard/fastest-ai" element={<FastestAIHub />} />
          <Route path="/dashboard/agentic-workflows" element={<AgenticWorkflows />} />
          <Route path="/dashboard/deal-intelligence" element={<DealIntelligence />} />
          <Route path="/dashboard/revenue-forecast" element={<RevenueForecast />} />
          <Route path="/dashboard/customer-health" element={<CustomerHealth />} />
          <Route path="/dashboard/personalization" element={<PersonalizationEngine />} />
          <Route path="/dashboard/ai-employees" element={<ManageAIEmployees />} />
          <Route path="/dashboard/bigdata-sql" element={<BigdataSQL />} />
          <Route path="/dashboard/tasks" element={<Tasks />} />
          <Route path="/dashboard/calendar" element={<CalendarPage />} />
          <Route path="/dashboard/email" element={<EmailDashboard />} />
          <Route path="/dashboard/email-settings" element={<ManageEmailAliases />} />
          <Route path="/dashboard/fastsend" element={<FastSend />} />
          <Route path="/dashboard/whatsapp" element={<WhatsAppCampaign />} />
          <Route path="/dashboard/quotations" element={<Quotations />} />
          <Route path="/dashboard/quotations/new" element={<QuotationBuilder />} />
          <Route path="/dashboard/quotations/:id" element={<QuotationBuilder />} />
          <Route path="/dashboard/invoices" element={<Invoices />} />
          <Route path="/dashboard/invoices/new" element={<InvoiceBuilder />} />
          <Route path="/dashboard/invoices/:id" element={<InvoiceBuilder />} />
          <Route path="/dashboard/invoice-settings" element={<InvoiceSettings />} />
        </Route>

        <Route path="/:companySlug/:slug" element={<PublicBooking />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

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
