import React from 'react';
import { Link } from 'react-router-dom';
import { isAndroidWebView } from '@/lib/platform';

interface AuthorityFooterProps {
  // Add props if customization is needed, but for SEO consistency, the same footer is better.
}

const clients = [
  { name: 'Microsoft', country: 'United States', flag: '🇺🇸', industry: 'Technology' },
  { name: 'Siemens', country: 'Germany', flag: '🇩🇪', industry: 'Industrial' },
  { name: 'HSBC', country: 'United Kingdom', flag: '🇬🇧', industry: 'Finance' },
  { name: 'Toyota', country: 'Japan', flag: '🇯🇵', industry: 'Automotive' },
  { name: 'L\'Oréal', country: 'France', flag: '🇫🇷', industry: 'Consumer Goods' },
  { name: 'BHP', country: 'Australia', flag: '🇦🇺', industry: 'Mining' },
  { name: 'TCS', country: 'India', flag: '🇮🇳', industry: 'IT Services' },
  { name: 'Weskill', country: 'India', flag: '🇮🇳', industry: 'EdTech' },
  { name: 'Efficacy', country: 'India', flag: '🇮🇳', industry: 'SaaS' },
  { name: 'Petrobras', country: 'Brazil', flag: '🇧🇷', industry: 'Energy' },
  { name: 'DBS Bank', country: 'Singapore', flag: '🇸🇬', industry: 'Finance' },
  { name: 'Emirates', country: 'United Arab Emirates', flag: '🇦🇪', industry: 'Aviation' },
  { name: 'Standard Bank', country: 'South Africa', flag: '🇿🇦', industry: 'Finance' },
  { name: 'Zara (Inditex)', country: 'Spain', flag: '🇪🇸', industry: 'Retail' },
  { name: 'Cemex', country: 'Mexico', flag: '🇲🇽', industry: 'Materials' },
  { name: 'Samsung', country: 'South Korea', flag: '🇰🇷', industry: 'Electronics' },
  { name: 'Xero', country: 'New Zealand', flag: '🇳🇿', industry: 'SaaS' },
  { name: 'Nestlé', country: 'Switzerland', flag: '🇨🇭', industry: 'Food & Beverage' },
  { name: 'Accenture', country: 'Ireland', flag: '🇮🇪', industry: 'Consulting' },
  { name: 'Aramco', country: 'Saudi Arabia', flag: '🇸🇦', industry: 'Energy' }
];

const AuthorityFooter: React.FC<AuthorityFooterProps> = () => {
  const isWebView = isAndroidWebView();

  return (
    <footer className="py-20 px-6 border-t border-border/50 bg-card/30">
      <div className="container mx-auto">
        {/* ── Global Clients Marquee ── */}
        <div className="w-full overflow-hidden pb-12 mb-16 border-b border-border/40 relative">
          {/* Shadow overlays for smooth fade effect at edges */}
          <div className="absolute top-0 bottom-12 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute top-0 bottom-12 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-primary uppercase tracking-widest block mb-2">Trusted Globally</span>
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-foreground/90" style={{ fontFamily: "'Syne', sans-serif" }}>
              Powering Sales Teams in 20+ Countries
            </h3>
          </div>

          <div className="flex overflow-hidden">
            <div className="animate-marquee flex gap-6 py-2">
              {[...clients, ...clients].map((client, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300 shadow-sm shrink-0 backdrop-blur-sm"
                >
                  <span className="text-2xl" role="img" aria-label={client.country}>
                    {client.flag}
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
              <span className="font-bold text-xl tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>Fastest CRM</span>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-8 max-w-sm">
              {isWebView 
                ? "The smarter CRM built for high-velocity sales teams. Own your leads, automate your calls, and collect payments."
                : "Global's #1 Fully AI-powered CRM built for high-velocity sales teams. Own your leads, automate your calls, and collect payments at 10X speed."
              }
            </p>
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Download App</p>
              <a href="https://play.google.com/store/apps/details?id=com.fastestcrm" target="_blank" rel="noopener noreferrer">
                <img src="/getitongoogleplay.png" alt="Get it on Google Play" className="h-10 hover:opacity-90 transition-opacity" />
              </a>
              <div className="mt-4">
                <a href="https://www.producthunt.com/products/fastest-crm" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-[#DA552F] transition-colors uppercase tracking-widest border border-border/50 px-3 py-1.5 rounded-lg bg-card/50">
                   Upvote on Product Hunt
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Solutions */}
          <div>
            <p className="font-bold text-sm uppercase tracking-widest mb-6 text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Solutions</p>
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
            <p className="font-bold text-sm uppercase tracking-widest mb-6 text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Comparisons</p>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><Link to="/vs/zoho" className="hover:text-primary transition-colors">vs Zoho CRM</Link></li>
              <li><Link to="/vs/hubspot" className="hover:text-primary transition-colors">vs HubSpot</Link></li>
              <li><Link to="/vs/leadsquared" className="hover:text-primary transition-colors">vs LeadSquared</Link></li>
              <li><Link to="/vs/freshsales" className="hover:text-primary transition-colors">vs Freshsales</Link></li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div>
            <p className="font-bold text-sm uppercase tracking-widest mb-6 text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Resources</p>
            <ul className="space-y-4 text-sm text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">© 2025-∞ Fastest CRM. All rights reserved.</p>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Status: Operational</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
             Built for Fastest Sales Teams with ❤️ in India 🇮🇳
          </p>
        </div>
      </div>
    </footer>
  );
};

export default AuthorityFooter;
