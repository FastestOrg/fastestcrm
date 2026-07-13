import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Zap, Brain, Shield } from 'lucide-react';
import SEO from '@/components/SEO';
import FAQSection from '@/components/features/FAQSection';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import { SoftwareAppSchema, OrganizationSchema, LocalBusinessBengaluruSchema, LocalBusinessSFSchema } from '@/components/SchemaMarkup';
import AuthorityFooter from '@/components/layout/AuthorityFooter';

interface RegionalSolutionProps {
  city: string;
  title: string;
  description: string;
  keywords: string;
  highlights: string[];
}

const RegionalSolutionTemplate: React.FC<RegionalSolutionProps> = ({
  city,
  title,
  description,
  keywords,
  highlights
}) => {
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
        <BreadcrumbSection items={[{ name: `CRM in ${city}`, path: `/solutions/${city.toLowerCase().replace(/\s+/g, '-')}` }]} />
      </div>

      {/* ── Hero ── */}
      <section className="pt-12 pb-24 px-6 relative overflow-hidden text-center">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30" />
        <div className="container mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold">
            <MapPin className="h-4 w-4" />
            <span>Best CRM for Businesses in {city}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
            The <span className="gradient-text">Fastest AI CRM</span> for Sales Teams in {city}
          </h1>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register-company">
              <Button size="lg" className="gradient-primary h-14 px-10 rounded-full font-bold" style={{ color: 'hsl(222 28% 5%)' }}>
                Join {city}'s Top Sales Teams
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Local Highlights ── */}
      <section className="py-24 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
              Why {city} Chooses <span className="gradient-text">Fastest CRM</span>
            </h2>
            <p className="text-muted-foreground">Tailored for the unique needs of the {city} business ecosystem.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {highlights.map((highlight, i) => (
              <div key={i} className="p-8 rounded-2xl bg-card border border-border/50 card-hover">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{highlight}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Experience the localized benefits of using India's fastest CRM tailored for {city}.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Core Value Props ── */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-3 gap-12">
                <div className="text-center">
                    <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Native AI Integration</h3>
                    <p className="text-muted-foreground text-sm">Powered by FastAI for intelligent lead insights.</p>
                </div>
                <div className="text-center">
                    <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Ultra-Fast Performance</h3>
                    <p className="text-muted-foreground text-sm">Optimized local servers for zero-latency in India.</p>
                </div>
                <div className="text-center">
                    <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Enterprise Security</h3>
                    <p className="text-muted-foreground text-sm">Role-based access and data residency in India.</p>
                </div>
            </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FAQSection 
        title={`Fastest CRM in ${city} - FAQs`}
        items={[
          { question: `Do you offer local support in ${city}?`, answer: `Yes, we have localized support teams and offer in-person training for enterprise clients in ${city}.` },
          { question: `Is my business data stored in India?`, answer: `Absolutely. We adhere to local data residency requirements with all data stored securely in Indian data centers.` }
        ]} 
      />

      {/* ── CTA ── */}
      <section className="py-24 px-6 text-center">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-8" style={{ fontFamily: "'Syne', sans-serif" }}>
            Ready to <span className="gradient-text">Automate</span>?
          </h2>
          <Link to="/register-company">
            <Button size="lg" className="gradient-primary h-16 px-12 text-lg rounded-full font-bold" style={{ color: 'hsl(222 28% 5%)' }}>
               Start Your Free Trial
               <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </Link>
        </div>
      </section>

      <AuthorityFooter />
    </div>
  );
};

export default RegionalSolutionTemplate;
