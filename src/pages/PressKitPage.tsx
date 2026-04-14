import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Mail, Zap, Target, Star, Shield, Layout, Globe } from 'lucide-react';
import SEO from '@/components/SEO';
import BreadcrumbSection from '@/components/layout/BreadcrumbSection';
import AuthorityFooter from '@/components/layout/AuthorityFooter';

const PressKitPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SEO 
        title="Press Kit & Media Assets | Fastest CRM Newsroom"
        description="Official media kit for Fastest CRM. Download logos, brand assets, and access company information for press and media inquiries."
        keywords="fastest crm press kit, media assets, branding logo download, crm newsroom, fastest crm company info"
      />

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/fastestcrmlogo.png" alt="Fastest CRM logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Fastest CRM
            </span>
          </Link>
          <div className="flex items-center gap-4">
             <Link to="/auth">
                <Button variant="ghost" size="sm">Login</Button>
             </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden bg-secondary/5">
        <div className="absolute inset-0 -z-10 dot-grid-bg opacity-30" />
        <div className="container mx-auto max-w-4xl text-center">
           <h1 className="text-4xl md:text-7xl font-bold mb-8" style={{ fontFamily: "'Syne', sans-serif" }}>
             Media <span className="gradient-text">& Press Center</span>
           </h1>
           <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
             Everything you need to share the story of India's fastest AI-powered CRM.
           </p>
           
           <div className="flex justify-center mb-12">
             <a href="https://www.producthunt.com/products/fastest-crm" target="_blank" rel="noopener noreferrer" className="card-hover">
               <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=fastest-crm&theme=light" alt="Fastest CRM on Product Hunt" className="h-14" />
             </a>
           </div>
        </div>
      </section>

      <BreadcrumbSection items={[{ name: 'Press Kit', path: '/press' }]} />

      <main className="container mx-auto px-6 py-24 space-y-32">
        {/* ── Quick Stats ── */}
        <section className="grid md:grid-cols-4 gap-8">
           {[
             { label: 'Founded', value: '2025', icon: Zap },
             { label: 'Headquarters', value: 'Bangalore, IN', icon: Globe },
             { label: 'Focus', value: 'Sales AI', icon: Target },
             { label: 'Users', value: '10,000+', icon: Star },
           ].map((stat, i) => (
             <div key={i} className="p-8 rounded-3xl bg-card border border-border/50 text-center card-hover">
                <stat.icon className="h-8 w-8 text-primary mx-auto mb-4" />
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
             </div>
           ))}
        </section>

        {/* ── Brand Assets ── */}
        <section className="space-y-12">
           <div className="text-center">
              <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>Brand <span className="gradient-text">Assets</span></h2>
              <p className="text-muted-foreground">Download official logos and brand guidelines.</p>
           </div>
           
           <div className="grid md:grid-cols-2 gap-8">
              <div className="p-10 rounded-3xl bg-card border border-border/50 flex flex-col items-center gap-8">
                 <div className="w-full aspect-video bg-background/50 rounded-2xl flex items-center justify-center border border-dashed border-border p-12">
                   <img src="/fastestcrmlogo.png" alt="Fastest CRM Logo" className="w-24 h-24" />
                 </div>
                 <div className="text-center">
                    <h3 className="text-xl font-bold mb-2">Primary Logo</h3>
                    <p className="text-sm text-muted-foreground mb-6">High-resolution PNG and SVG formats for light/dark backgrounds.</p>
                    <Button variant="outline" className="rounded-full gap-2">
                       <Download className="h-4 w-4" />
                       Download Logo Pack
                    </Button>
                 </div>
              </div>

              <div className="p-10 rounded-3xl bg-card border border-border/50 flex flex-col items-center gap-8 shadow-2xl">
                 <div className="w-full aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center border border-primary/20 p-12 overflow-hidden">
                   <div className="flex gap-2">
                       <div className="w-8 h-8 rounded-full bg-[#0d9488]" />
                       <div className="w-8 h-8 rounded-full bg-[#334155]" />
                       <div className="w-8 h-8 rounded-full bg-[#f8fafc]" />
                   </div>
                 </div>
                 <div className="text-center">
                    <h3 className="text-xl font-bold mb-2">Brand Guidelines</h3>
                    <p className="text-sm text-muted-foreground mb-6">Color palettes, typography rules, and usage constraints.</p>
                    <Button variant="outline" className="rounded-full gap-2 text-primary border-primary/20 hover:bg-primary/5">
                       <Layout className="h-4 w-4" />
                       View Guidelines PDF
                    </Button>
                 </div>
              </div>
           </div>
        </section>

        {/* ── Contact Section ── */}
        <section className="bg-primary/5 rounded-3xl p-12 md:p-20 text-center border border-primary/20 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
              <Shield className="h-64 w-64" />
           </div>
           <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>Contact our <span className="gradient-text">Media Relations</span></h2>
           <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
             For interviews, feature requests, or partnership opportunities, our relations team is ready to assist.
           </p>
           <a href="mailto:press@fastestcrm.com">
              <Button size="lg" className="rounded-full gap-3 h-14 px-10 text-lg gradient-primary">
                 <Mail className="h-6 w-6" />
                 press@fastestcrm.com
              </Button>
           </a>
        </section>
      </main>

      <AuthorityFooter />
    </div>
  );
};

export default PressKitPage;
