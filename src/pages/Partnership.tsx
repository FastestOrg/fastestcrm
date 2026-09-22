import React, { useState, useId, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/SEO';
import AuthorityFooter from '@/components/layout/AuthorityFooter';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import {
  Users, Handshake, Zap, Target, TrendingUp, Shield, Sparkles, Award,
  CheckCircle2, ArrowRight, Building2, Gift, DollarSign, Calculator,
  ChevronDown, ChevronUp, Copy, Check, ExternalLink, HelpCircle, Code,
  Laptop, Globe, Headphones, FileText, Rocket, Lock
} from 'lucide-react';

export default function Partnership() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Calculator State
  const [calcTier, setCalcTier] = useState<'agency' | 'affiliate' | 'white_label'>('agency');
  const [clientsCount, setClientsCount] = useState<number>(10);
  const [avgSeats, setAvgSeats] = useState<number>(5);

  // Application Modal State
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'affiliate' | 'agency' | 'white_label'>('affiliate');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [expectedClients, setExpectedClients] = useState('5-10');
  const [submitting, setSubmitting] = useState(false);

  // Detect query params (e.g. /partnership?track=agency&apply=true)
  useEffect(() => {
    const track = searchParams.get('track');
    const apply = searchParams.get('apply');
    if (track === 'agency' || track === 'affiliate' || track === 'white_label') {
      setSelectedCategory(track);
      setCalcTier(track);
    }
    if (apply === 'true' || track) {
      setApplyModalOpen(true);
    }
  }, [searchParams]);

  // FAQ State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Earnings Math
  const SEAT_PRICE = 1200; // ₹1,200/user/month standard CRM tier
  const monthlyClientSpend = avgSeats * SEAT_PRICE;
  const totalMonthlySpend = clientsCount * monthlyClientSpend;

  let estimatedMonthlyEarnings = 0;
  let estimatedAnnualEarnings = 0;
  let clientSavings = Math.round(clientsCount * 500); // 10% discount on initial ₹5,000 topup

  if (calcTier === 'agency') {
    // 40% lifetime commission on license fees
    estimatedMonthlyEarnings = Math.round(totalMonthlySpend * 0.40);
    estimatedAnnualEarnings = estimatedMonthlyEarnings * 12;
  } else if (calcTier === 'affiliate') {
    // 1 month license fee bounty per client (on quarterly plan)
    // Avg quarterly client spend = 3 months
    estimatedMonthlyEarnings = Math.round(clientsCount * monthlyClientSpend);
    estimatedAnnualEarnings = estimatedMonthlyEarnings * 12;
  } else if (calcTier === 'white_label') {
    // ₹50,000/mo platform fee, 100% of license sales retained
    const grossRevenue = totalMonthlySpend;
    estimatedMonthlyEarnings = Math.max(0, grossRevenue - 50000);
    estimatedAnnualEarnings = estimatedMonthlyEarnings * 12;
  }

  // Handle Partner Application
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let activeUserId = user?.id;

      // If user not logged in, create account
      if (!activeUserId) {
        if (!password || password.length < 6) {
          throw new Error('Please provide a secure password (min 6 characters)');
        }
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() }
          }
        });

        if (authError) throw authError;
        activeUserId = authData.user?.id;

        if (!authData.session && !user) {
          // Email confirmation is required
          const codeBase = (companyName || fullName || 'PARTNER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const referralCode = `FAST-${codeBase || 'CRM'}-${randomSuffix}`;
          const commRate = selectedCategory === 'agency' ? 40 : selectedCategory === 'white_label' ? 100 : 33;

          await supabase.from('partners').insert({
            user_id: activeUserId || null,
            full_name: fullName.trim(),
            email: email.trim(),
            company_name: companyName.trim() || null,
            website: website.trim() || null,
            phone: phone.trim() || null,
            category: 'affiliate',
            status: 'active',
            referral_code: referralCode,
            commission_rate: commRate,
            fixed_monthly_cost: selectedCategory === 'white_label' ? 50000 : 0,
            custom_terms: {
              requested_category: selectedCategory,
              expected_clients: expectedClients
            }
          });

          toast({
            title: 'Partner Account Created! 🎉',
            description: `Please verify your email address (${email}) and sign in to access your partner dashboard.`,
          });

          setApplyModalOpen(false);
          navigate('/auth');
          return;
        }
      }

      // Generate unique referral code
      const codeBase = (companyName || fullName || 'PARTNER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const referralCode = `FAST-${codeBase || 'CRM'}-${randomSuffix}`;

      // Calculate initial commission rate
      const commRate = selectedCategory === 'agency' ? 40 : selectedCategory === 'white_label' ? 100 : 33;
      const fixedCost = selectedCategory === 'white_label' ? 50000 : 0;

      // Insert into partners table (defaulting to affiliate as per user rule)
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .insert({
          user_id: activeUserId || null,
          full_name: fullName.trim(),
          email: email.trim(),
          company_name: companyName.trim() || null,
          website: website.trim() || null,
          phone: phone.trim() || null,
          category: 'affiliate', // initially joined as affiliate
          status: 'active',
          referral_code: referralCode,
          commission_rate: commRate,
          fixed_monthly_cost: fixedCost,
          custom_terms: {
            requested_category: selectedCategory,
            expected_clients: expectedClients
          }
        })
        .select()
        .single();

      if (partnerError) throw partnerError;

      toast({
        title: 'Partner Account Activated! 🎉',
        description: `Welcome to Fastest CRM! Your referral code is ${referralCode}`,
      });

      setApplyModalOpen(false);
      navigate('/dashboard/partner');

    } catch (err: any) {
      toast({
        title: 'Application Error',
        description: err.message || 'Failed to submit application',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How does the Partner Referral & 10% Client Discount work?',
      a: 'Every partner receives a unique referral code and direct tracking link (e.g. fastestcrm.com/r/YOURCODE). When your referred clients sign up and perform their first wallet recharge, they receive an instant 10% discount on that topup, and your partner account is automatically credited.'
    },
    {
      q: 'What is the commission payout for Affiliates?',
      a: 'Affiliates receive a one-off bounty equal to 1 full month of license fees for every client referred who subscribes to a minimum quarterly plan. For instance, if a client brings a 10-seat team (₹12,000/month), you earn a flat ₹12,000 payout upon their quarterly activation.'
    },
    {
      q: 'How does the Agency / Technology / Integration Partner 40% Lifetime model work?',
      a: 'Agency & Tech Partners earn 40% recurring revenue share on all license fees paid by their clients for the lifetime of those accounts. As long as your client remains active on Fastest CRM, you receive 40% every single month.'
    },
    {
      q: 'What are the terms for the White-Label Partnership?',
      a: 'White-Label Partners pay a flat platform infrastructure fee of ₹50,000/month. Under this tier, you can sell unlimited seats to your clients under your own custom domain, logo, and brand theme while retaining 100% of all software license revenue.'
    },
    {
      q: 'When and how are commissions paid out?',
      a: 'Commissions are calculated in real time in your Partner Dashboard and settled monthly via Direct Bank Transfer (NEFT/RTGS/IMPS), UPI, or Razorpay payouts with zero transfer fees.'
    },
    {
      q: 'Can I upgrade my partnership category later?',
      a: 'Yes! All partners join instantly under the Affiliate track. From your Partner Dashboard (/dashboard/partner), you can request an upgrade to Agency (40% Lifetime) or White-Label at any time with 1 click.'
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO
        title="SaaS Partnership Program | Earn up to 40% Recurring | Fastest CRM"
        description="Join the Fastest CRM Partner Ecosystem. Earn 40% lifetime commission as an Agency, 1-month license bounties as an Affiliate, or launch a ₹50k White-Label CRM retaining 100% margin."
        keywords="saas partner program, crm affiliate program, white label crm, agency partnership, b2b saas revenue share, fastest crm partners"
      />

      {/* ── Global Top Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 backdrop-blur-md">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM <span className="text-primary text-sm font-semibold tracking-normal">Partners</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard/partner">
                <Button variant="outline" size="sm" className="gap-2 border-primary/40 text-primary hover:bg-primary/10 font-semibold">
                  <Handshake className="h-4 w-4" />
                  Partner Cockpit
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm">Partner Login</Button>
              </Link>
            )}
            <Button
              size="sm"
              className="gradient-primary font-bold shadow-lg shadow-primary/20"
              onClick={() => {
                if (user) {
                  navigate('/dashboard/partner');
                } else {
                  setSelectedCategory('affiliate');
                  setApplyModalOpen(true);
                }
              }}
            >
              {user ? 'My Partner Dashboard' : 'Join Partner Program'}
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="pt-36 pb-24 px-6 relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/15 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="container mx-auto max-w-5xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold uppercase tracking-widest font-mono">
            <Sparkles className="h-3.5 w-3.5" />
            High-Velocity SaaS Partnership Ecosystem
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Scale Your Revenue with the <span className="gradient-text">Fastest AI CRM</span>
          </h1>

          <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Partner with the next-generation sales platform. Earn up to <strong className="text-foreground">40% lifetime recurring commissions</strong>, monetise your network with instant bounties, or launch your own <strong className="text-foreground">100% margin White-Label CRM</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base font-bold px-8 py-6 gradient-primary shadow-xl shadow-primary/25 hover:opacity-95 transition-all"
              onClick={() => {
                setSelectedCategory('affiliate');
                setApplyModalOpen(true);
              }}
            >
              Become a Partner in 60s
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <a href="#calculator">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base font-semibold px-8 py-6 border-border/80 hover:bg-card">
                <Calculator className="mr-2 h-5 w-5 text-primary" />
                Calculate Your Earnings
              </Button>
            </a>
          </div>

          {/* Key Value Prop Highlights */}
          <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
              <p className="text-2xl md:text-3xl font-bold text-primary">40%</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase mt-1 tracking-wider">Lifetime Agency Share</p>
            </div>
            <div className="p-4 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
              <p className="text-2xl md:text-3xl font-bold text-emerald-400">100%</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase mt-1 tracking-wider">White-Label Revenue Retained</p>
            </div>
            <div className="p-4 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
              <p className="text-2xl md:text-3xl font-bold text-amber-400">10% Off</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase mt-1 tracking-wider">First Topup for Your Clients</p>
            </div>
            <div className="p-4 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
              <p className="text-2xl md:text-3xl font-bold text-blue-400">90 Days</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase mt-1 tracking-wider">Cookie Tracking Window</p>
            </div>
          </div>
        </div>
      </section>

      <BreadcrumbSection items={[{ name: 'Partnership Program', path: '/partnership' }]} />

      <main className="container mx-auto px-6 py-20 space-y-28">

        {/* ── 3 Partnership Tiers Section ── */}
        <section className="space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-widest text-primary font-mono">
              Tailored Programs
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Choose Your Partnership Track
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Whether you are an implementation agency, content creator, or enterprise software distributor, we offer aggressive economics designed to maximize your recurring profits.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Tier 1: Agency / Tech Partner */}
            <Card className="rounded-3xl border-2 border-primary/40 bg-gradient-to-b from-primary/10 via-card to-card relative overflow-hidden flex flex-col justify-between shadow-xl shadow-primary/10 hover:border-primary transition-all duration-300">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest font-mono">
                Most Popular
              </div>
              <CardHeader className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-2">
                  <Handshake className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Agency &amp; Tech Partner
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  For digital marketing agencies, CRM consultants, and SaaS software integrators implementing solutions for clients.
                </CardDescription>
                <div className="pt-4 border-t border-border/50">
                  <span className="text-4xl font-extrabold text-foreground">40%</span>
                  <span className="text-xs text-muted-foreground font-semibold ml-2 uppercase tracking-wide">Lifetime Commission</span>
                  <p className="text-xs text-primary font-medium mt-1">Paid monthly on all client license fees</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>40% Lifetime Recurring:</strong> Earn every month for the entire client lifecycle.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Free Internal NFR Sandbox:</strong> Full-featured Fastest CRM workspace for your agency.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Dedicated Partner Manager:</strong> Direct WhatsApp &amp; Slack line for deal support.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>REST API &amp; Webhooks:</strong> Deep telemetry integration for your custom apps.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>10% Client Topup Discount:</strong> Pass exclusive savings to your clients.</span>
                  </li>
                </ul>

                <div className="pt-4 space-y-3">
                  <Button
                    className="w-full font-bold gradient-primary"
                    onClick={() => {
                      setSelectedCategory('agency');
                      setApplyModalOpen(true);
                    }}
                  >
                    Apply as Agency Partner
                  </Button>
                  <Link to="/partnership/agency" className="block text-center text-xs font-semibold text-primary hover:underline">
                    View Agency Program Deep-Dive &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Tier 2: Affiliate Partner */}
            <Card className="rounded-3xl border border-border/70 bg-card/70 relative overflow-hidden flex flex-col justify-between hover:border-border transition-all duration-300">
              <CardHeader className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-2">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Affiliate Partner
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  For creators, educators, B2B influencers, and sales coaches looking to monetize their audience and network.
                </CardDescription>
                <div className="pt-4 border-t border-border/50">
                  <span className="text-4xl font-extrabold text-foreground">1 Month</span>
                  <span className="text-xs text-muted-foreground font-semibold ml-2 uppercase tracking-wide">License Bounty</span>
                  <p className="text-xs text-amber-400 font-medium mt-1">On all quarterly plan subscriptions sold</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>100% of 1st Month Value:</strong> Fast lump-sum cash payouts on closed deals.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Minimum Quarterly Plan:</strong> High-ticket deal qualification protects quality.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>90-Day Cookie Window:</strong> Receive credit even if leads convert months later.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>10% Audience Discount:</strong> High-converting incentive code for your followers.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Instant Auto-Approval:</strong> Start sharing links within 60 seconds of registration.</span>
                  </li>
                </ul>

                <div className="pt-4 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full font-bold border-amber-500/30 hover:bg-amber-500/10 text-amber-300"
                    onClick={() => {
                      setSelectedCategory('affiliate');
                      setApplyModalOpen(true);
                    }}
                  >
                    Join Affiliate Track
                  </Button>
                  <Link to="/partnership/affiliate" className="block text-center text-xs font-semibold text-amber-400 hover:underline">
                    View Affiliate Program Details &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Tier 3: White-Label Partner */}
            <Card className="rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 via-card to-card relative overflow-hidden flex flex-col justify-between hover:border-emerald-500/60 transition-all duration-300">
              <CardHeader className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <Rocket className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                  White-Label Partner
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  For IT providers, MSPs, and regional distributors launching a proprietary branded CRM with unlimited margin.
                </CardDescription>
                <div className="pt-4 border-t border-border/50">
                  <span className="text-4xl font-extrabold text-foreground">₹50K</span>
                  <span className="text-xs text-muted-foreground font-semibold ml-2 uppercase tracking-wide">/ Month Base</span>
                  <p className="text-xs text-emerald-400 font-medium mt-1">Keep 100% of all license revenues sold</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>100% Revenue Retention:</strong> Zero revenue sharing on licenses above base fee.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Custom Domain &amp; Theme:</strong> Full white-labeling with your company logo &amp; colors.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Unlimited Licenses:</strong> Sell 50 or 5,000 users without additional software royalties.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Enterprise SLA &amp; Support:</strong> Sub-second routing engine with 99.95% uptime SLA.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>BYOS Database Option:</strong> Connect your client's private Supabase/Postgres cluster.</span>
                  </li>
                </ul>

                <div className="pt-4 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full font-bold border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300"
                    onClick={() => {
                      setSelectedCategory('white_label');
                      setApplyModalOpen(true);
                    }}
                  >
                    Apply for White-Label License
                  </Button>
                  <Link to="/partnership/white-label" className="block text-center text-xs font-semibold text-emerald-400 hover:underline">
                    View White-Label Program Deep-Dive &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Interactive ROI & Earnings Calculator ── */}
        <section id="calculator" className="p-8 md:p-14 rounded-3xl bg-card border border-border/80 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-3">
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-mono uppercase">
                  Interactive Model
                </Badge>
                <h3 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Estimate Your Partner Revenue
                </h3>
                <p className="text-muted-foreground text-sm md:text-base">
                  Simulate your recurring passive income based on your client network and preferred partnership tier.
                </p>
              </div>

              {/* Tier Toggle */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">Select Partner Track</Label>
                <div className="grid grid-cols-3 gap-3 p-1.5 rounded-2xl bg-secondary/20 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setCalcTier('agency')}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      calcTier === 'agency'
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Agency (40% Lifetime)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcTier('affiliate')}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      calcTier === 'affiliate'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Affiliate (1-Mo Bounty)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcTier('white_label')}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      calcTier === 'white_label'
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    White-Label (100% Cut)
                  </button>
                </div>
              </div>

              {/* Slider 1: Clients Referred */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground">Clients Referred / Onboarded</span>
                  <span className="font-mono font-bold text-lg text-primary">{clientsCount} companies</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={clientsCount}
                  onChange={(e) => setClientsCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                  <span>1 client</span>
                  <span>50 clients</span>
                  <span>100+ clients</span>
                </div>
              </div>

              {/* Slider 2: Average Users / Team Size */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground">Average Users per Client Team</span>
                  <span className="font-mono font-bold text-lg text-primary">{avgSeats} sales seats</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="50"
                  value={avgSeats}
                  onChange={(e) => setAvgSeats(parseInt(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                  <span>3 seats (Startup)</span>
                  <span>25 seats (Mid-Market)</span>
                  <span>50+ seats (Enterprise)</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-secondary/15 border border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                <span>Total Managed Seats: <strong className="text-foreground">{clientsCount * avgSeats} users</strong></span>
                <span>Avg License Value: <strong className="text-foreground font-mono">₹{SEAT_PRICE.toLocaleString()}/seat/mo</strong></span>
              </div>
            </div>

            {/* Right Projection Card */}
            <div className="lg:col-span-5 p-8 rounded-3xl bg-gradient-to-br from-card via-card to-primary/10 border border-primary/30 space-y-6 text-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-mono">
                  Estimated Monthly Passive Income
                </p>
                <div className="text-4xl md:text-5xl font-black text-foreground mt-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                  ₹{estimatedMonthlyEarnings.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {calcTier === 'agency' ? 'Recurring every month continuously' : calcTier === 'white_label' ? 'Net profit after ₹50K infrastructure cost' : 'Average monthly bounty revenue'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border/60 text-left space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Annual Recurring Payout:</span>
                  <span className="font-mono font-bold text-lg text-primary">₹{estimatedAnnualEarnings.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Client 1st Topup Savings:</span>
                  <span className="font-mono font-bold text-emerald-400">₹{clientSavings.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Commission Frequency:</span>
                  <span className="font-semibold text-foreground font-mono">30-Day Automated</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full font-bold gradient-primary shadow-lg shadow-primary/25"
                onClick={() => {
                  setSelectedCategory(calcTier);
                  setApplyModalOpen(true);
                }}
              >
                Claim This Partner Revenue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-[11px] text-muted-foreground">
                No credit card required. Payouts processed via Razorpay / Direct Bank Transfer.
              </p>
            </div>
          </div>
        </section>

        {/* ── Partner Benefits & Enablement Grid ── */}
        <section className="space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-widest text-primary font-mono">
              Partner Enablement
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Everything You Need to Win Deals
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              We treat our partners as an extension of our core team with dedicated tooling, resources, and co-marketing investment.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4 hover:border-primary/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Laptop className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold">Free NFR / Sandbox Account</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get a completely free, unrestricted Not-For-Resale enterprise workspace of Fastest CRM for your internal team to use, test, and demo to prospects.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4 hover:border-primary/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Headphones className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold">Dedicated Partner Manager</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Direct access to our senior solutions architects via WhatsApp and dedicated Slack channel to assist in RFP proposals, demos, and enterprise closes.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4 hover:border-primary/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Globe className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold">Co-Marketing &amp; Directory</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Featured placement on the official Fastest CRM Partner Directory, joint press releases, case study spotlights, and co-hosted webinars.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4 hover:border-primary/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold">Sales Enablement Decks</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ready-to-brand pitch decks, email swipe templates, objection-handling scripts, and head-to-head comparison battlecards vs Zoho, HubSpot, and LeadSquared.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4 hover:border-primary/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Lock className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold">Deal Registration &amp; Protection</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lock your client opportunities for 90 days with guaranteed non-compete rules. Fastest CRM direct sales will never poach or conflict with registered deals.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/60 space-y-4 hover:border-primary/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Gift className="h-6 w-6" />
              </div>
              <h4 className="text-xl font-bold">Client 10% Topup Discount</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your unique code automatically unlocks a 10% discount on your client's first wallet topup, giving you an irresistible closing hook for your leads.
              </p>
            </div>
          </div>
        </section>

        {/* ── Step-by-Step Onboarding (4 Steps) ── */}
        <section className="space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-widest text-primary font-mono">
              Simple 4-Step Process
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              How It Works
            </h2>
            <p className="text-muted-foreground text-base">
              Get onboarded, start referring, and receive automated payouts in 4 seamless steps.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold font-mono mx-auto flex items-center justify-center">
                1
              </div>
              <h5 className="font-bold text-lg">Apply in 60s</h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete the partner application form. Your account is immediately activated in the Affiliate tier with zero friction.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold font-mono mx-auto flex items-center justify-center">
                2
              </div>
              <h5 className="font-bold text-lg">Get Your Link &amp; Code</h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Access your Partner Dashboard to retrieve your unique referral link and 10% client discount voucher code.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold font-mono mx-auto flex items-center justify-center">
                3
              </div>
              <h5 className="font-bold text-lg">Refer or Implement</h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Introduce Fastest CRM to your clients, embed your link in content, or provision customer workspaces directly.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold font-mono mx-auto flex items-center justify-center">
                4
              </div>
              <h5 className="font-bold text-lg">Get Paid &amp; Upgrade</h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Track signups and commissions in real time. Receive monthly payouts and request upgrades to Agency (40%) or White-Label anytime.
              </p>
            </div>
          </div>
        </section>

        {/* ── FAQ Section ── */}
        <section className="space-y-8 max-w-4xl mx-auto">
          <div className="text-center space-y-3">
            <Badge variant="outline" className="text-xs uppercase tracking-widest text-primary font-mono">
              Got Questions?
            </Badge>
            <h3 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-card border border-border/60 cursor-pointer transition-all hover:border-primary/40"
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
              >
                <div className="flex justify-between items-center gap-4">
                  <h4 className="font-bold text-base md:text-lg text-foreground">{faq.q}</h4>
                  {expandedFaq === idx ? (
                    <ChevronUp className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                </div>
                {expandedFaq === idx && (
                  <p className="text-sm text-muted-foreground mt-4 leading-relaxed border-t border-border/40 pt-4">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="p-10 md:p-16 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/10 to-card border border-primary/30 text-center space-y-6 relative overflow-hidden">
          <h2 className="text-3xl md:text-5xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            Ready to Build a High-Growth Revenue Channel?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
            Join hundreds of forward-thinking agencies, tech consultants, and affiliates scaling their business with Fastest CRM.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button
              size="lg"
              className="text-base font-bold px-8 py-6 gradient-primary shadow-xl shadow-primary/25"
              onClick={() => {
                setSelectedCategory('affiliate');
                setApplyModalOpen(true);
              }}
            >
              Apply to Partner Program
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="text-base font-semibold px-8 py-6">
                Log into Partner Portal
              </Button>
            </Link>
          </div>
        </section>

      </main>

      {/* ── Partner Application Modal ── */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
              Join Fastest CRM Partner Program
            </DialogTitle>
            <DialogDescription>
              Join the ecosystem today. You will initially be activated in the Affiliate track with your instant unique referral link and 10% client discount voucher.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApply} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="category">Select Initial Track of Interest</Label>
              <Select
                value={selectedCategory}
                onValueChange={(val: any) => setSelectedCategory(val)}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="affiliate">Affiliate Partner (1 Month License Bounty)</SelectItem>
                  <SelectItem value="agency">Agency &amp; Tech Partner (40% Lifetime Recurring)</SelectItem>
                  <SelectItem value="white_label">White-Label Partner (₹50K/mo, 100% Margin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  required
                  placeholder="e.g. Alex Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone / WhatsApp *</Label>
                <Input
                  id="phone"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Work Email *</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="alex@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!user?.email}
              />
            </div>

            {!user && (
              <div className="space-y-2">
                <Label htmlFor="password">Create Partner Portal Password *</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Agency / Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="e.g. HyperGrowth Media"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website / Social URL</Label>
                <Input
                  id="website"
                  placeholder="https://agency.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="volume">Expected Clients per Quarter</Label>
              <Select value={expectedClients} onValueChange={setExpectedClients}>
                <SelectTrigger id="volume">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-4">1 – 4 clients</SelectItem>
                  <SelectItem value="5-10">5 – 10 clients</SelectItem>
                  <SelectItem value="11-25">11 – 25 clients</SelectItem>
                  <SelectItem value="25+">25+ enterprise clients</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-muted-foreground flex items-center gap-3">
              <Gift className="h-5 w-5 text-primary shrink-0" />
              <span>
                Your referral code will grant your clients an immediate <strong>10% discount</strong> on their first wallet topup!
              </span>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full font-bold gradient-primary py-5 mt-2"
            >
              {submitting ? 'Activating Partner Account...' : 'Activate Partner Account'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AuthorityFooter />
    </div>
  );
}
