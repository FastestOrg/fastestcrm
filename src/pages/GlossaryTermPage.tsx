import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Brain, Zap, Shield, BookOpen } from 'lucide-react';
import SEO from '@/components/SEO';
import { glossaryTerms } from '@/data/glossary';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import { SoftwareAppSchema, OrganizationSchema } from '@/components/SchemaMarkup';

const GlossaryTermPage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const term = glossaryTerms.find(t => t.slug === slug);

  React.useEffect(() => {
    if (!term) {
      navigate('/glossary');
    }
    window.scrollTo(0, 0);
  }, [term, navigate]);

  if (!term) return null;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title={`${term.term} | CRM Glossary Definition`}
        description={term.definition}
        keywords={`${term.term}, crm definition, sales automation, ${term.category} glossary`}
      />
      <SoftwareAppSchema />
      <OrganizationSchema />

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/glossary">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Glossary
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/register-company">
              <Button size="sm" className="gradient-primary" style={{ color: 'hsl(222 28% 5%)' }}>Get Starter Plan</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30" />
        <div className="container mx-auto max-w-4xl">
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase mb-6">
              <BookOpen className="h-3 w-3" />
              {term.category} Definition
           </div>
           <h1 className="text-4xl md:text-6xl font-bold mb-8" style={{ fontFamily: "'Syne', sans-serif" }}>
             {term.term}
           </h1>
           <p className="text-2xl text-muted-foreground leading-relaxed italic border-l-4 border-primary pl-6">
             {term.definition}
           </p>
        </div>
      </section>

      {/* ── Breadcrumbs ── */}
      <BreadcrumbSection items={[
        { name: 'Glossary', path: '/glossary' },
        { name: term.term, path: `/glossary/${term.slug}` }
      ]} />

      {/* ── Content ── */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="prose prose-lg dark:prose-invert max-w-none mb-16">
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>Detailed Explanation</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              {term.fullDescription}
            </p>
            <p className="text-muted-foreground leading-relaxed text-lg mt-6">
              In the context of modern sales automation, understanding **{term.term}** is essential for scaling teams. At Fastest CRM, we prioritize high-velocity workflows that incorporate this concept into every lead interaction.
            </p>
          </div>

          {/* ── CTA Card ── */}
          <div className="p-10 rounded-3xl bg-secondary/20 border border-border/50 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
            <h3 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>Ready to apply this to your business?</h3>
            <p className="text-muted-foreground mb-8">Fastest CRM makes {term.term.toLowerCase()} easier than ever for high-growth teams.</p>
            <Link to="/register-company">
              <Button size="lg" className="gradient-primary h-14 px-10 rounded-full font-bold" style={{ color: 'hsl(222 28% 5%)' }}>
                Join Fastest CRM for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 border-t border-border/50 text-center">
        <p className="text-sm text-muted-foreground">© 2025 Fastest CRM. Defined for Success.</p>
      </footer>
    </div>
  );
};

export default GlossaryTermPage;
