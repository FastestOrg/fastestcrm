import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  MoreHorizontal,
  Globe,
  Edit,
  Trash,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  BarChart3,
  FileCode,
  Zap,
  Loader2,
} from 'lucide-react';
import { useLandingPages, useDeleteLandingPage, useUpdateLandingPage, LandingPage } from '@/hooks/useLandingPages';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function LandingPages() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: pages, isLoading } = useLandingPages();
  const deletePage = useDeleteLandingPage();
  const updatePage = useUpdateLandingPage();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getPublicUrl = (page: LandingPage) =>
    `${window.location.origin}/lp/${company?.slug}/${page.slug}`;

  const copyUrl = (page: LandingPage) => {
    navigator.clipboard.writeText(getPublicUrl(page));
    setCopiedId(page.id);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePublish = async (page: LandingPage) => {
    try {
      await updatePage.mutateAsync({ id: page.id, is_published: !page.is_published });
      toast.success(page.is_published ? 'Page unpublished' : 'Page published!');
    } catch {
      toast.error('Failed to update page status');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePage.mutateAsync(deleteId);
      toast.success('Landing page deleted');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete page');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-teal-400 font-bold tracking-tight uppercase text-[10px]">
            <Zap className="h-3 w-3" />
            FastEngage Landing Pages
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Landing Pages
          </h1>
          <p className="text-muted-foreground text-xs max-w-md">
            Create and publish custom HTML landing pages. Each page gets a unique public URL.
          </p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/landing-pages/new')}
          className="gradient-primary shadow-lg border-none w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Page
        </Button>
      </div>

      {/* Main Card */}
      <Card className="glass border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-teal-400" />
            All Pages
          </CardTitle>
          <CardDescription>Manage your landing pages and track performance.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {/* ── Mobile Card View ── */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
                <span className="text-sm text-muted-foreground">Loading pages...</span>
              </div>
            ) : !pages?.length ? (
              <EmptyState onCreateClick={() => navigate('/dashboard/landing-pages/new')} />
            ) : (
              pages.map((page) => (
                <div key={page.id} className="flex items-start justify-between gap-3 px-4 py-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Globe className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug break-words">{page.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <span className="text-xs text-muted-foreground font-mono">/{page.slug}</span>
                        <StatusBadge published={page.is_published} />
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" /> {page.view_count} views
                        </span>
                      </div>
                    </div>
                  </div>
                  <PageActions
                    page={page}
                    copiedId={copiedId}
                    currentUserId={user?.id}
                    onEdit={() => navigate(`/dashboard/landing-pages/${page.id}`)}
                    onCopy={() => copyUrl(page)}
                    onPreview={() => window.open(getPublicUrl(page), '_blank')}
                    onTogglePublish={() => togglePublish(page)}
                    onDelete={() => setDeleteId(page.id)}
                  />
                </div>
              ))
            )}
          </div>

          {/* ── Desktop Table View ── */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>URL Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
                        <span className="text-sm text-muted-foreground">Loading pages...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !pages?.length ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState onCreateClick={() => navigate('/dashboard/landing-pages/new')} />
                    </TableCell>
                  </TableRow>
                ) : (
                  pages.map((page) => (
                    <TableRow key={page.id} className="group">
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-teal-400" />
                          <span className="truncate max-w-[200px]">{page.title}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded font-mono">
                            /{page.slug}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyUrl(page)}
                          >
                            {copiedId === page.id ? (
                              <Check className="h-3 w-3 text-green-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge published={page.is_published} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {page.view_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {(page.profiles as any)?.full_name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {format(new Date(page.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <PageActions
                          page={page}
                          copiedId={copiedId}
                          currentUserId={user?.id}
                          onEdit={() => navigate(`/dashboard/landing-pages/${page.id}`)}
                          onCopy={() => copyUrl(page)}
                          onPreview={() => window.open(getPublicUrl(page), '_blank')}
                          onTogglePublish={() => togglePublish(page)}
                          onDelete={() => setDeleteId(page.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="glass-strong border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Landing Page?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The public URL will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass border-border/50">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] px-2 py-0">
      <Eye className="h-2.5 w-2.5 mr-1" /> Published
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground border-border/50 text-[10px] px-2 py-0">
      <EyeOff className="h-2.5 w-2.5 mr-1" /> Draft
    </Badge>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 px-4">
      <div className="h-20 w-20 rounded-full bg-teal-500/10 flex items-center justify-center">
        <Globe className="h-10 w-10 text-teal-400/40" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-bold">No Landing Pages Yet</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create your first landing page to start capturing leads from custom HTML pages.
        </p>
      </div>
      <Button onClick={onCreateClick} className="gradient-primary border-none shadow-lg mt-2">
        <Plus className="h-4 w-4 mr-2" /> Create Your First Page
      </Button>
    </div>
  );
}

function PageActions({
  page,
  copiedId,
  currentUserId,
  onEdit,
  onCopy,
  onPreview,
  onTogglePublish,
  onDelete,
}: {
  page: LandingPage;
  copiedId: string | null;
  currentUserId?: string;
  onEdit: () => void;
  onCopy: () => void;
  onPreview: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const isOwner = page.created_by === currentUserId;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isOwner ? (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" /> Edit Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPreview}>
              <ExternalLink className="h-4 w-4 mr-2" /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              {copiedId === page.id ? (
                <Check className="h-4 w-4 mr-2 text-green-400" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copy URL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onTogglePublish}>
              {page.is_published ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" /> Unpublish
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" /> Publish
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <Eye className="h-4 w-4 mr-2" /> View Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPreview}>
              <ExternalLink className="h-4 w-4 mr-2" /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              {copiedId === page.id ? (
                <Check className="h-4 w-4 mr-2 text-green-400" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copy URL
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
