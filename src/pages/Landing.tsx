import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Users, Phone, CreditCard, Workflow,
  Brain, ArrowRight, Zap, Target, TrendingUp, Menu, X, ChevronDown
} from 'lucide-react';
import SEO from '@/components/SEO';
import { FAQSchema, SoftwareAppSchema, OrganizationSchema, LocalBusinessBengaluruSchema, LocalBusinessSFSchema } from '@/components/SchemaMarkup';
import FAQSection from '@/components/features/FAQSection';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import AuthorityFooter from '@/components/layout/AuthorityFooter';
import { Star, CheckCircle2, MessageSquare, Quote, Newspaper } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Lead Management',
    description: 'Track every lead from generation to conversion with smart status tracking and ownership assignment.'
  },
  {
    icon: Brain,
    title: 'AI Analytics (FastAI)',
    description: 'Get intelligent insights, conversion predictions, and AI-powered recommendations for every lead.'
  },
  {
    icon: Phone,
    title: 'Auto Dialer',
    description: 'Sequential calling with one click. Update status instantly after each call.'
  },
  {
    icon: Users,
    title: 'Team Hierarchy',
    description: '12-level hierarchy from CA to Company. Role-based access ensures data security.'
  },
  {
    icon: CreditCard,
    title: 'Payment Links',
    description: 'Razorpay integration for instant payment collection. Auto-update lead status on payment.'
  },
  {
    icon: Workflow,
    title: 'Workflow Automation',
    description: 'Rule-based triggers and actions. Automate follow-ups, notifications, and lead assignments.'
  }
];

const benefits = [
  { icon: Zap, label: 'Faster Closures', text: 'Close deals faster with AI-prioritized leads' },
  { icon: Target, label: 'Zero Missed Leads', text: 'Automate follow-ups, never miss an opportunity' },
  { icon: TrendingUp, label: 'Real-time Revenue', text: 'Track revenue in real-time from lead to payment' }
];

const faqs = [
  { q: 'Is there a free trial?', a: 'Yes! You can start with a free trial to explore all features. No credit card required.' },
  { q: 'Can I import my existing leads?', a: 'Absolutely. We support CSV imports and integrations with major platforms like Meta, Google Ads, and more.' },
  { q: 'Is my data secure?', a: 'Security is our top priority. We use enterprise-grade encryption and role-based access control to keep your data safe.' },
  { q: 'Do you offer support?', a: 'Yes, we provide email and chat support to help you get the most out of Fastest CRM.' },
  { q: 'What industries do you support?', a: 'We support Real Estate, EdTech, Training Institutes, Finance, Healthcare, SaaS, and many more. Each industry gets tailored lead fields.' }
];

const industries = [
  { name: 'Real Estate', icon: '🏢', path: '/crm-for-real-estate' },
  { name: 'EdTech', icon: '🎓', path: '/crm-for-edtech' },
  { name: 'Training Institutes', icon: '📚', path: '/solutions/bangalore' },
  { name: 'Travel & Hospitality', icon: '✈️', path: '/solutions/mumbai' },
  { name: 'Finance & Loans', icon: '💰', path: '/solutions/delhi' },
  { name: 'SaaS & B2B', icon: '💻', path: '/crm-for-saas' },
  { name: 'Healthcare & Clinics', icon: '🏥', path: '/crm-for-healthcare' },
  { name: 'Consultancy', icon: '🤝', path: '/solutions/hyderabad' }
];

import { isAndroidWebView } from '@/lib/platform';

