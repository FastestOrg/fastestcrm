import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import SEO from '@/components/SEO';
import AuthorityFooter from '@/components/layout/AuthorityFooter';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import {
  Handshake, Zap, Shield, CheckCircle2, ArrowRight, Laptop,
  Code, Headphones, DollarSign, Database, Layers, Sparkles, Gift
} from 'lucide-react';

export default function PartnershipAgency() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO
        title="Agency & Technology Partner Program | 40% Lifetime Commission | Fastest CRM"
        description="Earn 40% lifetime recurring commissions on client license fees. Access free NFR sandbox workspaces, REST APIs, and dedicated partner management."
        keywords="crm agency partner, saas tech partnership, 40% recurring commission, crm system integrator, fastest crm agency"
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 backdrop-blur-md">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/partnership" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM <span className="text-primary text-sm font-semibold tracking-normal">Agency Track</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/partnership">
              <Button variant="ghost" size="sm">All Programs</Button>
            </Link>
            {user ? (
              <Link to="/dashboard/partner">
                <Button variant="outline" size="sm" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 font-semibold">
                  <Handshake className="h-4 w-4" />
                  Partner Cockpit
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm">Partner Login</Button>
              </Link>
            )}
            <Link to="/partnership?track=agency&apply=true">
              <Button size="sm" className="gradient-primary font-bold">
                {user ? 'My Partner Dashboard' : 'Apply Now'}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-mono uppercase tracking-widest">
            Agency &amp; Integration Track
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Earn <span className="gradient-text">40% Lifetime Recurring</span> on Client CRM Subscriptions
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Designed for digital marketing agencies, sales consultancies, and system integrators. Provide your clients with the fastest AI CRM while securing high-margin monthly recurring revenue.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/partnership?track=agency&apply=true">
              <Button size="lg" className="gradient-primary font-bold px-8 py-6 shadow-xl shadow-primary/25">
                Apply for Agency Partnership
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/partnership#calculator">
              <Button size="lg" variant="outline" className="px-8 py-6">
                Calculate 40% Share
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <BreadcrumbSection items={[
        { name: 'Partnership Program', path: '/partnership' },
        { name: 'Agency & Tech', path: '/partnership/agency' }
      ]} />

      <main className="container mx-auto px-6 py-20 space-y-24 max-w-6xl">
        {/* Key Metrics */}
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <Card className="p-8 rounded-3xl bg-card border border-primary/30">
            <p className="text-5xl font-black text-primary font-mono">40%</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Lifetime Recurring</p>
            <p className="text-xs text-muted-foreground mt-1">Paid monthly as long as the client remains active</p>
          </Card>
          <Card className="p-8 rounded-3xl bg-card border border-border/60">
            <p className="text-5xl font-black text-emerald-400 font-mono">10%</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Client Wallet Discount</p>
            <p className="text-xs text-muted-foreground mt-1">First topup discount via your exclusive link</p>
          </Card>
          <Card className="p-8 rounded-3xl bg-card border border-border/60">
            <p className="text-5xl font-black text-amber-400 font-mono">Free</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">NFR Agency Workspace</p>
            <p className="text-xs text-muted-foreground mt-1">Full-featured internal account for your own team</p>
          </Card>
        </div>

        {/* Deep Dive Capabilities */}
        <section className="space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Why Leading Agencies Recommend Fastest CRM
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Legacy CRMs like Zoho and HubSpot have high churn and complex setup. Fastest CRM delivers sub-second speeds, native WhatsApp &amp; Razorpay links, and effortless onboarding.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Code className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Robust REST API &amp; Webhooks</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Connect your client's landing pages, Facebook Lead Ads, Google Ads, and custom backends in minutes. Sub-second webhook processing guarantees leads are never missed or delayed.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Laptop className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Client Multi-Tenancy &amp; Governance</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Seamlessly configure team hierarchies from CBO to Telecaller with granular masking of customer phone numbers, automated commission tracking, and Chartered Accountant role views.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Headphones className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Joint RFP &amp; Co-Selling Priority</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Bring our solution engineers to your client pitch calls. We help you design technical architectures, build custom quotation templates, and close 6-figure enterprise retainers.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Guaranteed Deal Registration</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Register prospect domains in your Partner Dashboard. Fastest CRM guarantees 90 days of exclusive deal protection, ensuring our direct team never contacts your registered accounts.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="p-12 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/10 to-card border border-primary/30 text-center space-y-6">
          <h3 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            Ready to Partner with Fastest CRM?
          </h3>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Submit your agency profile in 60 seconds. You will be activated in the partner ecosystem with your unique referral link and instant discount codes.
          </p>
          <Link to="/partnership?track=agency&apply=true">
            <Button size="lg" className="gradient-primary font-bold px-8 py-6">
              Join Agency Partner Program
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>
      </main>

      <AuthorityFooter />
    </div>
  );
}
