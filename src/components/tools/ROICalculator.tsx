import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Target, TrendingUp, Users, Clock, ArrowRight, Code, Share2, Copy, CheckCircle2 } from 'lucide-react';

const ROICalculator: React.FC = () => {
  const [leads, setLeads] = useState<number>(100);
  const [conversion, setConversion] = useState<number>(5);
  const [dealValue, setDealValue] = useState<number>(50000);
  const [roi, setRoi] = useState<number>(0);
  const [extraRevenue, setExtraRevenue] = useState<number>(0);
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState(false);

  const embedCode = `<iframe src="https://www.fastestcrm.com/tools/roi-calculator-embed" width="100%" height="600" frameborder="0" title="Fastest CRM ROI Calculator"></iframe><p style="text-align:center;font-family:sans-serif;font-size:12px;">Powered by <a href="https://www.fastestcrm.com/tools">Fastest CRM ROI Calculator</a></p>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // Basic calculation: Current revenue vs Revenue with 20% improvement (conservative estimate for Fastest CRM)
    const currentRevenue = leads * (conversion / 100) * dealValue;
    const improvedConversion = conversion * 1.25; // 25% boost in conversion
    const improvedRevenue = leads * (improvedConversion / 100) * dealValue;
    
    setExtraRevenue(improvedRevenue - currentRevenue);
    setRoi(Math.round(((improvedRevenue - currentRevenue) / 3000) * 100)); // Assuming 3k monthly cost
  }, [leads, conversion, dealValue]);

  return (
    <div className="rounded-3xl border border-border/50 bg-card/40 backdrop-blur-md overflow-hidden shadow-2xl">
      <div className="p-8 md:p-12 grid md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Monthly Leads</label>
            <input 
              type="range" 
              min="10" 
              max="5000" 
              step="10"
              value={leads}
              onChange={(e) => setLeads(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between mt-2 font-bold text-xl">
              <span>{leads}</span>
              <span className="text-muted-foreground text-sm font-normal">leads/mo</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Current Conversion Rate (%)</label>
            <input 
              type="range" 
              min="1" 
              max="50" 
              step="0.5"
              value={conversion}
              onChange={(e) => setConversion(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between mt-2 font-bold text-xl">
              <span>{conversion}%</span>
              <span className="text-muted-foreground text-sm font-normal">conversion</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Average Deal Value (₹)</label>
            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₹</span>
                <input 
                  type="number" 
                  value={dealValue}
                  onChange={(e) => setDealValue(Number(e.target.value))}
                  className="w-full h-14 pl-10 pr-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none font-bold text-lg"
                />
            </div>
          </div>
        </div>

        <div className="bg-primary/5 rounded-2xl p-8 border border-primary/20 flex flex-col justify-center text-center">
            <div className="mb-8">
                <p className="text-muted-foreground font-semibold mb-2 uppercase tracking-widest text-xs">Estimated Monthly Revenue Lift</p>
                <h3 className="text-4xl md:text-5xl font-bold text-primary" style={{ fontFamily: "'Syne', sans-serif" }}>
                    ₹{extraRevenue.toLocaleString('en-IN')}
                </h3>
                <p className="text-xs text-muted-foreground mt-2">Based on a 25% efficiency boost with Fastest CRM</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-xl bg-card border border-border/50">
                    <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">ROI</p>
                    <p className="text-xl font-bold">{roi}%</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border/50">
                    <Clock className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Time Saved</p>
                    <p className="text-xl font-bold">40h+</p>
                </div>
            </div>

            <Button className="w-full h-14 gradient-primary text-lg font-bold rounded-xl shadow-lg mb-4" style={{ color: 'hsl(222 28% 5%)' }}>
                Capture Your ROI Now
                <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <div className="flex items-center gap-3">
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="flex-1 rounded-lg gap-2"
                 onClick={() => setShowEmbed(!showEmbed)}
               >
                 <Code className="h-4 w-4" />
                 Embed Tool
               </Button>
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="flex-1 rounded-lg gap-2"
                 onClick={() => {
                   const text = `I just calculated my Sales ROI with Fastest CRM. We could see a ₹${extraRevenue.toLocaleString('en-IN')} revenue lift! Check it out: https://www.fastestcrm.com/tools`;
                   window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.fastestcrm.com/tools')}&summary=${encodeURIComponent(text)}`);
                 }}
               >
                 <Share2 className="h-4 w-4" />
                 Share ROI
               </Button>
            </div>

            {showEmbed && (
              <div className="mt-6 p-4 rounded-xl bg-background border border-primary/20 text-left animate-in fade-in slide-in-from-top-2">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Embed Code (Boosts your site's utility)</p>
                 <div className="relative">
                    <pre className="text-[10px] bg-secondary/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all border border-border">
                      {embedCode}
                    </pre>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="absolute top-2 right-2 h-8 w-8 text-primary"
                      onClick={copyEmbed}
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                 </div>
                 <p className="text-[9px] text-muted-foreground mt-2">Paste this on your blog or resource page to share the power of AI CRM.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ROICalculator;
