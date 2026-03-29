import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Users, Phone, CreditCard, Workflow,
  Brain, ArrowRight, Zap, Target, TrendingUp, Menu, X, ChevronDown, Database, Cloud, Code
} from 'lucide-react';
import SEO from '@/components/SEO';
import { FAQSchema, SoftwareAppSchema, OrganizationSchema, BreadcrumbSchema } from '@/components/SchemaMarkup';
import { isAndroidWebView } from '@/lib/platform';

const features = [
  {
    icon: Database,
    title: 'Trial Management',
    description: 'Track PLG (Product-Led Growth) motions with automated trial conversion tracking and in-app activity signals.'
  },
  {
    icon: Cloud,
    title: 'Multi-Tenant Security',
    description: 'Role-based access control with 12-level hierarchy. Ensure sales reps only see assigned company data.'
  },
  {
    icon: Phone,
    title: 'Sales Outbound Dialer',
    description: 'High-velocity calling for SDR/BDR teams. Integrated Zapier triggers for lead replenishment.'
  },
  {
    icon: Brain,
    title: 'Predictive Lead Scoring',
    description: 'Gemini AI analyzes firmographic and behavioral data to predict the lifetime value (LTV) of B2B leads.'
  },
  {
    icon: CreditCard,
    title: 'SaaS Subscription Billing',
    description: 'Razorpay integration for subscription payments. Auto-update MRR tracking when a deal is closed.'
  },
  {
    icon: Code,
    title: 'API-First Architecture',
    description: 'Easily integrate with your product using our REST API. Sync user sign-ups directly into the CRM.'
  }
];

const faqs = [
  { q: 'Is it suitable for high-velocity SaaS sales?', a: 'Yes! Fastest CRM is built for speed. Use our auto-dialer and workflow automation to close B2B deals at scale.' },
  { q: 'Can I integrate my app signups?', a: 'Definitely. Use our Webhooks or REST API to automatically push new signups into the CRM as leads.' },
  { q: 'How do you handle team commissions?', a: 'You can define custom statuses like "Paid" or "Contract Signed" and use our reporting module to calculate sales rep performance.' },
  { q: 'Is there a developer SDK?', a: 'We provide extensive documentation and API access for developers to build custom integrations and reporting layers.' }
];

export default function SaasCRM() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="Best B2B SaaS CRM in India | AI Sales Automation"
        description="The fastest AI CRM for SaaS startups. Manage your B2B sales pipeline, trials, and subscription payments with intelligent automation."
        keywords="saas crm india, b2b sales software, startup crm, lead tracking for saas, cloud sales automation"
        canonical="https://fastestcrm.com/crm-for-saas"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', item: 'https://fastestcrm.com' },
        { name: 'SaaS CRM', item: 'https://fastestcrm.com/crm-for-saas' }
      ]} />
      <SoftwareAppSchema />
      <OrganizationSchema />
      <FAQSchema faqs={faqs.map(f => ({ question: f.q, answer: f.a }))} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm font-medium">Login</Button>
            </Link>
            <Link to="/register-company">
              <Button size="sm" className="gradient-primary text-xs font-semibold px-5" style={{ color: 'hsl(222 28% 5%)' }}>
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative pt-36 pb-24 px-6 overflow-hidden text-center">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-40" />
        <div className="container mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-10 border-primary/30">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold tracking-wide text-foreground/80 uppercase">Engineered for B2B Startups</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            The CRM for <span className="gradient-text">Fast-Growth SaaS</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Manage your B2B sales funnel with AI lead scoring, high-velocity outbound dialing, and seamless Razorpay billing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register-company">
              <Button size="lg" className="h-14 px-10 text-base rounded-full gradient-primary font-bold shadow-xl" style={{ color: 'hsl(222 28% 5%)' }}>
                Start Scaling Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-14 px-10 text-base rounded-full border-primary/30">
                View API Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
              B2B <span className="gradient-text">Scalability Features</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/40 transition-all card-hover">
                <div className="w-12 h-12 rounded-xl border border-primary/30 bg-primary/8 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "'Syne', sans-serif" }}>{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-border/50 text-center text-sm text-muted-foreground">
        © 2025 Fastest CRM. All rights reserved.
      </footer>
    </div>
  );
}
