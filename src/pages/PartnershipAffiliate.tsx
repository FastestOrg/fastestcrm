import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import SEO from '@/components/SEO';
import AuthorityFooter from '@/components/layout/AuthorityFooter';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import {
  Zap, Shield, CheckCircle2, ArrowRight, DollarSign,
  Gift, Users, Sparkles, TrendingUp, Award, Laptop, Handshake,
  Clock, BarChart2, Share2
} from 'lucide-react';

export default function PartnershipAffiliate() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO
        title="Affiliate Partner Program | 1-Month License Bounty | Fastest CRM"
        description="Earn 1 full month of client CRM subscription fees as an instant bounty. Minimum quarterly plan required. 90-day tracking cookie and weekly payouts."
        keywords="crm affiliate program, saas referral partner, crm affiliate bounty, software affiliate commissions, fastest crm affiliate"
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 backdrop-blur-md">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/partnership" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM <span className="text-amber-400 text-sm font-semibold tracking-normal">Affiliate Track</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/partnership">
              <Button variant="ghost" size="sm">All Programs</Button>
            </Link>
            {user ? (
              <Link to="/dashboard/partner">
                <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold">
                  <Handshake className="h-4 w-4" />
                  Partner Cockpit
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm">Partner Login</Button>
              </Link>
            )}
            <Link to="/partnership?track=affiliate&apply=true">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                {user ? 'My Partner Dashboard' : 'Join Affiliate Program'}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-background to-background">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-mono uppercase tracking-widest">
            Creator &amp; Affiliate Track
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Earn <span className="text-amber-400">1 Full Month License Bounty</span> on Every Client Referral
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Perfect for B2B creators, sales coaches, YouTubers, and consultants. Earn immediate lump-sum payouts on every qualified customer who subscribes to a quarterly or annual plan.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/partnership?track=affiliate&apply=true">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-6 shadow-xl shadow-amber-500/25">
                Join Affiliate Track in 60s
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/partnership#calculator">
              <Button size="lg" variant="outline" className="px-8 py-6">
                Calculate Bounty Revenue
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <BreadcrumbSection items={[
        { name: 'Partnership Program', path: '/partnership' },
        { name: 'Affiliate', path: '/partnership/affiliate' }
      ]} />

      <main className="container mx-auto px-6 py-20 space-y-24 max-w-6xl">
        {/* Core Terms */}
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <Card className="p-8 rounded-3xl bg-card border border-amber-500/30">
            <p className="text-5xl font-black text-amber-400 font-mono">1 Month</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Full License Bounty</p>
            <p className="text-xs text-muted-foreground mt-1">Lump sum payout equal to 100% of the first month subscription value</p>
          </Card>
          <Card className="p-8 rounded-3xl bg-card border border-border/60">
            <p className="text-5xl font-black text-primary font-mono">Quarterly+</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Qualification Rule</p>
            <p className="text-xs text-muted-foreground mt-1">Minimum 3-month commitment ensures serious high-LTV clients</p>
          </Card>
          <Card className="p-8 rounded-3xl bg-card border border-border/60">
            <p className="text-5xl font-black text-emerald-400 font-mono">10%</p>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2">Audience Incentive</p>
            <p className="text-xs text-muted-foreground mt-1">Your code provides 10% off their first wallet topup</p>
          </Card>
        </div>

        {/* Affiliate Features */}
        <section className="space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              How the Fastest CRM Affiliate Engine Empowers You
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              High conversion rates and generous terms make promoting Fastest CRM the most profitable partnership in your portfolio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">90-Day Cookie Attribution</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                When someone clicks your referral link, our system tracks them via persistent local cookies for 90 days. Even if they evaluate for weeks before upgrading to a quarterly plan, the credit is 100% yours.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Gift className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Built-In 10% Discount Hook</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Don't just share a plain referral link. Tell your audience: <em>"Use my link to get an extra 10% bonus discount on your first wallet recharge!"</em> This significantly spikes signup-to-paid conversion rates.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <BarChart2 className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Real-Time Conversion Portal</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Log into `/dashboard/partner` anytime to monitor clicks, company signups, payment statuses, and commission balances with instant transparent metrics.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Share2 className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold">Ready-to-Use Promo Swipe Kit</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Access curated social media templates, YouTube script shoutouts, LinkedIn carousel ideas, and branded badges directly in your Partner Dashboard.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="p-12 rounded-3xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-card border border-amber-500/30 text-center space-y-6">
          <h3 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            Start Earning Affiliate Bounties Today
          </h3>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Registration takes less than 60 seconds. You receive your referral code instantly with zero approval delays.
          </p>
          <Link to="/partnership?track=affiliate&apply=true">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-6">
              Create Free Affiliate Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>
      </main>

      <AuthorityFooter />
    </div>
  );
}
