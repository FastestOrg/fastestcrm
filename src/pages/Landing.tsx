import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Users, Phone, CreditCard, Workflow,
  Brain, ArrowRight, Zap, Target, TrendingUp, Menu, X, ChevronDown
} from 'lucide-react';
import SEO from '@/components/SEO';
import { FAQSchema, SoftwareAppSchema, OrganizationSchema } from '@/components/SchemaMarkup';

const features = [
  {
    icon: Users,
    title: 'Lead Management',
    description: 'Track every lead from generation to conversion with smart status tracking and ownership assignment.'
  },
  {
    icon: Brain,
    title: 'AI Analytics (Gemini)',
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
  { name: 'Training Institutes', icon: '📚' },
  { name: 'Travel & Hospitality', icon: '✈️' },
  { name: 'Finance & Loans', icon: '💰' },
  { name: 'SaaS & B2B', icon: '💻', path: '/crm-for-saas' },
  { name: 'Healthcare & Clinics', icon: '🏥' },
  { name: 'Consultancy', icon: '🤝' }
];

import { isAndroidWebView } from '@/lib/platform';

export default function Landing() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const isWebView = isAndroidWebView();

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="India's #1 AI-Powered CRM for Sales Teams | Fastest CRM"
        description="Transform your sales with India's most advanced AI CRM. Unified lead management, automated calling, and Razorpay payments. Built for Real Estate, EdTech, SaaS, and high-growth Indian startups."
        keywords="best AI CRM India, sales CRM for startups, real estate lead management, edtech sales software, saas crm india, auto dialer crm, fastest crm, sales automation tool india"
      />
      <SoftwareAppSchema />
      <OrganizationSchema />
      <FAQSchema faqs={faqs.map(f => ({ question: f.q, answer: f.a }))} />

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
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="hover:bg-primary/8 hover:text-primary transition-colors text-sm font-medium">
                Blog
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="hover:bg-primary/8 hover:text-primary transition-colors text-sm font-medium">
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
            </div>
          )}

          {/* Headline */}
          <h1
            id="hero-heading"
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700"
            style={{ fontFamily: "'Syne', sans-serif", letterSpacing: '-0.03em' }}
          >
            India's #1 AI CRM for{' '}
            <span className="gradient-text block mt-2">
              Leads • Calls • Payments
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-5 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Automate your entire sales pipeline with the smartest CRM built for the fastest Indian sales teams.
          </p>

          {/* Pricing pill */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 mb-12 animate-in fade-in duration-700 delay-150">
            <span className="text-primary font-semibold text-sm">
              Free 1 seat · Startup plans from ₹10/day/employee ☕
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
              Everything for <span className="gradient-text">Fastest Growth</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              From lead capture to payment collection, handle your entire sales workflow with intelligent automation.
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
      <section className="py-24 px-6 bg-secondary/20 border-y border-border/40" aria-labelledby="faq-heading">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-primary uppercase tracking-widest mb-3 block">Got Questions?</span>
            <h2
              id="faq-heading"
              className="text-3xl md:text-5xl font-bold"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Frequently Asked <span className="gradient-text">Questions</span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/50 bg-card/40 overflow-hidden hover:border-primary/30 transition-colors"
              >
                <button
                  className="w-full flex justify-between items-center font-semibold cursor-pointer px-6 py-5 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="text-base">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-primary flex-shrink-0 ml-4 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="text-muted-foreground px-6 pb-5 text-sm leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

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

      {/* ── Footer ── */}
      <footer className="py-12 px-6 border-t border-border/50 bg-card/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/fastestcrmlogo.png" alt="Fastest CRM" className="w-8 h-8 object-contain" />
                <span className="font-bold text-base" style={{ fontFamily: "'Syne', sans-serif" }}>Fastest CRM</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isWebView
                  ? "The smartest CRM built for the fastest sales teams. Powered by Google Gemini."
                  : "India's first AI-powered CRM built for the fastest sales teams. Powered by Google Gemini."}
              </p>
            </div>

            {/* Links */}
            <div>
              <p className="font-semibold text-sm mb-4 text-foreground/80" style={{ fontFamily: "'Syne', sans-serif" }}>Product</p>
              <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                <Link to="/blog" className="hover:text-primary transition-colors">Blog</Link>
                <Link to="/auth" className="hover:text-primary transition-colors">Login</Link>
                <Link to="/register-company" className="hover:text-primary transition-colors">Register Company</Link>
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="font-semibold text-sm mb-4 text-foreground/80" style={{ fontFamily: "'Syne', sans-serif" }}>Legal</p>
              <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              </div>
            </div>

            {/* Mobile App */}
            <div className="flex flex-col items-center md:items-start lg:items-end">
              <p className="font-semibold text-sm mb-4 text-foreground/80 md:w-full md:text-left lg:text-right" style={{ fontFamily: "'Syne', sans-serif" }}>Mobile App</p>
              <div className="flex flex-col items-center md:items-start lg:items-end gap-3 text-right">
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px] text-center md:text-left lg:text-right">
                  Download "FastestCRM App" for Seamless Experience
                </p>
                <a href="https://play.google.com/store/apps/details?id=com.fastestcrm" target="_blank" rel="noopener noreferrer">
                  <img src="/getitongoogleplay.png" alt="Get it on Google Play" className="h-10 hover:opacity-90 transition-opacity" />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © 2025-∞ Fastest CRM by{' '}
              <a href="https://upmarking.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                Upmarking.com
              </a>
              . Built for Fastest Sales Teams.
            </p>
            <p className="text-xs text-muted-foreground">Made with ❤️ in India 🇮🇳</p>
          </div>
        </div>
      </footer>
    </div>
  );
}