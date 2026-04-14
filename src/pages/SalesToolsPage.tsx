import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calculator, Zap, Brain, ArrowRight, TrendingUp, Users, Shield, Book } from 'lucide-react';
import SEO from '@/components/SEO';
import ROICalculator from '@/components/tools/ROICalculator';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import { SoftwareAppSchema, OrganizationSchema } from '@/components/SchemaMarkup';

const SalesToolsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="Free Sales Tools & Calculators | Fastest CRM ROI Tool"
        description="Calculate your sales ROI, conversion lift, and time savings with our free CRM tools. Built for high-growth Indian sales teams and startups."
        keywords="sales roi calculator, crm cost calculator, free sales tools, lead conversion calculator, fastest crm tools"
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
              <Button size="sm" className="gradient-primary" style={{ color: 'hsl(222 28% 5%)' }}>Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden text-center">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30" />
        <div className="container mx-auto max-w-4xl">
           <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase mb-8">
              <Calculator className="h-4 w-4" />
              Free Sales Utilities
           </div>
           <h1 className="text-4xl md:text-7xl font-bold mb-8" style={{ fontFamily: "'Syne', sans-serif" }}>
             Data-Driven <span className="gradient-text">Sales Success</span>
           </h1>
           <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
             Stop guessing. Use our free calculators to see exactly how much revenue you're leaving on the table and how to capture it.
           </p>
        </div>
      </section>

      {/* ── Breadcrumbs ── */}
      <BreadcrumbSection items={[{ name: 'Sales Tools', path: '/tools' }]} />

      {/* ── ROI Calculator Section ── */}
      <section className="py-24 px-6 relative">
        <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
                    CRM <span className="gradient-text">ROI Calculator</span>
                </h2>
                <p className="text-muted-foreground text-lg">Input your current numbers to see the impact of AI-powered automation.</p>
            </div>
            <ROICalculator />
        </div>
      </section>

      {/* ── Knowledge Hub Cross-Link ── */}
      <section className="py-24 px-6 border-t border-border/50">
        <div className="container mx-auto max-w-4xl">
           <div className="bg-primary/5 rounded-3xl p-10 border border-primary/20 flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 text-center md:text-left">
                 <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>Master the <span className="gradient-text">Concepts</span></h2>
                 <p className="text-muted-foreground mb-6 text-lg">
                   Don't just use the tools—understand the science of sales automation. Explore our comprehensive CRM glossary.
                 </p>
                 <Link to="/glossary">
                    <Button size="lg" className="rounded-full gap-2 px-8">
                       Explore Glossary
                       <ArrowRight className="h-5 w-5" />
                    </Button>
                 </Link>
              </div>
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl bg-card border border-border/50 flex items-center justify-center rotate-3 shadow-xl">
                 <Book className="h-16 w-16 text-primary" />
              </div>
           </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 border-t border-border/50 text-center">
        <p className="text-sm text-muted-foreground">© 2025 Fastest CRM. Empowering Sales through Data.</p>
      </footer>
    </div>
  );
};

export default SalesToolsPage;
