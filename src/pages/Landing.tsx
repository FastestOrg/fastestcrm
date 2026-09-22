import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Users, Phone, CreditCard, Workflow,
  Brain, ArrowRight, Zap, Target, TrendingUp, Menu, X,
  Star, CheckCircle2, MessageSquare, Quote, Newspaper, Shield, Sparkles, PhoneCall,
  Clock, Award, ChevronRight, Check, Bot, Building2, GraduationCap, BookOpen, Plane,
  Landmark, Layers, Stethoscope, Briefcase
} from 'lucide-react';
import SEO from '@/components/SEO';
import { SoftwareAppSchema, OrganizationSchema, LocalBusinessBengaluruSchema, LocalBusinessSFSchema } from '@/components/SchemaMarkup';
import FAQSection from '@/components/features/FAQSection';
import AuthorityFooter from '@/components/layout/AuthorityFooter';
import { isAndroidWebView } from '@/lib/platform';

// ─── Interactive Landing Components ─────────────────────
import Card3D from '@/components/landing/Card3D';
import InteractiveProductConsole from '@/components/landing/InteractiveProductConsole';
import LiveDealTicker from '@/components/landing/LiveDealTicker';
import ROICalculator from '@/components/landing/ROICalculator';
import SpeedComparisonSection from '@/components/landing/SpeedComparisonSection';
import ScrollProgressBar from '@/components/landing/ScrollProgressBar';
import ScrollFloatingCTA from '@/components/landing/ScrollFloatingCTA';
import { ScrollReveal, ScrollRevealItem } from '@/components/landing/ScrollReveal';
import AIAgentHUD from '@/components/landing/AIAgentHUD';
import AICommandPrompt from '@/components/landing/AICommandPrompt';
import LandingScrollShowcase from '@/components/landing/LandingScrollShowcase';

const features = [
  {
    icon: Zap,
    badge: '300ms Routing',
    title: 'Autonomous Lead Ingestion',
    description: 'Auto-capture leads from Meta Ads, Google, WhatsApp, & webhooks. Sub-second routing with FastAI intelligence.'
  },
  {
    icon: Brain,
    badge: 'FastAI Neural',
    title: 'AI Predictive Lead Scoring',
    description: 'Real-time buying intent calculation, predicted deal close time, and automated objection-handling guidance.'
  },
  {
    icon: PhoneCall,
    badge: 'Voice AI',
    title: 'Autonomous Auto-Dialer',
    description: 'Sequential telecalling with live speech-to-text transcription and instant AI call summary notes.'
  },
  {
    icon: Shield,
    badge: 'India-First',
    title: '12-Level Hierarchy & CA Governance',
    description: 'Granular role-based security from Chartered Accountant to Telecaller. Customer numbers masked & protected.'
  },
  {
    icon: CreditCard,
    badge: 'Razorpay Native',
    title: 'WhatsApp Payment Links',
    description: 'Generate dynamic payment links in 1 click. Instant webhook verification automatically marks deals WON.'
  },
  {
    icon: Workflow,
    badge: 'Smart Triggers',
    title: 'Multi-Channel AI Automation',
    description: 'Trigger automated WhatsApp nurture drips, escalation SMS, and SLA alerts when inquiries need immediate touch.'
  }
];

const testimonials = [
  {
    quote: "FastestCRM reduced our lead response latency from 35 minutes down to 8 seconds. Our conversion rate increased by 42% in month one.",
    author: "Arjun Sharma",
    role: "Head of Sales, PropTech Realty (Bengaluru)",
    metric: "+42% Conversion Rate"
  },
  {
    quote: "The built-in auto-dialer and speech transcription saved our 25 counselors over 3 hours every day. The UI is lightning-fast.",
    author: "Sneha Patil",
    role: "Admissions Director, EdTech Academy (Mumbai)",
    metric: "3+ Hours Saved Daily"
  },
  {
    quote: "The 12-tier hierarchy with CA commission governance gave our leadership complete audit peace of mind across 6 state branches.",
    author: "Vikram Singhania",
    role: "Managing Director, Apex Capital (Delhi NCR)",
    metric: "6 Branches Unified"
  }
];

