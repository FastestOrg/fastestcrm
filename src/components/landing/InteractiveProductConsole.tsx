import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, PhoneCall, CreditCard, GitBranch, CheckCircle2, Sparkles, Volume2, ShieldCheck, ArrowRight, Zap, RefreshCw, Radio, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';

type ConsoleTab = 'qualifier' | 'dialer' | 'payment' | 'routing';

export function InteractiveProductConsole() {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('qualifier');

  // Qualifier state
  const scenarios = [
    {
      title: 'Commercial Real Estate Deal',
      text: 'Looking for 15,000 sq ft office space in Whitefield Bangalore, ready to close in 15 days. Budget ₹4.5 Cr.',
      score: 97,
      sentiment: 'High Urgency / C-Suite Buyer',
      predictedClose: '14 Days',
      action: 'Instant Priority Call · Route to Commercial Head'
    },
    {
      title: 'EdTech Multi-Campus Pilot',
      text: 'Need CRM for 45 telecallers handling 20,000 student inquiries/month. Require auto-dialer and WhatsApp integration.',
      score: 94,
      sentiment: 'High Volume / Approved Budget',
      predictedClose: '7 Days',
      action: 'Trigger WhatsApp Demo Video · Schedule Call'
    },
    {
      title: 'SaaS B2B Expansion',
      text: 'Evaluating replacements for HubSpot. Need sub-second lead ingestion, Razorpay links, and 12-level hierarchy.',
      score: 98,
      sentiment: 'Active Evaluation / High Intent',
      predictedClose: '5 Days',
      action: 'Assign to VP Enterprise · Send Comparison Deck'
    }
  ];
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSelectScenario = (index: number) => {
    setIsAnalyzing(true);
    setSelectedScenario(index);
    setTimeout(() => setIsAnalyzing(false), 400);
  };

  // Dialer state
  const [isCalling, setIsCalling] = useState(true);
  const [callSeconds, setCallSeconds] = useState(18);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalling) {
      interval = setInterval(() => {
        setCallSeconds((prev) => (prev >= 60 ? 12 : prev + 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  // Payment state
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSimulatePayment = () => {
    setPaymentSuccess(true);
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#10b981', '#06b6d4', '#6366f1', '#fbbf24']
    });
    setTimeout(() => setPaymentSuccess(false), 5000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl md:rounded-3xl border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_35px_rgba(20,184,166,0.12)] relative overflow-hidden text-left bg-slate-950/90 backdrop-blur-2xl">
      {/* Top Window Header Chrome (macOS Style) */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600/50" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/50" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/50" />
          <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-muted-foreground font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            fastestcrm.ai/live-engine-v2.4
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="hidden md:inline text-[11px] text-primary/90 font-medium">● Latency: 1.2ms</span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/25">
            LIVE SIMULATION
          </span>
        </div>
      </div>

      {/* Main Console Body */}
      <div className="p-5 md:p-8">
        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/[0.08] gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">Interactive AI Sandbox</span>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
              Test Real-Time Sales Workflows
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('qualifier')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                activeTab === 'qualifier'
                  ? 'bg-primary text-slate-950 shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
              }`}
            >
              <Brain className="h-4 w-4" />
              <span>AI Lead Scoring</span>
            </button>
            <button
              onClick={() => setActiveTab('dialer')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                activeTab === 'dialer'
                  ? 'bg-primary text-slate-950 shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
              }`}
            >
              <PhoneCall className="h-4 w-4" />
              <span>Auto-Dialer</span>
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                activeTab === 'payment'
                  ? 'bg-primary text-slate-950 shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>1-Click Payment</span>
            </button>
            <button
              onClick={() => setActiveTab('routing')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                activeTab === 'routing'
                  ? 'bg-primary text-slate-950 shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
              }`}
            >
              <GitBranch className="h-4 w-4" />
              <span>12-Tier Hierarchy</span>
            </button>
          </div>
        </div>

        {/* Tab 1: AI Lead Qualifier */}
        {activeTab === 'qualifier' && (
          <div className="pt-6 animate-in fade-in duration-300">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              Click a prospect inquiry below to trigger real-time FastAI scoring:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {scenarios.map((scenario, idx) => (
                <button
                  key={scenario.title}
                  onClick={() => handleSelectScenario(idx)}
                  className={`p-3.5 rounded-xl text-left border transition-all text-xs ${
                    selectedScenario === idx
                      ? 'border-primary bg-primary/[0.08] text-foreground font-semibold shadow-sm'
                      : 'border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-foreground/90">{scenario.title}</span>
                    {selectedScenario === idx && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] line-clamp-2 text-muted-foreground leading-relaxed">{scenario.text}</p>
                </button>
              ))}
            </div>

            {/* AI Result Card */}
            <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.08] relative overflow-hidden backdrop-blur-md">
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center gap-2.5 z-20">
                  <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                  <span className="text-xs font-bold text-primary font-mono">CALCULATING INTENT SCORE...</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Intent Radial Score */}
                <div className="md:col-span-5 lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <div className="relative flex items-center justify-center w-36 h-36 mb-3 p-1">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                      <path
                        className="text-white/10"
                        strokeWidth="2.8"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-primary"
                        strokeDasharray={`${scenarios[selectedScenario].score}, 100`}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-black text-foreground tracking-tight font-mono leading-none mb-1">
                        {scenarios[selectedScenario].score}%
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                        FastAI Intent
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-foreground/90 px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                    {scenarios[selectedScenario].sentiment}
                  </span>
                </div>

                {/* Details & Suggested Pitch */}
                <div className="md:col-span-7 lg:col-span-8 space-y-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/30">
                      Auto-Prioritized #1
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Target Close: <strong className="text-foreground">{scenarios[selectedScenario].predictedClose}</strong>
                    </span>
                  </div>

                  <p className="text-xs md:text-sm text-foreground/90 italic bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06] leading-relaxed">
                    "{scenarios[selectedScenario].text}"
                  </p>

                  <div className="p-3.5 rounded-xl bg-primary/[0.08] border border-primary/20 flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-foreground block">Autonomous AI Action:</span>
                      <span className="text-xs text-muted-foreground">{scenarios[selectedScenario].action}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: 1-Click Auto-Dialer */}
        {activeTab === 'dialer' && (
          <div className="pt-6 animate-in fade-in duration-300">
            <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.08] backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-base font-mono">
                    RM
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-foreground text-base tracking-tight">Rajesh Mehta</h4>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        High Intent
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">VP Operations · Whitefield, Bengaluru · ₹4.5 Cr</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-emerald-400">Connected 00:{callSeconds < 10 ? `0${callSeconds}` : callSeconds}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={isCalling ? 'destructive' : 'default'}
                    onClick={() => setIsCalling(!isCalling)}
                    className="rounded-xl text-xs h-8 font-semibold"
                  >
                    {isCalling ? 'End Call & Auto-Log' : 'Start Auto-Dial'}
                  </Button>
                </div>
              </div>

              {/* Audio Waveform Visualization */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-5">
                <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Volume2 className="h-4 w-4 text-primary" /> Live Audio Stream & Voice Sentiment Analysis
                  </span>
                  <span className="text-emerald-400 font-bold text-[11px] font-mono">Sentiment: 96% Positive</span>
                </div>
                <div className="flex items-center justify-between gap-1.5 h-10 px-2">
                  {[40, 75, 30, 90, 60, 85, 45, 100, 70, 50, 95, 65, 40, 80, 55, 90, 70, 45, 60, 85, 30, 75, 90, 50, 65].map(
                    (height, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-primary/40 to-primary rounded-full transition-all duration-300"
                        style={{
                          height: isCalling ? `${height}%` : '15%',
                          opacity: isCalling ? 0.95 : 0.25
                        }}
                      />
                    )
                  )}
                </div>
              </div>

              {/* Live Transcript */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/[0.06] text-xs space-y-2.5 font-sans">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-primary shrink-0">Prospect (Rajesh):</span>
                  <span className="text-foreground/90">"Yes, we want to finalize the Whitefield property this week if documents check out."</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-indigo-400 shrink-0">FastAI Copilot:</span>
                  <span className="text-muted-foreground">"Recommended action: Send 1-click legal verification link via WhatsApp immediately."</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Instant Payments */}
        {activeTab === 'payment' && (
          <div className="pt-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Payment Link Generator Card */}
              <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.08] backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-foreground text-sm">Automated Razorpay Payment Link</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Auto-Sync
                  </span>
                </div>

                <div className="space-y-3 text-xs mb-6 font-sans">
                  <div className="flex justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-muted-foreground">Deal Title</span>
                    <span className="font-semibold text-foreground">Commercial Retainer - Whitefield</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-semibold text-foreground">Rajesh Mehta (98450 XXXXX)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-primary text-base font-mono">₹1,49,999.00</span>
                  </div>
                </div>

                <Button
                  onClick={handleSimulatePayment}
                  className="w-full h-12 gradient-primary font-bold text-slate-950 rounded-xl shadow-lg hover:opacity-95 transition-all text-xs md:text-sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Simulate WhatsApp Payment Completion
                </Button>
              </div>

              {/* Status Transition */}
              <div className={`rounded-2xl p-6 border transition-all duration-500 ${
                paymentSuccess
                  ? 'bg-emerald-500/[0.08] border-emerald-500/40'
                  : 'bg-white/[0.02] border-white/[0.08]'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    paymentSuccess ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-primary/15 text-primary'
                  }`}>
                    {paymentSuccess ? <CheckCircle2 className="h-6 w-6" /> : <CreditCard className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">
                      {paymentSuccess ? 'Deal Closed & Payment Verified!' : 'Awaiting Payment Webhook'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {paymentSuccess ? 'Webhook verified in 180ms · Status updated to WON' : 'Click the button on the left to trigger checkout'}
                    </p>
                  </div>
                </div>

                {paymentSuccess ? (
                  <div className="space-y-2 text-xs bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-emerald-300 font-medium">
                    <p className="font-bold text-emerald-200">✓ Lead Status: Won / Paid</p>
                    <p>✓ GST Invoice automatically generated & emailed</p>
                    <p>✓ CA Commission (₹14,999) credited to wallet</p>
                    <p>✓ Welcome onboarding message dispatched</p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-2 bg-black/40 p-4 rounded-xl border border-white/[0.06]">
                    <p>• Zero manual invoice preparation required</p>
                    <p>• Built-in Razorpay payment buttons directly inside WhatsApp & SMS</p>
                    <p>• Automatic commission split across CA and telecallers</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: 12-Level Hierarchy Router */}
        {activeTab === 'routing' && (
          <div className="pt-6 animate-in fade-in duration-300">
            <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.08] backdrop-blur-md">
              <div className="mb-4">
                <h4 className="font-bold text-foreground text-sm mb-1">Sub-Second Multi-Tier Role Governance</h4>
                <p className="text-xs text-muted-foreground">
                  India's only 12-tier granular role hierarchy (CA, Platform Admin, Company, Partner, Branch Manager, Telecaller).
                </p>
              </div>

              {/* Node Diagram */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs relative">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center relative shadow-sm">
                  <span className="text-[10px] font-bold text-primary uppercase block mb-1">Level 1: Origin</span>
                  <span className="font-bold text-foreground block">Meta / Web Form</span>
                  <span className="text-[11px] text-muted-foreground">Lead generated</span>
                  <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center relative shadow-sm">
                  <span className="text-[10px] font-bold text-primary uppercase block mb-1">Level 2: FastAI</span>
                  <span className="font-bold text-foreground block">AI Classifier</span>
                  <span className="text-[11px] text-muted-foreground">Score 97% Intent</span>
                  <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center relative shadow-sm">
                  <span className="text-[10px] font-bold text-primary uppercase block mb-1">Level 3: Governance</span>
                  <span className="font-bold text-foreground block">Chartered Acct</span>
                  <span className="text-[11px] text-muted-foreground">Commission lock</span>
                  <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/15 border border-primary text-center relative shadow-md">
                  <span className="text-[10px] font-bold text-primary uppercase block mb-1">Level 4: Execution</span>
                  <span className="font-bold text-foreground block">Senior Telecaller</span>
                  <span className="text-[11px] text-emerald-400 font-semibold font-mono">Instant Call in 3.2s</span>
                </div>
              </div>

              <div className="mt-5 p-3.5 rounded-xl bg-primary/[0.05] border border-primary/20 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-foreground/80">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Enterprise Grade RBAC: Sensitive numbers masked & isolated.
                </span>
                <span className="font-bold text-primary font-mono hidden md:inline">100% DATA PRIVACY</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InteractiveProductConsole;
