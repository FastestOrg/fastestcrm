import { useState } from 'react';
import { Sparkles, Bot, Zap, Terminal, CreditCard, Brain, Check } from 'lucide-react';

const PRESET_PROMPTS = [
  {
    icon: Zap,
    title: "Autonomous Lead Routing",
    prompt: "Ingest incoming Meta leads, score intent >90%, and auto-dial within 5 seconds",
    steps: [
      { time: "0.04s", title: "FastAI Webhook Ingestion", detail: "48 incoming leads parsed and deduplicated" },
      { time: "0.12s", title: "Neural Classifier", detail: "Intent scored at 96% (Budget ₹50L+ Commercial)" },
      { time: "0.18s", title: "Priority Routing", detail: "Dispatched to Senior Telecaller & WhatsApp Demo sent" },
      { time: "0.24s", title: "Auto-Dialer Triggered", detail: "Direct connection initiated in 2.8s" }
    ]
  },
  {
    icon: CreditCard,
    title: "1-Click WhatsApp Razorpay Deal",
    prompt: "Generate instant ₹1,50,000 payment link for Rajesh Mehta and auto-close lead upon payment",
    steps: [
      { time: "0.05s", title: "Razorpay Native API", detail: "Dynamic link #RZP-984 generated for ₹1,50,000" },
      { time: "0.11s", title: "WhatsApp Cloud API", detail: "Interactive payment card sent to +91 98450 XXXXX" },
      { time: "0.19s", title: "Webhook Verification", detail: "Simulated payment captured (100% verified)" },
      { time: "0.25s", title: "FastAI CRM Sync", detail: "Status marked WON, CA commission credited" }
    ]
  },
  {
    icon: Brain,
    title: "FastAI Objection Copilot",
    prompt: "Analyze live telecaller conversation and suggest closing objection pitches for commercial real estate",
    steps: [
      { time: "0.03s", title: "Voice Stream", detail: "Speech-to-text live transcription active" },
      { time: "0.09s", title: "Sentiment Analyzer", detail: "Detected buyer hesitation on Whitefield possession date" },
      { time: "0.17s", title: "FastAI Copilot", detail: "Recommended pitch: 'Highlight RERA certified completion & zero GST'" },
      { time: "0.28s", title: "Screen Updated", detail: "Telecaller HUD refreshed in real time" }
    ]
  }
];

export function AICommandPrompt() {
  const [selectedPrompt, setSelectedPrompt] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const handleSelect = (idx: number) => {
    setSelectedPrompt(idx);
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 400);
  };

  const activePreset = PRESET_PROMPTS[selectedPrompt];

  return (
    <div className="w-full max-w-4xl mx-auto my-8 text-left">
      <div className="rounded-2xl p-5 md:p-6 border border-emerald-500/25 shadow-2xl bg-slate-950/85 backdrop-blur-2xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  FastAI Autonomous Sales Copilot
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                  ONLINE
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Prompt the AI engine to run autonomous revenue operations</p>
            </div>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono font-medium self-start sm:self-auto">
            ● Mean Execution: 0.28s
          </span>
        </div>

        {/* Preset Prompt Pills */}
        <div className="flex flex-wrap gap-2 my-4">
          {PRESET_PROMPTS.map((p, idx) => {
            const Icon = p.icon;
            const isSelected = selectedPrompt === idx;
            return (
              <button
                key={p.title}
                onClick={() => handleSelect(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-primary text-slate-950 shadow-md font-bold'
                    : 'bg-white/[0.03] text-muted-foreground hover:text-foreground border border-white/[0.06] hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{p.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Prompt Bar */}
        <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 flex items-center gap-3 mb-4">
          <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
          <span className="text-xs md:text-sm font-medium text-foreground/90 flex-1 truncate font-mono">
            {activePreset.prompt}
          </span>
          <span className="hidden sm:inline text-[10px] font-mono text-primary font-bold px-2 py-1 rounded bg-primary/10 border border-primary/20 shrink-0">
            AUTONOMOUS
          </span>
        </div>

        {/* Real-time AI Execution Step Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {activePreset.steps.map((step, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3 transition-opacity ${
                isRunning ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Check className="h-3 w-3" />
              </div>
              <div className="text-xs overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-bold text-foreground truncate">{step.title}</span>
                  <span className="text-[10px] font-mono text-primary font-medium">{step.time}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AICommandPrompt;
