-- ============================================================================
-- Landing Pages — FastEngage
-- Allows users to create and publicly host HTML landing pages.
-- Pages are accessible at /lp/{company_slug}/{page_slug}
-- ============================================================================

-- 1. Create the landing_pages table
CREATE TABLE public.landing_pages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    meta_description TEXT,
    html_content TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT false,
    view_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Slug must be unique within a company (different companies can reuse slugs)
    UNIQUE(company_id, slug)
);

-- 2. Enable RLS
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Company members can view all landing pages in their company
-- (Hierarchy-based filtering is done in the frontend hook, just like leads)
CREATE POLICY "Company members can view landing pages"
    ON public.landing_pages FOR SELECT
    USING (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- Only the page creator can update their own landing pages
CREATE POLICY "Creator can update own landing pages"
    ON public.landing_pages FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Any authenticated company member can insert landing pages for their company
CREATE POLICY "Company members can create landing pages"
    ON public.landing_pages FOR INSERT
    WITH CHECK (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- Only the page creator can delete their own landing pages
CREATE POLICY "Creator can delete own landing pages"
    ON public.landing_pages FOR DELETE
    USING (created_by = auth.uid());

-- Public (anonymous) users can view published landing pages
-- This is needed for the public /lp/:companySlug/:slug route
CREATE POLICY "Public can view published landing pages"
    ON public.landing_pages FOR SELECT
    USING (is_published = true);

-- 4. Index for fast public lookups by company slug + page slug
CREATE INDEX idx_landing_pages_company_slug ON public.landing_pages(company_id, slug);
CREATE INDEX idx_landing_pages_published ON public.landing_pages(is_published) WHERE is_published = true;

-- 5. RPC function to atomically increment view count
-- Called from the public page to track page views without requiring auth
CREATE OR REPLACE FUNCTION public.increment_landing_page_view(page_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.landing_pages
    SET view_count = view_count + 1
    WHERE id = page_id AND is_published = true;
END;
$$;
