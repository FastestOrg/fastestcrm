import { Card3D } from './Card3D';
import { Check, X, Zap, Sparkles } from 'lucide-react';

const COMPARISON_ROWS = [
  {
    feature: 'Lead Delivery & Response Speed',
    fastest: '3.2 seconds (Instant auto-route)',
    traditional: '48 minutes average',
    highlight: true
  },
  {
    feature: 'Built-in Auto-Dialer & Audio Logging',
    fastest: 'Native 1-Click with AI Speech Notes',
    traditional: 'Expensive 3rd-party add-ons ($40/mo)'
  },
  {
    feature: '12-Level CA & Partner Hierarchy',
    fastest: 'Built-in Multi-tier Commission Lock',
    traditional: 'Requires $20,000+ custom Salesforce dev'
  },
  {
    feature: 'Instant WhatsApp & Razorpay Links',
    fastest: '1-Click payment capture + auto-close',
    traditional: 'Manual PDF invoice generation'
  },
  {
    feature: 'Setup & Onboarding Time',
    fastest: '3 Minutes (Self-serve no-code setup)',
    traditional: '4 to 8 weeks complex deployment'
  },
  {
    feature: 'Starting Price / User / Month',
    fastest: '₹999/mo (Free 1-Seat Starter)',
    traditional: '₹6,500 - ₹12,000/mo + add-ons',
    highlight: true
  }
];

export function SpeedComparisonSection() {
  return (
    <section className="py-20 md:py-24 px-4 sm:px-6 relative overflow-hidden" aria-labelledby="comparison-heading">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-3 font-mono">
            <Sparkles className="h-3.5 w-3.5" /> Performance Benchmark
          </div>
          <h2
            id="comparison-heading"
            className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight"
          >
            Built for <span className="gradient-text">Pure Speed</span>, Not Bloat
          </h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto px-2">
            Legacy CRMs were architected in 2005 for administrative reporting. FastestCRM is engineered for modern, high-velocity revenue teams.
          </p>
        </div>

        {/* ── Desktop View (Full Responsive Table) ── */}
        <div className="hidden md:block">
          <Card3D maxTilt={4} className="w-full">
            <div className="rounded-3xl p-6 lg:p-8 border border-white/10 bg-slate-950/80 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-1/3 w-96 h-96 bg-primary/5 blur-[100px] pointer-events-none rounded-full" />

              <table className="w-full text-left border-collapse relative z-10">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-2/5 font-mono">
                      Feature & Capability
                    </th>
                    <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-primary w-2/5 bg-primary/10 rounded-t-2xl border-t-2 border-x-2 border-primary/30 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          <span>FastestCRM (AI Engine)</span>
                        </div>
                        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-primary text-slate-950">
                          RECOMMENDED
                        </span>
                      </div>
                    </th>
                    <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground/70 w-1/5 font-mono">
                      Traditional CRMs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs md:text-sm">
                  {COMPARISON_ROWS.map((row) => (
                    <tr
                      key={row.feature}
                      className={`hover:bg-white/[0.02] transition-colors ${row.highlight ? 'bg-primary/[0.03]' : ''}`}
                    >
                      <td className="py-4 px-5 font-semibold text-foreground">
                        {row.feature}
                      </td>
                      <td className="py-4 px-5 font-semibold text-emerald-300 bg-primary/10 border-x-2 border-primary/30">
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-emerald-400" />
                          </div>
                          <span>{row.fastest}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-muted-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                            <X className="h-3 w-3 text-rose-400" />
                          </div>
                          <span>{row.traditional}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card3D>
        </div>

        {/* ── Mobile View (Stacked Responsive Cards) ── */}
        <div className="md:hidden space-y-3.5">
          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.feature}
              className={`p-4 rounded-2xl border ${
                row.highlight ? 'border-primary/40 bg-slate-950/90' : 'border-white/10 bg-slate-950/70'
              } space-y-3 shadow-lg`}
            >
              <h4 className="text-sm font-bold text-foreground tracking-tight">
                {row.feature}
              </h4>

              <div className="space-y-2 text-xs">
                {/* FastestCRM */}
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase block tracking-wider font-mono">
                      FastestCRM
                    </span>
                    <span className="font-semibold text-emerald-300 block mt-0.5">
                      {row.fastest}
                    </span>
                  </div>
                </div>

                {/* Traditional */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <X className="h-3 w-3 text-rose-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block tracking-wider font-mono">
                      Traditional CRMs
                    </span>
                    <span className="text-muted-foreground block mt-0.5">
                      {row.traditional}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SpeedComparisonSection;