const industries = [
  { name: 'Real Estate', icon: Building2, path: '/crm-for-real-estate' },
  { name: 'EdTech', icon: GraduationCap, path: '/crm-for-edtech' },
  { name: 'Training Institutes', icon: BookOpen, path: '/solutions/bangalore' },
  { name: 'Travel & Hospitality', icon: Plane, path: '/solutions/mumbai' },
  { name: 'Finance & Loans', icon: Landmark, path: '/solutions/delhi' },
  { name: 'SaaS & B2B', icon: Layers, path: '/crm-for-saas' },
  { name: 'Healthcare & Clinics', icon: Stethoscope, path: '/crm-for-healthcare' },
  { name: 'Consultancy', icon: Briefcase, path: '/solutions/hyderabad' }
];


const faqs = [
  { q: 'Is there a free trial or free tier?', a: 'Yes! FastestCRM provides a completely free 1-seat starter account so you can test all features with zero risk. Team plans start at just ₹999/month/rep.' },
  { q: 'Can I import my existing leads and customer history?', a: 'Absolutely. We support 1-click CSV imports and seamless webhook integrations with Meta Ads, Google Ads, Zapier, Make, and custom REST APIs.' },
  { q: 'How does the Auto-Dialer work?', a: 'Our auto-dialer queues leads sequentially. With a single click, your sales reps dial prospects directly, while FastAI transcribes call notes and auto-updates lead status with zero manual typing.' },
  { q: 'How does FastestCRM compare to Salesforce or HubSpot?', a: 'FastestCRM is engineered specifically for speed and high-velocity conversion. Where legacy CRMs take 6 weeks to set up and cost ₹8,000+/rep with add-ons, FastestCRM is live in 3 minutes, has native calling and WhatsApp, and costs ₹999/rep.' },
  { q: 'What is the 12-Level Hierarchy & CA Governance?', a: 'FastestCRM includes multi-tier organizational control designed for Indian enterprises and global sales networks. It enables Chartered Accountants, Company Admins, Regional Directors, Branch Managers, and Telecallers to have isolated permissions, commission payouts, and masked contact numbers.' }
];

