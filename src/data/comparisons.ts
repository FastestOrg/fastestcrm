import { Zap, Shield, Phone, Brain, Users, CreditCard } from 'lucide-react';

export const comparisonsData: Record<string, any> = {
  zoho: {
    competitor: 'Zoho CRM',
    title: 'Fastest CRM vs Zoho CRM: Why Sales Teams are Switching',
    description: 'Compare Fastest CRM with Zoho. Discover why Indian startups prefer our AI-powered speed, auto-dialer, and seamless Razorpay integration over legacy systems.',
    highlights: [
      { feature: 'AI Integration', us: 'Native Gemini AI', them: 'Add-on only' },
      { feature: 'Setup Time', us: 'Under 5 minutes', them: 'Days to implementation' },
      { feature: 'Auto Dialer', us: 'Built-in (Sequential)', them: 'Requires 3rd party integration' },
      { feature: 'Price', us: '₹10/day', them: 'Expensive monthly licensing' }
    ],
    faqs: [
      { question: 'Is it hard to migrate from Zoho to Fastest CRM?', answer: 'No! We offer a one-click CSV import specifically mapped for Zoho data fields.' },
      { question: 'Why is Fastest CRM faster than Zoho?', answer: 'We use a modern tech stack and optimized workflows designed specifically for high-velocity Indian sales teams.' }
    ]
  },
  hubspot: {
    competitor: 'HubSpot',
    title: 'Fastest CRM vs HubSpot: The Best AI CRM for Startups',
    description: 'HubSpot is great, but Fastest CRM is built for speed. Compare the best AI CRM features, pricing, and local Indian integrations.',
    highlights: [
      { feature: 'Local Payments', us: 'Direct Razorpay/UPI', them: 'Stripe-first (Global)' },
      { feature: 'Mobile App', us: 'Optimized for field sales', them: 'Resource intensive' },
      { feature: 'Lead Ownership', us: '12-level hierarchy', them: 'Flat/Restricted' },
      { feature: 'Value', us: 'Pay-per-use scaling', them: 'Aggressive upselling' }
    ],
    faqs: [
      { question: 'Can I use HubSpot and Fastest CRM together?', answer: 'While you can sync data via Zapier, most teams find Fastest CRM replaces the need for HubSpot entirely.' }
    ]
  },
  leadsquared: {
    competitor: "LeadSquared",
    pros: ["Built for Indian Sales DNA", "Fastest Mobile Experience", "Zero-Latency Interface"],
    cons: ["Not great for global teams", "Fewer complex integrations than others"],
    verdict: "LeadSquared is great for big call centers, but Fastest CRM is built for modern, fast-growing startups who need AI insights today, not tomorrow.",
    features: [
      { name: "Native Auto-Dialer", us: true, them: true },
      { name: "Gemini AI Insights", us: true, them: false },
      { name: "1-Click ROI Analysis", us: true, them: false },
      { name: "Real-time Razorpay Sync", us: true, them: false }
    ]
  },
  freshsales: {
    competitor: "Freshsales",
    pros: ["Superior calling speed", "Deep Indian localized payments", "AI Agent capabilities"],
    cons: ["Lacks Freshworks ecosystem breadth", "No multichannel helpdesk integration yet"],
    verdict: "Freshsales is a fantastic all-rounder. However, if your primary goal is the fastest possible lead-to-call conversion in the Indian market, Fastest CRM's dedicated auto-dialer and Razorpay sync are unbeatable.",
    features: [
      { name: "Auto-Dialer", us: true, them: false },
      { name: "Indian Payment Gateway", us: true, them: false },
      { name: "Gemini Pro AI", us: true, them: false },
      { name: "WhatsApp Automation", us: true, them: true }
    ]
  }
};
