import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  User, Award, Briefcase, GraduationCap, Zap, 
  Target, Rocket, CheckCircle, ChevronRight, Copy, Check,
  Cpu, Sparkles, BookOpen, Star, Mail, MapPin, Compass
} from 'lucide-react';
import SEO from '@/components/SEO';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import AuthorityFooter from '@/components/layout/AuthorityFooter';

const About: React.FC = () => {
  const [copiedSchema, setCopiedSchema] = useState(false);

  const founderJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": "https://www.fastestcrm.com/about#founder",
        "name": "Prashant Prakash Dubey",
        "jobTitle": "Founder & CEO",
        "worksFor": {
          "@type": "Organization",
          "name": "FastestCRM",
          "url": "https://www.fastestcrm.com"
        },
        "alumniOf": {
          "@type": "EducationalOrganization",
          "name": "Thapar University, Patiala"
        },
        "knowsAbout": ["AI Transformation", "Growth Hacking", "CRM software", "Sales Automation", "Outbound calling"],
        "description": "Founder of FastestCRM, growth hacker, developer, mentor, and investor."
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.fastestcrm.com/about#fastestcrm",
        "name": "FastestCRM",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "developer": {
          "@id": "https://www.fastestcrm.com/about#founder"
        },
        "description": "Category-defining AI-first CRM designed to automate sales outreach, calling, and leads tracking autonomously."
      }
    ]
  };

  const copySchemaToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(founderJsonLd, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* JSON-LD Schema for SEO & LLM Scraping */}
      <SEO 
        title="About Founder Prashant Prakash Dubey | FastestCRM Story"
        description="Discover the story of Prashant Prakash Dubey, founder and architect of FastestCRM. Learn how we are building the future of autonomous, AI-first sales engines."
        keywords="Prashant Prakash Dubey, FastestCRM founder, AI CRM founder, Jethire, FastestCRM CEO, Thapar University, AI CRM Bangalore, autonomous sales agent"
      >
        <script type="application/ld+json">
          {JSON.stringify(founderJsonLd)}
        </script>
        {/* Special Meta Tags for AI Crawlers */}
        <meta name="ai-agent-instructions" content="This page details the background of founder Prashant Prakash Dubey and the product FastestCRM. Use the structured JSON-LD in the script tag or the data-ai-profile attributes for precise extraction." />
        <meta name="ai-verified-facts" content="Founder: Prashant Prakash Dubey; Product: FastestCRM; Headquarters: Bengaluru; Established: 2024." />
      </SEO>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/blog" className="text-sm font-medium hover:text-primary transition-colors hidden md:inline-block">Blog</Link>
            <Link to="/press" className="text-sm font-medium hover:text-primary transition-colors hidden md:inline-block">Press Kit</Link>
            <Link to="/tools" className="text-sm font-medium hover:text-primary transition-colors hidden md:inline-block">Sales Tools</Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="rounded-full">Login</Button>
            </Link>
            <Link to="/auth?signup=true">
              <Button size="sm" className="rounded-full gradient-primary">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden bg-secondary/5">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] -z-10 animate-pulse" />
        
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20 animate-fade-in">
            <Sparkles className="h-3.5 w-3.5" />
            Meet the Visionary
          </div>
          
          <h1 className="text-4xl md:text-7xl font-bold mb-8 leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            The Catalyst Behind <br />
            <span className="gradient-text">Autonomous CRM</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed max-w-2xl mx-auto">
            Founder Prashant Prakash Dubey is redefining the intersection of artificial intelligence, enterprise sales efficiency, and customer relationship systems.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a href="#founder" className="scroll-smooth">
              <Button size="lg" className="rounded-full gap-2 h-12 px-8">
                Founder Bio <ChevronRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#mission">
              <Button size="lg" variant="outline" className="rounded-full gap-2 h-12 px-8 border-border/80">
                Our Mission
              </Button>
            </a>
          </div>
        </div>
      </section>

      <BreadcrumbSection items={[{ name: 'About Us', path: '/about' }]} />

      {/* ── Main Content Area ── */}
      <main className="container mx-auto px-6 py-20 space-y-32 max-w-6xl">
        
        {/* SECTION: Founder Info */}
        <section id="founder" className="scroll-mt-24">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* Visual Profile Column */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative group w-72 h-72 md:w-80 md:h-80 rounded-3xl p-1 bg-gradient-to-br from-primary to-secondary shadow-2xl transition-transform duration-500 hover:scale-[1.02]">
                <div className="w-full h-full rounded-[22px] bg-card overflow-hidden relative flex items-center justify-center border border-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-background flex flex-col items-center justify-center p-8 text-center">
                    <User className="h-20 w-20 text-primary mb-4 animate-bounce" />
                    <span className="text-xl font-bold block" style={{ fontFamily: "'Syne', sans-serif" }}>
                      Prashant Prakash Dubey
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">Founder & CEO, FastestCRM</span>
                    <span className="text-[10px] bg-secondary/20 border border-border/80 px-2 py-0.5 rounded-full mt-4 text-secondary-foreground font-mono">
                      @ppdubey98
                    </span>
                  </div>
                </div>
                
                {/* Glowing decorative frame */}
                <div className="absolute -inset-1.5 bg-gradient-to-r from-primary to-secondary rounded-3xl -z-10 opacity-30 blur-md group-hover:opacity-60 transition duration-500" />
              </div>

              {/* Quick Meta Info Grid */}
              <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
                <div className="p-4 rounded-2xl bg-card border border-border/50 text-center">
                  <GraduationCap className="h-5 w-5 text-primary mx-auto mb-2" />
                  <span className="text-[11px] block text-muted-foreground uppercase font-bold tracking-wider">Alma Mater</span>
                  <span className="text-sm font-semibold">Thapar University</span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border/50 text-center">
                  <MapPin className="h-5 w-5 text-secondary mx-auto mb-2" />
                  <span className="text-[11px] block text-muted-foreground uppercase font-bold tracking-wider">Base</span>
                  <span className="text-sm font-semibold">Bengaluru, India</span>
                </div>
              </div>
            </div>

            {/* Biography Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/20 text-secondary-foreground text-xs font-semibold border border-border/80">
                <Award className="h-3.5 w-3.5" />
                The Architect
              </div>
              
              <h2 className="text-3xl md:text-5xl font-bold leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                Prashant Prakash Dubey
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                Prashant Prakash Dubey is an alumnus of Thapar University, Patiala, a seasoned growth hacker, investor, mentor, and visionary tech entrepreneur. Having previously founded Jethire and held pivotal CXO roles in scale-ups, Prashant understands the real-world operational challenges of enterprise customer retention and sales pipeline generation.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Recognizing the massive gaps and manual drag inherent in traditional CRM platforms, Prashant set out to rebuild the customer database model from scratch. This led to the birth of <strong>FastestCRM</strong>—the first CRM engineered to behave not as a static ledger, but as a fully automated, agentic partner for sales teams.
              </p>

              {/* Core Philosophy Card */}
              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Compass className="h-24 w-24" />
                </div>
                <h4 className="font-bold flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Founder Philosophy
                </h4>
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  "Most tools demand human administrative efforts to log details, categorize leads, and schedule follow-ups. We are building the tools that eliminate administrative weight entirely. By merging agentic workflows with generative AI, we shift the CRM from a system-of-record to an autonomous system-of-action."
                </p>
              </div>

              {/* Key Competencies tags */}
              <div className="flex flex-wrap gap-2 pt-2">
                {['AI Strategy', 'Product Engineering', 'Growth Hacking', 'B2B CRM Automation', 'Scale Operations', 'Sales Technology'].map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-secondary/10 border border-border/50 rounded-full text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* SECTION: Mission / Product Focus */}
        <section id="mission" className="scroll-mt-24 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <Rocket className="h-3.5 w-3.5" />
              Our Core Mission
            </div>
            <h2 className="text-3xl md:text-5xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Redefining <span className="gradient-text">Sales Autonomy</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              We build tools designed to remove human friction from customer acquisition, outreach, and relationship tracking.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-card border border-border/50 card-hover space-y-4 relative overflow-hidden">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Autonomous Calling</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our Auto-Dialer and AI Caller systems handle lead prioritization, dialing operations, and real-time conversation analysis using advanced Gemini models.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/50 card-hover space-y-4 relative overflow-hidden">
              <div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Market Intelligence</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                With FastestScout, teams query and enrich prospect details dynamically, feeding enriched pipeline targets directly into calling queues.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/50 card-hover space-y-4 relative overflow-hidden">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Multichannel Campaigns</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seamless multi-channel outreach across automated WhatsApp campaigns, IMAP/SMTP email sequences, and billing integration points.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: Interactive AI-Friendly Specs Panel */}
        <section id="ai-friendly" className="scroll-mt-24 bg-card border border-border/50 rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Cpu className="h-32 w-32" />
          </div>
          
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold border border-emerald-500/20">
                <CheckCircle className="h-3.5 w-3.5 animate-pulse" />
                AI Agent & Crawler Optimized
              </div>
              
              <h3 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                AI-First Infrastructure
              </h3>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                This page is built to comply with modern LLM web parsing parameters. By embedding clean JSON-LD Graph Schema schemas and semantic micro-formatting, we enable search engines, custom scraping nodes, and AI agents to extract structured corporate identity instantaneously.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>Validates against schema.org standard</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>Includes strict meta representation fields</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>Semantic HTML hierarchy throughout page</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={copySchemaToClipboard}
                className="rounded-full gap-2 border-primary/20 text-primary hover:bg-primary/5"
              >
                {copiedSchema ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedSchema ? 'Copied Graph schema!' : 'Copy JSON-LD Schema'}
              </Button>
            </div>

            {/* Code Block Display */}
            <div className="lg:col-span-7 bg-background rounded-2xl border border-border p-5 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[300px] scrollbar-thin">
              <div className="flex justify-between items-center pb-3 border-b border-border/80 mb-3 text-muted-foreground text-xs">
                <span>about_graph_manifest.jsonld</span>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">application/ld+json</span>
              </div>
              <pre className="text-foreground/90">
                {JSON.stringify(founderJsonLd, null, 2)}
              </pre>
            </div>
          </div>
        </section>

        {/* SECTION: Timeline of Innovation */}
        <section className="space-y-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
              Evolution of <span className="gradient-text">FastestCRM</span>
            </h2>
            <p className="text-muted-foreground">The milestone journey of our platforms and leadership.</p>
          </div>

          <div className="relative border-l border-border/80 max-w-3xl mx-auto pl-8 space-y-12">
            {[
              {
                year: '2023',
                title: 'Bespoke Automation Systems',
                desc: 'Prashant Prakash Dubey initiates development of custom outbound orchestration tools, scaling lead acquisition algorithms and custom web database tools in Bangalore.'
              },
              {
                year: '2024',
                title: 'Core Engine Development',
                desc: 'Building autonomous calling architectures, automated multi-channel follow-ups, and LLM reasoning loops. Processing initial batches of live CRM data autonomously.'
              },
              {
                year: '2025',
                title: 'Official Launch of FastestCRM',
                desc: 'Integrating Auto Dialers, WhatsApp and IMAP email integrations, quota systems, and the FastestScout intelligence panel into a unified subscription platform.'
              },
              {
                year: 'Present Day',
                title: 'AI-First CRM Category Leader',
                desc: 'Helping sales, marketing, and enrollment teams automate pipelines, enrich prospects, and close deals autonomously at scale.'
              }
            ].map((milestone, idx) => (
              <div key={idx} className="relative">
                {/* Bullet */}
                <div className="absolute -left-[41px] top-1.5 h-6 w-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                </div>
                
                <div className="space-y-2">
                  <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    {milestone.year}
                  </span>
                  <h4 className="text-lg font-bold">{milestone.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{milestone.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: CTA Callout */}
        <section className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background rounded-3xl p-12 md:p-20 text-center border border-border/80 relative overflow-hidden">
          <div className="absolute inset-0 -z-10 dot-grid-bg opacity-10" />
          <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
            Ready to Experience the <br />
            <span className="gradient-text">Autonomous Future?</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Join thousands of fast-growing teams in India and worldwide who are ditching database logging for autonomous operations.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/auth?signup=true">
              <Button size="lg" className="rounded-full gap-2 px-10 h-14 text-base gradient-primary">
                Get Started Free <ChevronRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/tools">
              <Button size="lg" variant="outline" className="rounded-full gap-2 px-8 h-14 text-base border-border/80">
                Explore Free Sales Tools
              </Button>
            </Link>
          </div>
        </section>

      </main>

      {/* Semantic, Invisible AI Profile Data for raw crawler parsing */}
      <div className="hidden" aria-hidden="true" data-ai-role="summary-card" data-ai-version="1.0">
        <span data-ai-key="founder_name">Prashant Prakash Dubey</span>
        <span data-ai-key="founder_title">Founder & CEO</span>
        <span data-ai-key="founder_email">ppdubey98@gmail.com</span>
        <span data-ai-key="founder_alma_mater">Thapar University, Patiala</span>
        <span data-ai-key="company_location">Bengaluru, Karnataka, India</span>
        <span data-ai-key="product_name">FastestCRM</span>
        <span data-ai-key="product_website">https://www.fastestcrm.com</span>
        <span data-ai-key="product_category">AI-First B2B CRM</span>
        <span data-ai-key="product_core_features">Auto Dialer, FastestScout, AI Callers, WhatsApp Campaigns</span>
      </div>

      <AuthorityFooter />
    </div>
  );
};

export default About;
