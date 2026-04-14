import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Brain, Zap, Target, TrendingUp, 
  Users, Phone, CreditCard, Workflow, Shield
} from 'lucide-react';
import SEO from '@/components/SEO';
import FAQSection from '@/components/features/FAQSection';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import { SoftwareAppSchema, OrganizationSchema, LocalBusinessBengaluruSchema, LocalBusinessSFSchema } from '@/components/SchemaMarkup';
import AuthorityFooter from '@/components/layout/AuthorityFooter';

interface IndustrySolutionProps {
  industry: string;
  icon: string;
  title: string;
  description: string;
  keywords: string;
  features: {
    icon: any;
    title: string;
    description: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

const IndustrySolutionTemplate: React.FC<IndustrySolutionProps> = ({
  industry,
  icon,
  title,
  description,
  keywords,
  features,
  faqs
}) => {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title={`${title} | Fastest CRM`}
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
              <Button size="sm" className="gradient-primary">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Breadcrumbs ── */}
      <div className="pt-24">
        <BreadcrumbSection items={[{ name: industry, path: `/solutions/${industry.toLowerCase().replace(/\s+/g, '-')}` }]} />
      </div>

      {/* ── Hero ── */}
      <section className="pt-12 pb-24 px-6 relative overflow-hidden text-center">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30" />
        <div className="container mx-auto max-w-4xl">
          <div className="text-6xl mb-8 group-hover:scale-110 transition-transform duration-300 ring-4 ring-primary/10 rounded-full inline-block p-4">
            {icon}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
            The Fastest CRM for <span className="gradient-text">{industry}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register-company">
              <Button size="lg" className="gradient-primary h-14 px-10 rounded-full font-bold">
                Boost Your {industry} Sales
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Industry Specific Features ── */}
      <section className="py-24 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
              Tailored for <span className="gradient-text">{industry} Workflow</span>
            </h2>
            <p className="text-muted-foreground">Pre-configured fields and automations that actually work for your business.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl bg-card border border-border/50 card-hover">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FAQSection 
        title={`${industry} CRM FAQs`}
        items={faqs} 
      />

      <AuthorityFooter />
    </div>
  );
};

export default IndustrySolutionTemplate;