export default function Landing() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isWebView = isAndroidWebView();

  const { scrollY } = useScroll();
  const heroConsoleRotateX = useTransform(scrollY, [0, 600], [0, 8]);
  const heroConsoleScale = useTransform(scrollY, [0, 600], [1, 0.97]);
  const heroConsoleOpacity = useTransform(scrollY, [0, 800], [1, 0.9]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-foreground relative">
      {/* ── Scroll Progress Bar ── */}
      <ScrollProgressBar />

      {/* ── Floating Sticky Conversion Pill ── */}
      <ScrollFloatingCTA />

      <SEO 
        title="Global First Fully AI CRM for Sales Teams | Fast CRM for Startups"
        description="Ranked #1 Fully AI CRM. Transform your sales with the most advanced AI CRM. Automated lead tracking, fast calling, and payments. Built for high-growth sales teams."
        keywords="Fully AI CRM, Global AI CRM, AI CRM, best AI CRM, sales CRM for startups, real estate lead management, edtech sales software, saas crm, auto dialer crm, sales automation tool"
      />
      <SoftwareAppSchema />
      <OrganizationSchema />
      <LocalBusinessBengaluruSchema />
      <LocalBusinessSFSchema />

      {/* ── Fixed Floating Navigation ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-3 bg-background/80 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl' : 'py-5 bg-transparent'
      }`}>
        <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-8 h-8 md:w-9 md:h-9 object-contain group-hover:scale-105 transition-transform" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-background animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg md:text-xl font-extrabold tracking-tight text-foreground">
                Fastest CRM
              </span>
              <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                AI FIRST
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-1 bg-white/[0.03] backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/[0.08]">
            <Link to="/tools">
              <Button variant="ghost" size="sm" className="rounded-full text-xs font-semibold hover:text-primary hover:bg-white/[0.05] transition-colors">
                Sales Tools
              </Button>
            </Link>
            <Link to="/glossary">
              <Button variant="ghost" size="sm" className="rounded-full text-xs font-semibold hover:text-primary hover:bg-white/[0.05] transition-colors">
                Glossary
              </Button>
            </Link>
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="rounded-full text-xs font-semibold hover:text-primary hover:bg-white/[0.05] transition-colors">
                Blog
              </Button>
            </Link>
            <Link to="/crm-for-real-estate">
              <Button variant="ghost" size="sm" className="rounded-full text-xs font-semibold hover:text-primary hover:bg-white/[0.05] transition-colors">
                Industries
              </Button>
            </Link>
          </div>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="rounded-full text-xs font-bold hover:text-primary hover:bg-white/[0.05] transition-colors">
                Sign In
              </Button>
            </Link>
            <Link to="/register-company">
              <Button
                size="sm"
                className="gradient-primary shimmer-overlay font-bold text-slate-950 px-5 rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs"
              >
                Register Company
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle navigation">
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-2xl border-b border-white/[0.08] p-6 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-top-4 duration-200">
            <Link to="/tools" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-sm font-semibold">Sales Tools</Button>
            </Link>
            <Link to="/glossary" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-sm font-semibold">CRM Glossary</Button>
            </Link>
            <Link to="/blog" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-sm font-semibold">Blog & Guides</Button>
            </Link>
            <Link to="/crm-for-real-estate" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start text-sm font-semibold">Industry Solutions</Button>
            </Link>
            <div className="h-px bg-white/[0.08] my-1" />
            <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-center text-sm font-semibold">Login</Button>
            </Link>
            <Link to="/register-company" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full gradient-primary font-bold text-slate-950 text-sm h-11">
                Register Company Free
              </Button>
            </Link>
          </div>
        )}
      </nav>

      {/* ── 3D Hero Section with AI-First Architecture ── */}
      <section className="relative pt-32 md:pt-40 pb-20 px-4 md:px-6 overflow-hidden" aria-labelledby="hero-heading">

        {/* Ambient Glow Orbs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 -z-10 w-[750px] h-[450px] bg-primary/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-80 right-10 -z-10 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="container mx-auto text-center max-w-5xl relative z-10">
          <ScrollReveal staggerDelay={0.1}>
            {/* AI First Announcement Badge */}
            <ScrollRevealItem className="mb-6 flex justify-center">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] shadow-lg shadow-emerald-500/10 backdrop-blur-xl">
                <Bot className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-emerald-300 font-mono tracking-tight">
                  Autonomous FastAI Engine v2.4 · Self-Driving Sales CRM
                </span>
              </div>
            </ScrollRevealItem>

            {/* Main Headline */}
            <ScrollRevealItem>
              <h1
                id="hero-heading"
                className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tight leading-[1.06] text-foreground"
              >
                The World's First <br className="hidden sm:inline" />
                <span className="gradient-text">Autonomous AI CRM</span>
                <span className="block mt-2 text-foreground font-extrabold text-3xl sm:text-5xl md:text-6xl lg:text-7xl">
                  That Ingests, Dials & Closes 24/7
                </span>
              </h1>
            </ScrollRevealItem>

            {/* Subtitle */}
            <ScrollRevealItem>
              <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed font-normal">
                Deploy self-driving AI agents that ingest leads in 300ms, predict high-intent buyers, auto-dial prospects with live speech transcription, and settle payments instantly.
              </p>
            </ScrollRevealItem>

            {/* Primary & Secondary Action CTAs */}
            <ScrollRevealItem>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                <Link to="/register-company" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-14 px-10 text-base rounded-full gradient-primary shimmer-overlay font-bold text-slate-950 shadow-[0_10px_35px_rgba(20,184,166,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Deploy Your AI CRM Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto h-14 px-10 text-base rounded-full border-white/20 hover:border-primary/50 hover:bg-white/[0.05] transition-all font-semibold"
                  >
                    Explore Live Sandbox
                  </Button>
                </Link>
              </div>
            </ScrollRevealItem>

            {/* Micro Trust Indicators */}
            <ScrollRevealItem>
              <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-xs text-muted-foreground mb-6">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Free 1-seat starter
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> 3-minute instant setup
                </span>
                <span className="hidden sm:flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Team plan at ₹999/mo
                </span>
              </div>
            </ScrollRevealItem>

            {/* Live Deal Ticker */}
            <ScrollRevealItem className="mb-8 flex justify-center">
              <LiveDealTicker />
            </ScrollRevealItem>

            {/* Interactive 3D Product Simulator Centerpiece */}
            <ScrollRevealItem>
              <motion.div
                style={{
                  rotateX: heroConsoleRotateX,
                  scale: heroConsoleScale,
                  opacity: heroConsoleOpacity,
                  transformPerspective: 1200
                }}
                className="relative mt-4"
              >
                <InteractiveProductConsole />
              </motion.div>
            </ScrollRevealItem>

            {/* Live Floating AI Agent Telemetry HUD */}
            <ScrollRevealItem className="mt-8">
              <AIAgentHUD />
            </ScrollRevealItem>

            {/* AI Command Prompt Tester */}
            <ScrollRevealItem>
              <AICommandPrompt />
            </ScrollRevealItem>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Social Proof / Press Section ── */}
      <section className="py-10 md:py-12 px-4 sm:px-6 border-y border-white/[0.08] bg-slate-950/60 overflow-hidden">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal staggerDelay={0.08}>
            <ScrollRevealItem>
              <p className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6 font-mono">
                Trusted by Forward-Thinking Sales Teams & Featured In
              </p>
            </ScrollRevealItem>

            <ScrollRevealItem>
              <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 md:gap-16 opacity-75 hover:opacity-100 transition-opacity duration-300">
                <a
                  href="https://www.producthunt.com/products/fastest-crm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-foreground/80 hover:text-[#DA552F] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#DA552F] flex items-center justify-center text-white font-bold text-xs">
                    P
                  </div>
                  <span className="font-bold text-base tracking-tight">Product Hunt</span>
                </a>
                <div className="flex items-center gap-2 font-bold text-base tracking-tight text-foreground/80">
                  <Newspaper className="h-4 w-4 text-primary" /> YourStory
                </div>
                <div className="font-bold text-base tracking-tight text-foreground/80">
                  Inc42 Media
                </div>
                <div className="font-bold text-base tracking-tight text-foreground/80">
                  TechCrunch
                </div>
                <div className="font-bold text-base tracking-tight text-foreground/80">
                  Forbes India
                </div>
              </div>
            </ScrollRevealItem>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 3D Container Scroll Animation Showcase ── */}
      <LandingScrollShowcase />

      {/* ── 3D Bento Feature Grid with Staggered Scroll Reveal ── */}
      <section className="py-20 md:py-24 px-4 sm:px-6 relative overflow-hidden" aria-labelledby="features-heading">
        <div className="container mx-auto max-w-6xl">
          <ScrollReveal staggerDelay={0.12}>
            <ScrollRevealItem className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-3 font-mono">
                <Sparkles className="h-3.5 w-3.5" /> High-Velocity Capabilities
              </div>
              <h2
                id="features-heading"
                className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight"
              >
                Why We Are the <span className="gradient-text">Fastest CRM</span>
              </h2>
              <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
                Every millisecond counts. Built with zero bloat to turn every incoming lead into immediate revenue.
              </p>
            </ScrollRevealItem>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <ScrollRevealItem key={feature.title}>
                    <Card3D maxTilt={6} className="h-full">
                      <div className="h-full p-6 sm:p-7 rounded-2xl border border-white/10 hover:border-primary/40 transition-colors flex flex-col justify-between group bg-slate-950/75 backdrop-blur-xl shadow-xl">
                        <div>
                          <div className="flex items-center justify-between mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-slate-950 transition-all duration-300 shadow-sm">
                              <Icon className="h-6 w-6" />
                            </div>
                            <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {feature.badge}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-2 tracking-tight">
                            {feature.title}
                          </h3>
                          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                            {feature.description}
                          </p>
                        </div>

                        <div className="pt-6 border-t border-white/[0.06] mt-6 flex items-center justify-between text-xs text-primary font-semibold group-hover:translate-x-1 transition-transform">
                          <span>Explore workflow</span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Card3D>
                  </ScrollRevealItem>
                );
              })}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Speed Comparison Benchmark Section ── */}
      <ScrollReveal>
        <ScrollRevealItem>
          <SpeedComparisonSection />
        </ScrollRevealItem>
      </ScrollReveal>

      {/* ── Interactive ROI Calculator ── */}
      <ScrollReveal>
        <ScrollRevealItem>
          <ROICalculator />
        </ScrollRevealItem>
      </ScrollReveal>

      {/* ── Industry Verticals (Cascading Stagger) ── */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-black/20 border-y border-white/[0.08] overflow-hidden" aria-labelledby="industries-heading">
        <div className="container mx-auto max-w-6xl">
          <ScrollReveal staggerDelay={0.08}>
            <ScrollRevealItem className="text-center mb-14">
              <span className="text-xs font-bold text-primary uppercase tracking-widest mb-3 block font-mono">Tailored Vertical Workflows</span>
              <h2
                id="industries-heading"
                className="text-3xl md:text-4xl font-extrabold tracking-tight"
              >
                Built for <span className="gradient-text">High-Velocity Sectors</span>
              </h2>
            </ScrollRevealItem>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {industries.map((ind) => {
                const Icon = ind.icon;
                return (
                  <ScrollRevealItem key={ind.name}>
                    <Link
                      to={ind.path}
                      className="p-5 sm:p-6 rounded-2xl border border-white/10 bg-slate-950/70 hover:border-primary/50 hover:bg-slate-900/90 transition-all text-center group flex flex-col items-center justify-center h-full shadow-lg"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-slate-950 transition-all duration-300 mb-3.5 shadow-sm">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs md:text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors tracking-tight">
                        {ind.name}
                      </span>
                    </Link>
                  </ScrollRevealItem>
                );
              })}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Customer Stories & Testimonials (Cascading Stagger) ── */}
      <section className="py-20 md:py-24 px-4 sm:px-6 relative overflow-hidden" aria-labelledby="testimonials-heading">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal staggerDelay={0.12}>
            <ScrollRevealItem className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-3 font-mono">
                <Sparkles className="h-3.5 w-3.5" /> Customer Testimonials
              </div>
              <h2
                id="testimonials-heading"
                className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight"
              >
                Loved by <span className="gradient-text">India's Top Revenue Teams</span>
              </h2>
            </ScrollRevealItem>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <ScrollRevealItem key={t.author} className="h-full">
                  <Card3D maxTilt={6} className="h-full">
                    <div className="p-6 sm:p-7 rounded-2xl border border-white/10 h-full flex flex-col justify-between bg-slate-950/75 backdrop-blur-xl shadow-xl hover:border-primary/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-1 text-amber-400 mb-4">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-amber-400" />
                          ))}
                        </div>
                        <p className="text-xs md:text-sm text-foreground/90 leading-relaxed mb-6 italic">
                          "{t.quote}"
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-primary font-mono block mb-1">
                          {t.metric}
                        </span>
                        <p className="text-xs font-bold text-foreground">{t.author}</p>
                        <p className="text-[11px] text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
                  </Card3D>
                </ScrollRevealItem>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <ScrollReveal>
        <ScrollRevealItem>
          <FAQSection items={faqs.map(f => ({ question: f.q, answer: f.a }))} />
        </ScrollRevealItem>
      </ScrollReveal>

      {/* ── Final 3D Call to Action ── */}
      <section className="py-20 md:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[600px] h-[300px] bg-primary/15 blur-[140px] rounded-full pointer-events-none" />

        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <ScrollRevealItem>
              <Card3D maxTilt={4}>
                <div className="rounded-3xl p-8 md:p-16 text-center border border-primary/30 shadow-2xl relative overflow-hidden bg-slate-950/90 backdrop-blur-2xl">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
                  
                  <h2
                    className="text-3xl md:text-5xl font-black mb-5 text-foreground tracking-tight"
                  >
                    Ready to Experience the <br />
                    <span className="gradient-text">Fastest Sales Pipeline</span> on Earth?
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground mb-8 max-w-xl mx-auto">
                    Join forward-thinking sales teams closing deals 10x faster. Create your company account in 3 minutes.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link to="/register-company" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto h-14 px-12 text-base rounded-full gradient-primary font-bold text-slate-950 shadow-[0_10px_35px_rgba(20,184,166,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        Get Started Free (1 Seat Included)
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> No credit card required</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Free starter tier</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Instant 3-minute setup</span>
                  </div>
                </div>
              </Card3D>
            </ScrollRevealItem>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <AuthorityFooter />
    </div>
  );
}