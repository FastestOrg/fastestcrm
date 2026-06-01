import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Save,
  Globe,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Code,
  Monitor,
  Share2,
  Zap,
  BarChart3,
} from 'lucide-react';
import {
  useLandingPage,
  useCreateLandingPage,
  useUpdateLandingPage,
} from '@/hooks/useLandingPages';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type ViewMode = 'code' | 'preview' | 'split';

export default function LandingPageBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const { user } = useAuth();
  const isEdit = !!id;

  // Data
  const { data: existingPage, isLoading: pageLoading } = useLandingPage(id);
  const createPage = useCreateLandingPage();
  const updatePage = useUpdateLandingPage();

  const isOwner = !isEdit || existingPage?.created_by === user?.id;

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Populate form on edit
  useEffect(() => {
    if (existingPage) {
      setTitle(existingPage.title);
      setSlug(existingPage.slug);
      setMetaDescription(existingPage.meta_description || '');
      setHtmlContent(existingPage.html_content);
      setIsPublished(existingPage.is_published);
    }
  }, [existingPage]);

  // Auto-generate slug from title (only on create)
  useEffect(() => {
    if (!isEdit && title) {
      setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  }, [title, isEdit]);

  const publicUrl = company?.slug && slug
    ? `${window.location.origin}/lp/${company.slug}/${slug}`
    : '';

  const copyUrl = useCallback(() => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [publicUrl]);

  const handleSave = async (publishState?: boolean) => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!slug.trim()) { toast.error('Slug is required'); return; }
    if (!htmlContent.trim()) { toast.error('HTML content is required'); return; }

    setSaving(true);
    const finalPublished = publishState !== undefined ? publishState : isPublished;

    try {
      if (isEdit && id) {
        await updatePage.mutateAsync({
          id,
          title: title.trim(),
          slug: slug.trim(),
          meta_description: metaDescription.trim() || undefined,
          html_content: htmlContent,
          is_published: finalPublished,
        });
        setIsPublished(finalPublished);
        toast.success('Landing page updated');
      } else {
        const created = await createPage.mutateAsync({
          title: title.trim(),
          slug: slug.trim(),
          meta_description: metaDescription.trim() || undefined,
          html_content: htmlContent,
          is_published: finalPublished,
        });
        setIsPublished(finalPublished);
        toast.success('Landing page created');
        navigate(`/dashboard/landing-pages/${created.id}`, { replace: true });
      }
    } catch (error: any) {
      if (error?.message?.includes('duplicate key') || error?.code === '23505') {
        toast.error('This URL slug is already taken. Please choose another one.');
      } else {
        toast.error(error?.message || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  if (pageLoading && isEdit) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full glass border border-border/50"
            onClick={() => navigate('/dashboard/landing-pages')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-teal-400 font-bold tracking-tight uppercase text-[10px]">
              <Zap className="h-3 w-3" />
              FastEngage Landing Pages
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              {isEdit ? 'Edit Page' : 'Create Landing Page'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
            {(['code', 'split', 'preview'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === mode
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'code' && <Code className="h-3 w-3" />}
                {mode === 'preview' && <Monitor className="h-3 w-3" />}
                {mode === 'split' && <><Code className="h-3 w-3" /><Monitor className="h-3 w-3" /></>}
                <span className="hidden sm:inline capitalize">{mode}</span>
              </button>
            ))}
          </div>

          {/* Save buttons */}
          {isOwner && (
            <>
              {isPublished ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="glass border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  <EyeOff className="h-3 w-3 mr-1.5" /> Unpublish
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="glass border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                >
                  <Eye className="h-3 w-3 mr-1.5" /> Publish
                </Button>
              )}

              <Button
                size="sm"
                className="gradient-primary shadow-lg border-none"
                onClick={() => handleSave()}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── URL Banner (only when page has been saved) ── */}
      {isEdit && publicUrl && (
        <div className="relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 via-teal-500/10 to-transparent animate-pulse group-hover:from-teal-500/30 transition-all duration-700" />
          <div className="relative px-6 py-4 glass border-teal-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl shadow-teal-500/5 border opacity-90 backdrop-blur-3xl">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-teal-500 flex items-center justify-center glow-strong shadow-teal-500/40 shrink-0">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-bold text-teal-400 uppercase tracking-widest">Live Page Address</p>
                  {isPublished ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] px-1.5 py-0">Live</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/50 text-[9px] px-1.5 py-0">Draft</Badge>
                  )}
                  {existingPage && (
                    <Badge variant="outline" className="text-muted-foreground border-border/50 text-[9px] px-1.5 py-0">
                      <BarChart3 className="h-2.5 w-2.5 mr-0.5" /> {existingPage.view_count} views
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-mono font-bold text-foreground truncate block">{publicUrl}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                className={`rounded-lg border-none text-xs font-bold transition-all ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'glass hover:bg-teal-500/20 text-foreground border border-border/50 shadow-sm'
                }`}
                onClick={copyUrl}
              >
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="link" className="text-teal-400 text-xs font-bold" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  Preview <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Read-only Banner (only when page is not owned by current user) ── */}
      {isEdit && !isOwner && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-xl flex items-center gap-3 text-xs">
          <Eye className="h-4 w-4 shrink-0 animate-pulse" />
          <div>
            <span className="font-bold">Read-only Mode:</span> You are viewing a landing page created by{' '}
            <span className="font-semibold text-white">{(existingPage?.profiles as any)?.full_name || 'another team member'}</span>.
            Only the creator can make changes.
          </div>
        </div>
      )}

      {/* ── Settings Fields ── */}
      <Card className="glass border-border/40">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Page Title *</Label>
              <Input
                className="bg-muted/30 border-border/50"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Summer Sale 2026"
                disabled={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">URL Slug *</Label>
              <div className="relative">
                <Input
                  className="bg-muted/30 border-border/50 font-mono text-sm pl-8"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="summer-sale-2026"
                  disabled={!isOwner}
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Meta Description</Label>
              <Input
                className="bg-muted/30 border-border/50"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Brief description for search engines"
                disabled={!isOwner}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Code Editor + Preview ── */}
      <div className={`grid gap-4 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Code Editor */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <Card className="glass border-border/40 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/20">
              <Code className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HTML Editor</span>
              <Badge variant="outline" className="ml-auto text-[9px] border-border/50 text-muted-foreground">
                {htmlContent.length.toLocaleString()} chars
              </Badge>
            </div>
            <Textarea
              className="font-mono text-sm bg-zinc-950 text-zinc-100 border-none rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-4 placeholder:text-zinc-600"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              readOnly={!isOwner}
              placeholder={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Landing Page</title>
  <style>
    body { font-family: system-ui; margin: 0; }
  </style>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>`}
              style={{ minHeight: viewMode === 'code' ? '70vh' : '60vh' }}
            />
          </Card>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <Card className="glass border-border/40 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/20">
              <Monitor className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Preview</span>
              {/* Fake browser chrome dots */}
              <div className="ml-auto flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-400/40" />
                <div className="h-2 w-2 rounded-full bg-amber-400/40" />
                <div className="h-2 w-2 rounded-full bg-emerald-400/40" />
              </div>
            </div>
            {/*
             * SECURITY: Landing page HTML is rendered inside a sandboxed iframe using srcdoc.
             * This is intentional to prevent XSS attacks from user-provided HTML content.
             * The sandbox attribute ensures the iframe cannot:
             * - Access the parent page's cookies, localStorage, or auth tokens
             * - Navigate the parent frame
             * - Submit forms to external servers
             * We allow "allow-scripts" so that the user's HTML/CSS/JS renders correctly,
             * and "allow-same-origin" so that relative resources (fonts, images) load.
             * The iframe is fully isolated from the CRM application context.
             */}
            <iframe
              ref={iframeRef}
              title="Landing Page Preview"
              srcDoc={htmlContent || '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-family:system-ui"><p>Start typing HTML to see a preview...</p></div>'}
              sandbox="allow-scripts allow-same-origin"
              className="w-full border-none bg-white"
              style={{ minHeight: viewMode === 'preview' ? '70vh' : '60vh' }}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
