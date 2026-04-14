import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, Book, ArrowRight, Brain, Zap, Shield } from 'lucide-react';
import SEO from '@/components/SEO';
import { glossaryTerms } from '@/data/glossary';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import { SoftwareAppSchema, OrganizationSchema } from '@/components/SchemaMarkup';

const GlossaryPage: React.FC = () => {
  const categories = ['Fundamentals', 'AI', 'Sales', 'Technical'];

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="CRM & Sales Glossary | Learn Everything About AI CRM"
        description="Master Customer Relationship Management with our comprehensive CRM glossary. Define and understand AI CRM, Auto Dialers, Lead Management, and more."
        keywords="crm glossary, sales terms, what is crm, ai crm definitions, sales automation dictionary"
      />
      <SoftwareAppSchema />
      <OrganizationSchema />

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/register-company">
              <Button size="sm" className="gradient-primary" style={{ color: 'hsl(222 28% 5%)' }}>Start Learning</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden bg-primary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <Book className="h-12 w-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
            The <span className="gradient-text">CRM Dictionary</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Master the language of sales automation and AI. Your definitive guide to winning more deals.
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search a term (e.g. AI CRM)..." 
              className="w-full h-14 pl-12 pr-4 rounded-full border border-border bg-card/50 backdrop-blur-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* ── Breadcrumbs ── */}
      <BreadcrumbSection items={[{ name: 'Glossary', path: '/glossary' }]} />

      {/* ── Categories ── */}
      <section className="py-20 px-6">
        <div className="container mx-auto grid lg:grid-cols-4 gap-12">
          <div className="lg:col-span-3">
            {categories.map(cat => (
              <div key={cat} className="mb-20 last:mb-0">
                <div className="flex items-center gap-3 mb-10 border-b border-border/50 pb-4">
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{cat}</h2>
                  <span className="px-3 py-1 bg-secondary rounded-full text-xs font-bold text-muted-foreground">
                    {glossaryTerms.filter(t => t.category === cat).length} Terms
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {glossaryTerms.filter(t => t.category === cat).map(term => (
                    <Link 
                      key={term.slug}
                      to={`/glossary/${term.slug}`}
                      className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/40 transition-all card-hover"
                    >
                      <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{term.term}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{term.definition}</p>
                      <div className="flex items-center text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Read Definition <ArrowRight className="ml-1 h-3 w-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="p-8 rounded-3xl bg-primary/5 border border-primary/20 sticky top-24">
              <Zap className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>Calculators & Tools</h3>
              <p className="text-sm text-muted-foreground mb-6">Apply these concepts with our free sales utilities.</p>
              <div className="space-y-4">
                <Link to="/tools" className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all group">
                  <span className="text-sm font-semibold">ROI Calculator</span>
                  <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                </Link>
                <div className="p-4 rounded-xl bg-card/40 border border-border/30 opacity-60">
                  <span className="text-sm font-semibold">Commission Tool</span>
                  <span className="text-[10px] block font-bold text-primary uppercase mt-1">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 border-t border-border/50 text-center">
        <p className="text-sm text-muted-foreground">© 2025 Fastest CRM. Master Sales Automation.</p>
      </footer>
    </div>
  );
};

export default GlossaryPage;
