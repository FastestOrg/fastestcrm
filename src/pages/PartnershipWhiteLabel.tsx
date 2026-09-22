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
  Rocket, Globe, Palette, Shield, CheckCircle2, ArrowRight,
  Database, Server, Cpu, Lock, Layers, DollarSign, Handshake
} from 'lucide-react';

export default function PartnershipWhiteLabel() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO
        title="White-Label CRM Partnership | ₹50k/Mo Unlimited Seats | Fastest CRM"
        description="Launch your own branded AI CRM for ₹50,000/month flat fee. Sell unlimited licenses and retain 100% of all software revenues with custom domain and branding."
        keywords="white label crm, reselling crm software, launch own crm, unlimited crm licenses, white label sales crm, fastest crm white label"
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 backdrop-blur-md">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/partnership" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM <span className="text-emerald-400 text-sm font-semibold tracking-normal">White-Label Track</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/partnership">
              <Button variant="ghost" size="sm">All Programs</Button>
            </Link>
            {user ? (
              <Link to="/dashboard/partner">
                <Button variant="outline" size="sm" className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-semibold">
                  <Handshake className="h-4 w-4" />
                  Partner Cockpit
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm">Partner Login</Button>
              </Link>
            )}
            <Link to="/partnership?track=white_label&apply=true">
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                {user ? 'My Partner Dashboard' : 'Apply for License'}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden bg-gradient-to-b from-emerald-500/10 via-background to-background">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-mono uppercase tracking-widest">
            Distributor &amp; Enterprise Track
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Launch Your Own Branded AI CRM for <span className="text-emerald-400">₹50,000 / Month</span> Flat
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sell unlimited user licenses to your clients and retain <strong className="text-foreground">100% of all software revenue</strong>. Complete with your custom domain, logo, color theme, and enterprise SLA.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/partnership?track=white_label&apply=true">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 py-6 shadow-xl shadow-emerald-500/25">
                Apply for White-Label License
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/partnership#calculator">
              <Button size="lg" variant="outline" className="px-8 py-6">
                Calculate White-Label ROI
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <BreadcrumbSection items={[
        { name: 'Partnership Program', path: '/partnership' },
        { name: 'White-Label', path: '/partnership/white-label' }
      ]} />

      <main className="container mx-auto px-6 py-20 space-y-24 max-w-6xl">
        {/* Core Financial Economics */}
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <Card className="p-8 rounded-3xl bg-card border border-emerald-500/30">
            <p className="text-5xl font-black text-emerald-400 font-mono">₹50K</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Fixed Monthly Fee</p>
            <p className="text-xs text-muted-foreground mt-1">Predictable infrastructure and core software maintenance cost</p>
          </Card>
          <Card className="p-8 rounded-3xl bg-card border border-border/60">
            <p className="text-5xl font-black text-primary font-mono">100%</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Revenue Retained</p>
            <p className="text-xs text-muted-foreground mt-1">Zero revenue cuts or license royalties owed back to us</p>
          </Card>
          <Card className="p-8 rounded-3xl bg-card border border-border/60">
            <p className="text-5xl font-black text-amber-400 font-mono">Unlimited</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Seats &amp; Companies</p>
            <p className="text-xs text-muted-foreground mt-1">Onboard 10 or 10,000 sales reps with no extra per-seat fees</p>
          </Card>
        </div>

        {/* White Label Deep Dive Features */}
        <section className="space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Enterprise Infrastructure Under Your Brand
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              You own the customer relationships, pricing packages, and billing contracts. We handle the sub-second AI engine, auto-dialer clusters, and security updates.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Custom Domain &amp; SSL</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Deploy your CRM on `app.yourbrand.com` or `crm.youragency.com` with automated SSL provisioning via Vercel Edge. Fastest CRM branding is completely invisible.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Palette className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Custom Logo &amp; Brand Colors</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Upload your company logos, favicons, custom HSL color accents, and localized login screen copy. Your clients experience a 100% unified proprietary interface.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">BYOS (Bring Your Own Supabase)</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enterprise security compliance made effortless. Connect your clients to private dedicated Postgres database clusters in your chosen AWS or GCP cloud region.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Autonomous Auto-Dialer &amp; AI Engine</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Full access to our sub-second lead ingestion engine (300ms routing), predictive AI deal scoring, integrated WhatsApp messaging, and high-velocity outbound calling dialer.
              </p>
            </div>
          </div>
        </section>

        {/* Financial Comparison Box */}
        <section className="p-10 rounded-3xl bg-card border border-border/80 space-y-8">
          <h3 className="text-2xl md:text-3xl font-bold text-center" style={{ fontFamily: "'Syne', sans-serif" }}>
            The Math: How White-Label Partners Scale Profit
          </h3>

          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="p-6 rounded-2xl bg-secondary/20 space-y-3">
              <p className="font-bold text-base text-foreground">Scenario A: 5 Clients (25 Seats)</p>
              <p className="text-muted-foreground">Selling at ₹1,500/seat/mo = ₹37,500 gross.</p>
              <p className="text-xs text-amber-400 font-semibold">Break-even at ~33 total seats.</p>
            </div>
            <div className="p-6 rounded-2xl bg-secondary/20 space-y-3">
              <p className="font-bold text-base text-foreground">Scenario B: 15 Clients (100 Seats)</p>
              <p className="text-muted-foreground">Selling at ₹1,500/seat/mo = ₹1,50,000 gross.</p>
              <p className="text-xs text-emerald-400 font-bold">Net Profit: ₹1,00,000 / month (₹12 Lakhs / yr)</p>
            </div>
            <div className="p-6 rounded-2xl bg-secondary/20 space-y-3">
              <p className="font-bold text-base text-foreground">Scenario C: 40 Clients (400 Seats)</p>
              <p className="text-muted-foreground">Selling at ₹1,500/seat/mo = ₹6,00,000 gross.</p>
              <p className="text-xs text-emerald-400 font-bold">Net Profit: ₹5,50,000 / month (₹66 Lakhs / yr)</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="p-12 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-card border border-emerald-500/30 text-center space-y-6">
          <h3 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            Launch Your White-Label Software Empire
          </h3>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Apply today to secure your regional white-label rights and schedule your private onboarding deployment session with our engineering leads.
          </p>
          <Link to="/partnership?track=white_label&apply=true">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 py-6">
              Apply for White-Label Partnership
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>
      </main>

      <AuthorityFooter />
    </div>
  );
}
