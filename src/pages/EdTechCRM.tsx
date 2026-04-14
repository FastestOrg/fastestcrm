import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Users, Phone, CreditCard, Workflow,
  Brain, ArrowRight, Zap, Target, TrendingUp, Menu, X, ChevronDown, GraduationCap, Video, BookOpen
} from 'lucide-react';
import SEO from '@/components/SEO';
import { FAQSchema, SoftwareAppSchema, OrganizationSchema, BreadcrumbSchema } from '@/components/SchemaMarkup';
import { isAndroidWebView } from '@/lib/platform';

const features = [
  {
    icon: GraduationCap,
    title: 'Admission Analytics',
    description: 'Track the entire student journey from first inquiry to course enrollment with automated funnel tracking.'
  },
  {
    icon: Video,
    title: 'Trial Booking',
    description: 'Automate demo class and trial session bookings with Zoom/Google Meet integrations and WhatsApp reminders.'
  },
  {
    icon: Phone,
    title: 'Tele-Counseling Dialer',
    description: 'Power your counseling team with a high-speed auto-dialer. Call 200+ leads daily per counselor.'
  },
  {
    icon: Brain,
    title: 'Course-Lead Matching',
    description: 'AI-driven recommendations to suggest the best course for a student based on their interests and profiling.'
  },
  {
    icon: CreditCard,
    title: 'Fee Collection',
    description: 'Send Razorpay payment links for course fees. Automate GST invoices and enrollment status updates.'
  },
  {
    icon: Workflow,
    title: 'Drip Marketing',
    description: 'Automate student nurturing with sequence-based follow-ups via WhatsApp and Email to improve conversion.'
  }
];

const faqs = [
  { q: 'Can I track which ads are bringing student inquiries?', a: 'Yes! We integrate with Meta and Google Ads to track the exact source of every student lead for better ROI calculation.' },
  { q: 'Is it suitable for small training institutes?', a: 'Absolutely. Fastest CRM is built for teams of all sizes. You can start with a single user and scale as you grow.' },
  { q: 'Does it support multi-branch management?', a: 'Yes, our team hierarchy and role-based access allow you to manage multiple centers or branches under one company account.' },
  { q: 'Can counselors use it on their phones?', a: 'Yes, our mobile-optimized app allows counselors to manage leads, make calls, and update statuses on the go.' }
];

export default function EdTechCRM() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="Best EdTech & Coaching CRM in India | Student Admission Software"
        description="The fastest AI CRM for EdTech startups and coaching institutes. Automate admissions, counselor calling, and fee collection in one platform."
        keywords="edtech crm india, coaching institute software, admission management system, student lead tracking, sales crm for education"
        canonical="https://www.fastestcrm.com/crm-for-edtech"
      />
      <BreadcrumbSchema items={[
        { name: 'Home', item: 'https://www.fastestcrm.com' },
        { name: 'EdTech CRM', item: 'https://www.fastestcrm.com/crm-for-edtech' }
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
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold tracking-wide text-foreground/80 uppercase">The EdTech Sales Powerhouse</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            The Admission CRM for <span className="gradient-text">Fastest EdTechs</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Stop losing student inquiries. Automate tele-counseling, track demo classes, and collection fees with India's fastest AI-powered CRM.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register-company">
              <Button size="lg" className="h-14 px-10 text-base rounded-full gradient-primary font-bold shadow-xl" style={{ color: 'hsl(222 28% 5%)' }}>
                Try For Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-14 px-10 text-base rounded-full border-primary/30">
                Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>
              Admission <span className="gradient-text">Accelerators</span>
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

      <section className="py-24 px-6 border-y border-border/40">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-14 text-center" style={{ fontFamily: "'Syne', sans-serif" }}>
            EdTech <span className="gradient-text">FAQs</span>
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

      <footer className="py-12 px-6 border-t border-border/50 text-center text-sm text-muted-foreground">
        © 2025 Fastest CRM. All rights reserved.
      </footer>
    </div>
  );
}
