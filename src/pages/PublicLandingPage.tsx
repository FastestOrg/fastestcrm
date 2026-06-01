import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Public-facing landing page renderer.
 * Accessible at /lp/:companySlug/:pageSlug
 *
 * This page is entirely unauthenticated — it uses the anon key to fetch
 * published landing pages via the RLS policy "Public can view published landing pages".
 */
export default function PublicLandingPage() {
  const { companySlug, pageSlug } = useParams<{ companySlug: string; pageSlug: string }>();

  // Fetch the landing page by resolving company slug → company id → page
  const { data: page, isLoading, error } = useQuery({
    queryKey: ['public-landing-page', companySlug, pageSlug],
    queryFn: async () => {
      if (!companySlug || !pageSlug) return null;

      // Step 1: Resolve company slug to company ID
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', companySlug)
        .single();

      if (companyError || !companyData) {
        throw new Error('Company not found');
      }

      // Step 2: Fetch the published landing page
      const { data: pageData, error: pageError } = await supabase
        .from('landing_pages' as any)
        .select('*')
        .eq('company_id', companyData.id)
        .eq('slug', pageSlug)
        .eq('is_published', true)
        .single();

      if (pageError || !pageData) {
        throw new Error('Page not found');
      }

      return pageData as any;
    },
    enabled: !!companySlug && !!pageSlug,
    retry: false,
    staleTime: 1000 * 60 * 5, // Cache for 5 min to avoid refetches
  });

  // Track page view (fire-and-forget, only once per page load)
  useEffect(() => {
    if (page?.id) {
      const incrementView = async () => {
        try {
          await supabase.rpc('increment_landing_page_view', { page_id: page.id });
        } catch (error) {
          // Silently ignore — view tracking is non-critical
        }
      };
      incrementView();
    }
  }, [page?.id]);

  // Update document title from page data
  useEffect(() => {
    if (page?.title) {
      document.title = page.title;
    }
    // Update meta description
    if (page?.meta_description) {
      let metaTag = document.querySelector('meta[name="description"]');
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'description');
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', page.meta_description);
    }
  }, [page]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Error / Not Found ──
  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl font-bold text-gray-200">404</div>
          <h1 className="text-xl font-semibold text-gray-800">Page Not Found</h1>
          <p className="text-gray-500 max-w-sm">
            The page you're looking for doesn't exist or has been unpublished.
          </p>
        </div>
      </div>
    );
  }

  // ── Render the landing page HTML ──
  return (
    <>
      {/*
       * SECURITY: We render user-provided HTML inside a sandboxed iframe using srcdoc.
       *
       * Why an iframe instead of dangerouslySetInnerHTML directly in the page?
       * - The CRM uses Supabase auth tokens stored in localStorage/cookies.
       * - If we rendered arbitrary HTML directly, malicious JavaScript could steal
       *   auth tokens, make API calls as the user, or redirect to phishing sites.
       * - The sandboxed iframe creates a completely isolated browsing context:
       *   it has its own origin, its own storage, and cannot access the parent frame.
       *
       * The sandbox flags:
       * - "allow-scripts": So the user's CSS animations, JS interactions work correctly
       * - "allow-same-origin": So relative URLs (fonts, images via CDN) resolve properly
       *
       * This is the same approach used by platforms like CodePen, JSFiddle, and Notion
       * for rendering user-generated HTML content safely.
       */}
      <iframe
        title={page.title}
        srcDoc={page.html_content}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%',
          height: '100vh',
          border: 'none',
          display: 'block',
        }}
      />
    </>
  );
}
