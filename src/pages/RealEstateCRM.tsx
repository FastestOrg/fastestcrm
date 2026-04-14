import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Users, Phone, CreditCard, Workflow,
  Brain, ArrowRight, Zap, Target, TrendingUp, Menu, X, ChevronDown, Building2, MapPin, Eye
} from 'lucide-react';
import SEO from '@/components/SEO';
import { FAQSchema, SoftwareAppSchema, OrganizationSchema, BreadcrumbSchema } from '@/components/SchemaMarkup';
import { isAndroidWebView } from '@/lib/platform';

const features = [
  {
    icon: Building2,
    title: 'Property Matching',
    description: 'Automatically match leads with available properties based on their budget, location, and configuration preferences.'
  },
  {
    icon: MapPin,
    title: 'Site Visit Tracking',
    description: 'Schedule and track site visits with automated reminders for both sales reps and prospective buyers.'
  },
  {
    icon: Phone,
    title: 'Real Estate Auto-Dialer',
    description: 'Call hundreds of property inquiries sequentially. Update interest levels instantly after each call.'
  },
  {
    icon: Brain,
    title: 'AI Lead Profiling',
    description: 'Gemini AI analyzes lead conversations to predict closure probability and intent for specific projects.'
  },
  {
    icon: CreditCard,
    title: 'Booking Payments',
    description: 'Collect token amounts or booking fees via Razorpay links. Auto-assign lead to "Booked" status.'
  },
  {
    icon: Workflow,
    title: 'Channel Partner Portal',
    description: 'Manage leads from external brokers and channel partners with dedicated hierarchy and transparent tracking.'
  }
];

const faqs = [
  { q: 'Can I manage multiple projects in this CRM?', a: 'Yes! Fastest CRM allows you to create separate property listings and lead funnels for multiple real estate projects simultaneously.' },
  { q: 'Does it support lead import from MagicBricks/99acres?', a: 'Absolutely. You can import CSVs from any portal or use our API hooks to automate lead capture from property portals.' },
  { q: 'How does the team hierarchy work for Real Estate?', a: 'You can set up a multi-level hierarchy (e.g., Director > VP > Managers > Sales Reps) to ensure data is visible only to relevant team members.' },
  { q: 'Is there a mobile app for site visits?', a: 'Yes, our mobile-responsive web app and Android app are perfect for sales reps to update lead status right from the project site.' }
];

export default function RealEstateCRM() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const isWebView = isAndroidWebView();

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="Best Real Estate CRM in India | AI-Powered Sales Automation"
        description="The fastest AI CRM built specifically for Indian Real Estate teams. Manage site visits, automate calling, and track property bookings with ease."
        keywords="real estate crm india, property management software, site visit tracking, lead management for builders, real estate sales automation"
        canonical="https://www.fastestcrm.com/crm-for-real-estate"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', item: 'https://www.fastestcrm.com' },
        { name: 'Real Estate CRM', item: 'https://www.fastestcrm.com/crm-for-real-estate' }
      ]} />
      <SoftwareAppSchema />
      <OrganizationSchema />
      <FAQSchema faqs={faqs.map(f => ({ question: f.q, answer: f.a }))} />

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="text-sm font-medium">Blog</Button>
            </Link>
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

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-40" />
        <div className="container mx-auto text-center max-w-5xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-10 border-primary/30">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold tracking-wide text-foreground/80 uppercase">Built for Real Estate Growth</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            The #1 AI CRM for <span className="gradient-text">Real Estate Teams</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Close more property deals with automated site visit scheduling, AI-powered lead profiling, and India's fastest auto-dialer.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register-company">
              <Button size="lg" className="h-14 px-10 text-base rounded-full gradient-primary font-bold shadow-xl" style={{ color: 'hsl(222 28% 5%)' }}>
                Get Started for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-14 px-10 text-base rounded-full border-primary/30">
                Book a Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
              Real Estate <span className="gradient-text">Power Features</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Tailored tools to help builders and brokers manage complex sales cycles effortlessly.
            </p>
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

      {/* ── FAQ ── */}
      <section className="py-24 px-6 border-y border-border/40">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-14 text-center" style={{ fontFamily: "'Syne', sans-serif" }}>
            Real Estate <span className="gradient-text">FAQs</span>
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
                <button
                  className="w-full flex justify-between items-center font-semibold px-6 py-5 text-left hover:bg-muted/10 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-primary transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-2">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto glass p-12 rounded-3xl border-primary/20">
          <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>Ready to scale your Real Estate sales?</h2>
          <p className="text-lg text-muted-foreground mb-10">Join top real estate developers using AI to close deals 3x faster.</p>
          <Link to="/register-company">
            <Button size="lg" className="h-14 px-12 text-base rounded-full gradient-primary font-bold" style={{ color: 'hsl(222 28% 5%)' }}>
              Start for Free Today
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Simple Footer ── */}
      <footer className="py-12 px-6 border-t border-border/50 text-center text-sm text-muted-foreground">
        © 2025 Fastest CRM. All rights reserved.
      </footer>
    </div>
  );
}
