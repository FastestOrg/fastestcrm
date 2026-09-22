import React from 'react';
import { Link } from 'react-router-dom';
import { isAndroidWebView } from '@/lib/platform';

interface AuthorityFooterProps {
  // Add props if customization is needed, but for SEO consistency, the same footer is better.
}

const clients = [
  { name: 'Microsoft', country: 'United States', code: 'US', industry: 'Technology' },
  { name: 'Siemens', country: 'Germany', code: 'DE', industry: 'Industrial' },
  { name: 'HSBC', country: 'United Kingdom', code: 'GB', industry: 'Finance' },
  { name: 'Toyota', country: 'Japan', code: 'JP', industry: 'Automotive' },
  { name: 'L\'Oréal', country: 'France', code: 'FR', industry: 'Consumer Goods' },
  { name: 'BHP', country: 'Australia', code: 'AU', industry: 'Mining' },
  { name: 'TCS', country: 'India', code: 'IN', industry: 'IT Services' },
  { name: 'Weskill', country: 'India', code: 'IN', industry: 'EdTech' },
  { name: 'Efficacy', country: 'India', code: 'IN', industry: 'SaaS' },
  { name: 'Petrobras', country: 'Brazil', code: 'BR', industry: 'Energy' },
  { name: 'DBS Bank', country: 'Singapore', code: 'SG', industry: 'Finance' },
  { name: 'Emirates', country: 'United Arab Emirates', code: 'AE', industry: 'Aviation' },
  { name: 'Standard Bank', country: 'South Africa', code: 'ZA', industry: 'Finance' },
  { name: 'Zara (Inditex)', country: 'Spain', code: 'ES', industry: 'Retail' },
  { name: 'Cemex', country: 'Mexico', code: 'MX', industry: 'Materials' },
  { name: 'Samsung', country: 'South Korea', code: 'KR', industry: 'Electronics' },
  { name: 'Xero', country: 'New Zealand', code: 'NZ', industry: 'SaaS' },
  { name: 'Nestlé', country: 'Switzerland', code: 'CH', industry: 'Food & Beverage' },
  { name: 'Accenture', country: 'Ireland', code: 'IE', industry: 'Consulting' },
  { name: 'Aramco', country: 'Saudi Arabia', code: 'SA', industry: 'Energy' }
];

const AuthorityFooter: React.FC<AuthorityFooterProps> = () => {
  const isWebView = isAndroidWebView();

  return (
    <footer className="pt-20 pb-28 px-6 border-t border-border/50 bg-card/30">
      <div className="container mx-auto">
        {/* ── Global Clients Marquee ── */}
        <div className="w-full overflow-hidden pb-12 mb-16 border-b border-border/40 relative">
          {/* Shadow overlays for smooth fade effect at edges */}
          <div className="absolute top-0 bottom-12 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute top-0 bottom-12 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-primary uppercase tracking-widest block mb-2 font-mono">Trusted Globally</span>
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-foreground/90">
              Powering Sales Teams in 20+ Countries
            </h3>
          </div>

          <div className="flex overflow-hidden">
            <div className="animate-marquee flex gap-6 py-2">
              {[...clients, ...clients].map((client, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300 shadow-sm shrink-0 backdrop-blur-sm"
                >
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {client.code}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground/90 tracking-tight">{client.name}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{client.country} · {client.industry}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Column 1: Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <img src="/fastestcrmlogo.png" alt="Fastest CRM" className="w-10 h-10 object-contain" />
              <span className="font-bold text-xl tracking-tight">Fastest CRM</span>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-8 max-w-sm text-sm">
              {isWebView 
                ? "The smarter CRM built for high-velocity sales teams. Own your leads, automate your calls, and collect payments."
                : "The world's first fully autonomous AI CRM built for high-velocity sales teams. Own your leads, automate your calls, and collect payments at 10X speed."
              }
            </p>
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-mono">Download Mobile App</p>
              <a href="https://play.google.com/store/apps/details?id=com.fastestcrm" target="_blank" rel="noopener noreferrer">
                <img src="/getitongoogleplay.png" alt="Get it on Google Play" className="h-10 hover:opacity-90 transition-opacity" />
              </a>
              <div className="mt-2">
                <a href="https://www.producthunt.com/products/fastest-crm" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-[#DA552F] transition-colors border border-border/50 px-3.5 py-2 rounded-xl bg-card/50 hover:bg-card">
                   <svg className="w-4 h-4 text-[#DA552F]" viewBox="0 0 40 40" fill="currentColor">
                     <circle cx="20" cy="20" r="20" fill="#DA552F"/>
                     <path d="M22.6 17.4h-4.8v5.2h4.8c1.4 0 2.6-1.2 2.6-2.6s-1.2-2.6-2.6-2.6zm0-4.8h-7.4v14.8h2.6v-4.8h4.8c4.1 0 7.4-3.3 7.4-7.4 0-4.1-3.3-7.4-7.4-7.4z" fill="#FFF"/>
                   </svg>
                   <span>Featured on Product Hunt</span>
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Solutions */}
          <div>
            <p className="font-bold text-sm uppercase tracking-widest mb-6 text-foreground font-mono">Solutions</p>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><Link to="/crm-for-real-estate" className="hover:text-primary transition-colors">Real Estate CRM</Link></li>
              <li><Link to="/crm-for-edtech" className="hover:text-primary transition-colors">EdTech CRM</Link></li>
              <li><Link to="/crm-for-healthcare" className="hover:text-primary transition-colors">Healthcare CRM</Link></li>
              <li><Link to="/crm-for-saas" className="hover:text-primary transition-colors">SaaS CRM</Link></li>
              <li><Link to="/solutions/bangalore" className="hover:text-primary transition-colors">CRM in Bangalore</Link></li>
            </ul>
          </div>

          {/* Column 3: Comparisons */}
          <div>
            <p className="font-bold text-sm uppercase tracking-widest mb-6 text-foreground font-mono">Comparisons</p>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><Link to="/vs/zoho" className="hover:text-primary transition-colors">vs Zoho CRM</Link></li>
              <li><Link to="/vs/hubspot" className="hover:text-primary transition-colors">vs HubSpot</Link></li>
              <li><Link to="/vs/leadsquared" className="hover:text-primary transition-colors">vs LeadSquared</Link></li>
              <li><Link to="/vs/freshsales" className="hover:text-primary transition-colors">vs Freshsales</Link></li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div>
            <p className="font-bold text-sm uppercase tracking-widest mb-6 text-foreground font-mono">Resources</p>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><Link to="/partnership" className="text-primary font-bold hover:underline">Partner Program (Earn 40%)</Link></li>
              <li><Link to="/tools" className="hover:text-primary transition-colors">Sales Tools</Link></li>
              <li><Link to="/press" className="hover:text-primary transition-colors">Press Kit</Link></li>
              <li><Link to="/glossary" className="hover:text-primary transition-colors">CRM Glossary</Link></li>
              <li><Link to="/blog" className="hover:text-primary transition-colors">Sales Blog</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <p className="text-xs text-muted-foreground">© 2025 FastestCRM Inc. All rights reserved.</p>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">System Status: Operational</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
             Built for high-velocity sales teams with precision in Bengaluru, India
          </p>
        </div>
      </div>
    </footer>
  );
};

export default AuthorityFooter;

