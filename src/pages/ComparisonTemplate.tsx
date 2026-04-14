import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Shield, Phone, Brain, Users, CreditCard } from 'lucide-react';
import SEO from '@/components/SEO';
import FAQSection from '@/components/features/FAQSection';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import ComparisonTable from '@/components/features/ComparisonTable';
import { SoftwareAppSchema, OrganizationSchema, LocalBusinessBengaluruSchema, LocalBusinessSFSchema } from '@/components/SchemaMarkup';
import AuthorityFooter from '@/components/layout/AuthorityFooter';

interface ComparisonTemplateProps {
  competitor: string;
  title: string;
  description: string;
  highlights: {
    feature: string;
    us: string;
    them: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

const ComparisonTemplate: React.FC<ComparisonTemplateProps> = ({
  competitor,
  title,
  description,
  highlights,
  faqs
}) => {
  const keywords = `Fastest CRM vs ${competitor}, best crm vs ${competitor}, AI CRM comparison, fast crm india, sales automation vs ${competitor}`;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title={title}
        description={description}
        keywords={keywords}
      />
      <SoftwareAppSchema />
      <OrganizationSchema />
      <LocalBusinessBengaluruSchema />
      <LocalBusinessSFSchema />

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
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="hidden md:flex">Login</Button>
            </Link>
            <Link to="/register-company">
              <Button size="sm" className="gradient-primary" style={{ color: 'hsl(222 28% 5%)' }}>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Breadcrumbs ── */}
      <div className="pt-24">
        <BreadcrumbSection items={[{ name: `Vs ${competitor}`, path: `/vs/${competitor.toLowerCase().replace(/\s+/g, '-')}` }]} />
      </div>

      {/* ── Hero ── */}
      <section className="pt-12 pb-24 px-6 relative overflow-hidden text-center">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30" />
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
            Fastest CRM vs <span className="gradient-text">{competitor}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            Choosing between speed and legacy? See why high-growth sales teams are switching from {competitor} to India's first AI-powered CRM.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register-company">
              <Button size="lg" className="gradient-primary h-14 px-10 rounded-full font-bold" style={{ color: 'hsl(222 28% 5%)' }}>
                Try the Faster Alternative
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="py-24 px-6 relative">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
              Direct <span className="gradient-text">Comparison</span>
            </h2>
            <p className="text-muted-foreground">The numbers and features don't lie. Speed is our superpower.</p>
          </div>
          <ComparisonTable competitor={competitor} rows={highlights} />
        </div>
      </section>

      {/* ── Why Switch? ── */}
      <section className="py-24 px-6 bg-secondary/10">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
                Built for the <span className="gradient-text">Indian Speed</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Legacy CRMs like {competitor} were built for a different era. Fastest CRM is built for the mobile-first, AI-driven Indian market with built-in calling and payment collections.
              </p>
              <ul className="space-y-4">
                {[
                  'Instant lead delivery to agents',
                  'Localized UPI and Razorpay payment links',
                  'AI-powered lead prioritization',
                  '12-level hierarchy for Indian business structures'
                ].map((item, id) => (
                  <li key={id} className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary shrink-0 mt-1" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass p-1 rounded-3xl overflow-hidden shadow-2xl skew-y-1">
               <div className="bg-card w-full h-[400px] flex items-center justify-center">
                   <div className="text-center">
                       <Zap className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
                       <span className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>10X Faster Implementation</span>
                   </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FAQSection 
        title={`Fastest CRM vs ${competitor} Comparison FAQs`}
        subtitle="Common questions from switchers"
        items={faqs} 
      />

      {/* ── CTA ── */}
      <section className="py-24 px-6 text-center bg-primary/5">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-8" style={{ fontFamily: "'Syne', sans-serif" }}>
            Experience the <span className="gradient-text">Difference</span>
          </h2>
          <Link to="/register-company">
            <Button size="lg" className="gradient-primary h-16 px-12 text-lg rounded-full font-bold" style={{ color: 'hsl(222 28% 5%)' }}>
               Start Your Free Trial
               <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </Link>
          <p className="mt-6 text-muted-foreground">Join 1,000+ teams who chose speed over complexity.</p>
        </div>
      </section>

      <AuthorityFooter />
    </div>
  );
};

export default ComparisonTemplate;