export default function Landing() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const isWebView = isAndroidWebView();

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="India's Fastest AI CRM for Sales Teams | Fast CRM for Startups"
        description="Ranked #1 Fastest CRM in India. Transform your sales with the most advanced AI CRM. Automated lead tracking, fast calling, and Razorpay payments. Built for high-growth Indian sales teams."
        keywords="Fastest CRM, Fast CRM, AI CRM, best AI CRM India, sales CRM for startups, real estate lead management, edtech sales software, saas crm india, auto dialer crm, sales automation tool india"
      />
      <SoftwareAppSchema />
      <OrganizationSchema />
      <LocalBusinessBengaluruSchema />
      <LocalBusinessSFSchema />

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            <Link to="/tools">
              <Button variant="ghost" size="sm" className="hover:bg-primary/8 hover:text-primary transition-colors text-sm font-medium">
                Tools
              </Button>
            </Link>
            <Link to="/glossary">
              <Button variant="ghost" size="sm" className="hover:bg-primary/8 hover:text-primary transition-colors text-sm font-medium">
                Glossary
              </Button>
            </Link>
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="hover:bg-primary/8 hover:text-primary transition-colors text-sm font-medium">
                Blog
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="hover:bg-primary/8 hover:text-primary transition-colors text-sm font-medium ml-2">
                Login
              </Button>
            </Link>
            <Link to="/register-company">
              <Button
                size="sm"
                className="gradient-primary shimmer-overlay font-semibold px-5 shadow-lg hover:opacity-90 transition-opacity text-xs"
                style={{ color: 'hsl(222 28% 5%)' }}
              >
                Register Company
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background/97 backdrop-blur-md border-b border-border/50 p-6 flex flex-col gap-3 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
            <Link to="/tools" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-base font-medium">Sales Tools</Button>
            </Link>
            <Link to="/glossary" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-base font-medium">CRM Glossary</Button>
            </Link>
            <Link to="/blog" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-base font-medium">Blog</Button>
            </Link>
            <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-base font-medium">Login</Button>
            </Link>
            <Link to="/register-company" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full gradient-primary font-semibold text-base h-12" style={{ color: 'hsl(222 28% 5%)' }}>
                Register Company
              </Button>
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden" aria-labelledby="hero-heading">
        {/* Dot-grid background */}
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-60" />

        {/* Floating gradient orbs */}
        <div className="absolute top-20 left-[10%] -z-10 w-80 h-80 rounded-full bg-primary/20 blur-[80px] animate-float" />
        <div className="absolute top-40 right-[8%] -z-10 w-64 h-64 rounded-full bg-teal-400/10 blur-[70px] animate-float-slow" />
        <div className="absolute bottom-10 left-[40%] -z-10 w-56 h-56 rounded-full bg-primary/10 blur-[60px] animate-float" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto text-center max-w-5xl">
          {/* Badge */}
          {!isWebView && (
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-10 border-primary/30"
              style={{ animationDelay: '0ms' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-xs font-semibold tracking-wide text-foreground/80 uppercase">
                India's First AI-Powered CRM
              </span>
              <div className="h-4 w-px bg-border/50 mx-1" />
              <a 
                href="https://www.producthunt.com/products/fastest-crm" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=fastest-crm&theme=light" alt="Fastest CRM on Product Hunt" className="h-5" />
              </a>
            </div>
          )}

          {/* Headline */}
          <h1
            id="hero-heading"
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700"
            style={{ fontFamily: "'Syne', sans-serif", letterSpacing: '-0.03em' }}
          >
            India's <span className="gradient-text">Fastest AI CRM</span> for{' '}
            <span className="block mt-2">
              Leads • Calls • Payments
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-5 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Automate your entire sales pipeline with the smartest CRM built for the fastest Indian sales teams.
          </p>

          {/* Pricing pill */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 mb-12 animate-in fade-in duration-700 delay-150">
            <span className="text-primary font-semibold text-sm">
              Free 1 seat · Startup plans at ₹999/month/employee ☕
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            <Link to="/register-company">
              <Button
                size="lg"
                className="h-14 px-10 text-base rounded-full gradient-primary shimmer-overlay font-semibold shadow-xl hover:shadow-2xl transition-all animate-pulse-glow"
                style={{ color: 'hsl(222 28% 5%)' }}
              >
                Register Your Company
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-10 text-base rounded-full border-primary/30 hover:bg-primary/8 hover:text-primary hover:border-primary/50 transition-all font-medium"
              >
                Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social Proof / Press Section ── */}
      <section className="py-20 px-6 border-y border-border/30 bg-secondary/5">
        <div className="container mx-auto">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-12">Building India's Sales Future - As Seen On</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
             <a href="https://www.producthunt.com/products/fastest-crm" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold text-2xl hover:text-primary transition-colors">
               <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=fastest-crm&theme=light" alt="Product Hunt" className="h-8" />
             </a>
             <div className="flex items-center gap-2 font-bold text-2xl"><Newspaper className="h-6 w-6" /> YourStory</div>
             <div className="flex items-center gap-2 font-bold text-2xl">Inc42</div>
             <div className="flex items-center gap-2 font-bold text-2xl">TechCrunch</div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 relative" aria-labelledby="features-heading">
        <div className="absolute top-0 right-0 -z-10 w-1/3 h-1/3 bg-primary/5 blur-3xl rounded-full" />
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <span className="text-xs font-bold text-primary uppercase tracking-widest mb-3 block">What We Offer</span>
            <h2
              id="features-heading"
              className="text-3xl md:text-5xl font-bold mb-6"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Why we are the <span className="gradient-text">Fastest CRM</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              Our AI CRM is optimized for speed—from split-second lead delivery to automated one-click dialers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group relative p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/40 card-hover overflow-hidden"
              >
                {/* Hover gradient reveal */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Number */}
                <span className="absolute top-5 right-6 text-4xl font-black text-border/60 group-hover:text-primary/20 transition-colors duration-500" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl border border-primary/30 bg-primary/8 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-primary/60 transition-all duration-400">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "'Syne', sans-serif" }}>{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Industries ── */}
      <section className="py-20 px-6 bg-secondary/20 border-y border-border/40" aria-labelledby="industries-heading">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-primary uppercase tracking-widest mb-3 block">Industries We Serve</span>
            <h2
              id="industries-heading"
              className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Built for <span className="gradient-text">Fastest Teams</span> Everywhere
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {industries.map((industry) => (
              industry.path ? (
                <Link
                  key={industry.name}
                  to={industry.path}
                  className="flex flex-col items-center justify-center p-5 rounded-xl bg-background border border-border/50 hover:border-primary/50 hover:bg-primary/4 transition-all duration-300 group cursor-pointer card-hover"
                >
                  <span className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300" role="img" aria-label={industry.name}>
                    {industry.icon}
                  </span>
                  <span className="font-semibold text-foreground/80 group-hover:text-primary transition-colors text-sm text-center">
                    {industry.name}
                  </span>
                </Link>
              ) : (
                <div
                  key={industry.name}
                  className="flex flex-col items-center justify-center p-5 rounded-xl bg-background border border-border/50 hover:border-primary/40 opacity-70 transition-all duration-300 group cursor-default"
                >
                  <span className="text-3xl mb-3" role="img" aria-label={industry.name}>
                    {industry.icon}
                  </span>
                  <span className="font-semibold text-foreground/80 text-sm text-center">
                    {industry.name}
                  </span>
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-24 px-6 relative overflow-hidden" aria-labelledby="benefits-heading">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(175_80%_48%_/_0.07)_0%,_transparent_60%)]" />
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-widest mb-3 block">Why Teams Love Us</span>
            <h2
              id="benefits-heading"
              className="text-3xl md:text-5xl font-bold"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Why Teams Love <span className="gradient-text">Fastest CRM</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit) => (
              <div
                key={benefit.text}
                className="flex flex-col items-center text-center p-8 rounded-2xl bg-card/60 border border-border/50 hover:border-primary/40 card-hover group"
              >
                <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300 animate-pulse-glow">
                  <benefit.icon className="h-7 w-7" style={{ color: 'hsl(222 28% 5%)' }} />
                </div>
                <p className="font-bold text-base mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>{benefit.label}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FAQSection items={faqs.map(f => ({ question: f.q, answer: f.a }))} />

      {/* ── CTA ── */}
      <section className="py-24 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[600px] h-[300px] bg-primary/15 blur-[100px] rounded-full" />

        <div className="container mx-auto">
          <div className="glass rounded-3xl p-8 md:p-16 text-center max-w-4xl mx-auto border-primary/20 hover:border-primary/40 transition-all duration-500 shadow-2xl shimmer-overlay">
            <h2
              className="text-3xl md:text-5xl font-bold mb-5"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Ready to Transform Your Sales?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Join forward-thinking sales teams closing more deals with Fastest CRM's AI-powered pipeline.
            </p>
            <Link to="/register-company">
              <Button
                size="lg"
                className="h-14 px-12 text-base rounded-full gradient-primary font-bold shadow-xl hover:shadow-2xl transition-all animate-pulse-glow"
                style={{ color: 'hsl(222 28% 5%)' }}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="mt-5 text-xs text-muted-foreground">
              No credit card required · Free starter plan · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      <AuthorityFooter />
    </div>
  );
}