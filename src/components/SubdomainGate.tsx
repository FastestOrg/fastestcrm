/**
 * SubdomainGate
 *
 * Controls which route-tree to render based on the resolved domain.
 *
 * Flow:
 *  1. Main domain / localhost / preview → render mainDomainContent immediately (no DB wait)
 *  2. Workspace subdomain/custom domain, still loading → spinner
 *  3. Workspace subdomain failed (not found / inactive) → error page
 *  4. Workspace subdomain resolved → render children (full CRM app)
 *  5. Custom domain with no match → fail-open, render children (routes to /auth)
 *
 * IMPORTANT: On the main domain and localhost `loading` is always `false`
 * from the very first render (see useSubdomain), so case 1 is always instant.
 */

import { useSubdomainContext } from '@/contexts/SubdomainContext';
import { Loader2 } from 'lucide-react';

interface SubdomainGateProps {
  children: React.ReactNode;
  mainDomainContent: React.ReactNode;
}

export function SubdomainGate({ children, mainDomainContent }: SubdomainGateProps) {
  const { isMainDomain, isSubdomain, loading, error, company } = useSubdomainContext();

  // ① Fast path: main domain (fastestcrm.com / localhost / preview)
  //    loading is always false here — zero delay
  if (isMainDomain) {
    return <>{mainDomainContent}</>;
  }

  // ② Workspace domain: still resolving company via RPC
  // We explicitly DO NOT block rendering here anymore. We allow children to render immediately
  // so the user sees something right away (fulfilling the "super fast load" requirement).
  // Branding will automatically pop in once resolved, but the login form is instantly usable.
  // It only shows an error block (below) if the lookup completely failed.

  // ③ Subdomain resolved but workspace not found or inactive
  if (error && isSubdomain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Workspace Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a
            href="https://www.fastestcrm.com"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to FastestCRM
          </a>
        </div>
      </div>
    );
  }

  // ④ & ⑤ Company found OR custom-domain fail-open → render the CRM app
  //    The SubdomainAccessGuard inside will handle per-user access checks.
  return <>{children}</>;
}
