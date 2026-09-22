import React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import Image from "@/components/ui/image";
import { Sparkles, Bot, Zap, CheckCircle2, TrendingUp, PhoneCall, ShieldCheck } from "lucide-react";

export function LandingScrollShowcase() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-black/40 to-background py-6 md:py-12">
      {/* Background glow ambiance */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <ContainerScroll
        titleComponent={
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Bot className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>Next-Gen Autonomous Workflow</span>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-foreground">
              Unleash the Power of <br />
              <span className="gradient-text">
                Real-Time Sales Intelligence
              </span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mt-4 mx-auto leading-relaxed">
              Scroll down to unfold the AI command center. Ingest leads in 300ms, score high-intent buyers, and close deals 24/7.
            </p>
          </div>
        }
      >
        <div className="relative w-full h-full rounded-2xl overflow-hidden group bg-slate-950">
          {/* Main Dashboard Image */}
          <Image
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85"
            alt="FastestCRM Autonomous AI Dashboard"
            height={800}
            width={1600}
            className="w-full h-full object-cover object-left-top transition-transform duration-700 group-hover:scale-105"
            draggable={false}
          />

          {/* Dark gradient overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

          {/* Dynamic Floating Telemetry Badges */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-wrap gap-2 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-emerald-500/30 bg-black/60 backdrop-blur-md shadow-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-mono font-bold text-emerald-300">
                AI Pipeline: LIVE (300ms)
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-cyan-500/30 bg-black/60 backdrop-blur-md shadow-xl text-cyan-300 text-[11px] font-mono font-bold">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>98.4% Auto-Dial Connectivity</span>
            </div>
          </div>

          {/* Bottom Telemetry Bar */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl glass border border-white/10 bg-black/70 backdrop-blur-lg shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Conversion Velocity
                </div>
                <div className="text-sm sm:text-base font-bold text-foreground">
                  +42% Average Monthly Revenue
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Razorpay Verified · ₹4.5 Cr Pipeline</span>
            </div>
          </div>
        </div>
      </ContainerScroll>
    </section>
  );
}

export default LandingScrollShowcase;
