import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  Search,
  Users,
  LayoutDashboard,
  Phone,
  CreditCard,
  Workflow,
  Brain,
  FileText,
  Settings,
  Shield,
  BarChart3,
  Upload,
  UserPlus,
  Bell,
  Globe,
  Zap,
  Building2,
  ListChecks,
  Package,
  BookOpen,
  Rocket,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import SEO from '@/components/SEO';
import { BreadcrumbSchema } from '@/components/SchemaMarkup';

interface DocSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  articles: {
    title: string;
    content: string;
  }[];
}

const docSections: DocSection[] = [
  {
    id: 'getting-started',
    icon: Rocket,
    title: 'Getting Started',
    description: 'Set up your account and start using FastestCRM in minutes.',
    articles: [
      {
        title: 'Creating Your Account',
        content:
          'Sign up at FastestCRM by clicking "Start Free Trial". Enter your email and password to create your account. Once registered, you\'ll be guided through a quick onboarding that helps you register your company, choose your industry, and invite your first team members.',
      },
      {
        title: 'Registering Your Company',
        content:
          'After sign-up, navigate to "Register Company". Provide your company name (a unique slug is auto-generated), select your industry (Education, Real Estate, Healthcare, Insurance, Automotive, Finance, Retail, Travel, or SaaS), and submit. Your company workspace will be created with industry-specific lead fields and statuses.',
      },
      {
        title: 'Understanding the Dashboard',
        content:
          'The main dashboard gives you a real-time overview of your pipeline: total leads, conversion rates, revenue projected vs received, and team performance. Use the sidebar to navigate between Leads, Team, Automations, Integrations, Forms, Reports, and Settings.',
      },
      {
        title: 'Subdomain Access',
        content:
          'Every company gets a dedicated subdomain (e.g., yourcompany.fastestcrm.com). Share this URL with your team for direct login. You can also set up a custom domain under Settings → Company → Domain.',
      },
    ],
  },
  {
    id: 'lead-management',
    icon: Users,
    title: 'Lead Management',
    description: 'Track every lead from generation to conversion.',
    articles: [
      {
        title: 'Adding Leads',
        content:
          'Add leads manually via the "Add Lead" button, or in bulk using CSV upload. Each lead captures name, email, phone, WhatsApp, source, status, and industry-specific fields. Duplicate detection is automatic based on your company\'s unique constraint settings (phone, email, or both).',
      },
      {
        title: 'Lead Statuses & Pipeline',
        content:
          'Leads flow through customizable statuses organized by category: New, Interested, Paid, and Other. Each status has a color code and can trigger automations. Use the Kanban board view to drag-and-drop leads between stages, or switch to table view for bulk operations.',
      },
      {
        title: 'Lead Assignment & Ownership',
        content:
          'Assign leads to team members using Pre-Sales Owner, Sales Owner, and Post-Sales Owner fields. Use "Assign Leads" to bulk-assign filtered leads. The hierarchy system ensures managers can view their team\'s leads while individual reps see only their own.',
      },
      {
        title: 'Lead History & Notes',
        content:
          'Every status change, assignment update, and note is logged in the lead\'s history timeline. Add notes during calls or meetings. The full audit trail helps you understand every touchpoint in the customer journey.',
      },
      {
        title: 'Filters & Search',
        content:
          'Filter leads by status, owner, source, date range, product, and custom fields. Use the search bar for instant lookup by name, email, or phone. Save frequently used filter combinations for quick access.',
      },
      {
        title: 'CSV Upload & Bulk Operations',
        content:
          'Upload leads via CSV with automatic column mapping. The system detects headers and maps them to your lead fields. Supports bulk status updates, bulk assignment, and bulk delete for efficient pipeline management.',
      },
      {
        title: 'Column Configuration',
        content:
          'Customize which columns appear in your leads table. Reorder, show/hide, and resize columns to match your workflow. Each user\'s column preferences are saved independently.',
      },
    ],
  },
  {
    id: 'industry-specific',
    icon: Building2,
    title: 'Industry-Specific Features',
    description: 'Tailored CRM configurations for 9 industries.',
    articles: [
      {
        title: 'Education',
        content:
          'Designed for colleges, coaching centers, and ed-tech companies. Track students with fields like College, Branch, CGPA, Graduating Year, Batch Month, and Domain. Manage product categories and preferred languages. Statuses include: New Lead, Interested, Demo Done, Enrolled, Payment Pending, Paid, and more.',
      },
      {
        title: 'Real Estate',
        content:
          'Built for property dealers, builders, and brokers. Track property type, preferred location, budget range, possession timeline, unit number, and broker details. Features include property management, site visit photo capture, lead profiling with customizable criteria, and commission tracking.',
      },
      {
        title: 'Healthcare',
        content:
          'For hospitals, clinics, and diagnostic centers. Track patient details, appointments, treatments, and follow-ups. Specialized statuses for patient journey management.',
      },
      {
        title: 'Insurance',
        content:
          'For insurance agents, brokers, and companies. Track policy type, coverage amount, premium details, renewal dates, and claim status. Agent hierarchy support with commission tracking.',
      },
      {
        title: 'Automotive',
        content:
          'For car dealers, showrooms, and service centers. Track vehicle model, test drive scheduling, finance options, exchange details, and service bookings.',
      },
      {
        title: 'Finance & Banking',
        content:
          'For banks, NBFCs, and loan providers. Track loan type, amount, tenure, EMI details, credit score, and document verification status.',
      },
      {
        title: 'Retail & E-commerce',
        content:
          'For retail stores and online sellers. Track customer type, order value, products interested, purchase frequency, loyalty points, order status, and delivery details.',
      },
      {
        title: 'Travel & Hospitality',
        content:
          'For travel agents and tour operators. Track destination, travel dates, traveler count, trip type, package details, hotel bookings, and advance payments.',
      },
      {
        title: 'SaaS & Technology',
        content:
          'For software companies and startups. Track demo scheduling, trial management, subscription tiers, onboarding status, and MRR/ARR metrics.',
      },
    ],
  },
  {
    id: 'team-management',
    icon: UserPlus,
    title: 'Team & Hierarchy',
    description: 'Manage your team with up to 20-level hierarchy.',
    articles: [
      {
        title: 'Inviting Team Members',
        content:
          'Invite team members via email from the Team page. Each invitation uses one license from your company\'s license pool. The invitee receives an email with login credentials and is automatically assigned to your company.',
      },
      {
        title: 'Hierarchy & Org Chart',
        content:
          'Set up a multi-level hierarchy (up to 20 levels) with custom level names (e.g., CEO → VP → Manager → Executive). Assign managers to team members. The visual org chart displays the complete reporting structure.',
      },
      {
        title: 'Role-Based Access',
        content:
          'Three built-in roles: Admin (full access), Moderator (team management + leads), and User (own leads only). Admins can manage company settings, team members, and all leads. Managers automatically see their subordinates\' leads based on the hierarchy.',
      },
      {
        title: 'License Management',
        content:
          'Each company starts with a set number of licenses. Purchase additional licenses as your team grows. Track used vs available licenses in Company Settings. Remove team members to free up licenses.',
      },
    ],
  },
  {
    id: 'automations',
    icon: Workflow,
    title: 'Automations',
    description: 'Automate repetitive tasks with rule-based triggers.',
    articles: [
      {
        title: 'Creating Automations',
        content:
          'Build automations with a trigger → action model. Supported triggers include: Lead Status Change, New Lead Added, and Scheduled Time. Actions include: Send Notification, Assign Lead, Update Status, and Send WhatsApp Message.',
      },
      {
        title: 'Automation Examples',
        content:
          'Common automations: Auto-assign new leads to sales team in round-robin. Send WhatsApp welcome message when lead is created. Notify manager when a deal is closed. Send reminder when lead has been in "Interested" status for 3+ days.',
      },
      {
        title: 'Managing Automations',
        content:
          'View all automations on the Automations page. Toggle automations on/off, edit trigger conditions, and view execution logs. Each automation shows its last run time and success/failure status.',
      },
    ],
  },
  {
    id: 'auto-dialer',
    icon: Phone,
    title: 'Auto Dialer',
    description: 'Sequential calling with one-click status updates.',
    articles: [
      {
        title: 'Using the Auto Dialer',
        content:
          'The Auto Dialer queues your leads and presents them one at a time for calling. Click the phone icon to initiate a call. After each call, update the lead\'s status with one tap. The system automatically advances to the next lead.',
      },
      {
        title: 'Dialer Filters',
        content:
          'Filter which leads appear in the dialer queue by status, owner, date range, or source. Prioritize hot leads by filtering for specific statuses like "Interested" or "Follow Up".',
      },
    ],
  },
  {
    id: 'forms',
    icon: FileText,
    title: 'Forms & Lead Generation',
    description: 'Create forms and generate leads from multiple sources.',
    articles: [
      {
        title: 'Form Builder',
        content:
          'Create custom lead capture forms with drag-and-drop fields. Supported field types: Text, Email, Phone, Number, Date, Select, Multi-select, Textarea, and more. Each form gets a unique public URL for sharing.',
      },
      {
        title: 'Public Forms',
        content:
          'Share form links on your website, social media, or ads. Submissions are automatically created as leads in your CRM with the source tracked. Forms support custom branding with your company logo and colors.',
      },
      {
        title: 'LG (Lead Generation) Links',
        content:
          'Create tracked links for campus ambassadors or affiliates. Each link has a unique UTM source, CA name, and campaign. Track which link generated each lead for attribution reporting.',
      },
      {
        title: 'Form Responses',
        content:
          'View all submissions for each form. Export responses as CSV. See conversion rates from form submission to qualified lead.',
      },
    ],
  },
  {
    id: 'integrations',
    icon: Globe,
    title: 'Integrations',
    description: 'Connect with Meta, Google Ads, LinkedIn, and more.',
    articles: [
      {
        title: 'Meta (Facebook) Lead Ads',
        content:
          'Connect your Facebook Page to automatically sync leads from Meta Lead Ads. Authorize via OAuth, select your page, and map lead form fields. New leads from your ad campaigns appear instantly in your CRM pipeline.',
      },
      {
        title: 'Google Ads Lead Forms',
        content:
          'Integrate Google Ads lead form extensions. Connect your Google Ads account, select campaigns, and enable lead sync. Leads from Google search and display ads flow directly into your CRM.',
      },
      {
        title: 'LinkedIn Lead Gen Forms',
        content:
          'Connect LinkedIn Campaign Manager to capture leads from LinkedIn Lead Gen Forms. Map LinkedIn form fields to your CRM lead fields for seamless data flow.',
      },
      {
        title: 'Webhook & API',
        content:
          'Use the external lead submission API to push leads from any source. The API accepts lead data via POST request and creates leads in your CRM with full field mapping support.',
      },
    ],
  },
  {
    id: 'ai-insights',
    icon: Brain,
    title: 'AI Analytics & Insights',
    description: 'AI-powered recommendations and predictions.',
    articles: [
      {
        title: 'AI Dashboard',
        content:
          'The AI Insights page powered by Gemini analyzes your lead data to provide conversion predictions, pipeline health scores, and actionable recommendations. Get AI-generated summaries of your team\'s performance.',
      },
      {
        title: 'BigData SQL',
        content:
          'Write custom SQL queries against your lead data for advanced analytics. The BigData SQL page provides a query editor with auto-complete, result visualization, and export capabilities.',
      },
    ],
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Comprehensive reporting with visual dashboards.',
    articles: [
      {
        title: 'Dashboard Metrics',
        content:
          'The main dashboard displays: Total Leads, Conversion Rate, Revenue Projected, Revenue Received, Leads by Status (pie chart), Leads Over Time (line chart), and Team Performance leaderboard.',
      },
      {
        title: 'Report Page',
        content:
          'The Report page offers detailed analytics: leads by source, leads by owner, conversion funnel, revenue breakdown, and time-based trends. Filter by date range, status, or team member.',
      },
      {
        title: 'LG Dashboard',
        content:
          'The Lead Generation Dashboard tracks performance of campus ambassadors and affiliates. View leads generated per link, conversion rates, and top performers.',
      },
    ],
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications & Reminders',
    description: 'Stay on top of every lead with smart notifications.',
    articles: [
      {
        title: 'In-App Notifications',
        content:
          'Receive real-time notifications for new lead assignments, status changes, team updates, and reminders. The notification bell in the header shows unread count. Click to view and manage all notifications.',
      },
      {
        title: 'Lead Reminders',
        content:
          'Set reminders on any lead for follow-up calls, meetings, or tasks. Reminders trigger notifications at the scheduled time. Never miss a follow-up with automated reminder polling.',
      },
      {
        title: 'Web Push Notifications',
        content:
          'Enable browser push notifications for critical updates even when you\'re not on the CRM tab. Configure which status changes trigger push notifications in Settings.',
      },
    ],
  },
  {
    id: 'tasks',
    icon: ListChecks,
    title: 'Tasks',
    description: 'Manage to-do items linked to your leads.',
    articles: [
      {
        title: 'Task Management',
        content:
          'Create tasks linked to specific leads. Set due dates, priority, and assignees. Track task completion alongside lead progress. Filter tasks by status (pending, completed, overdue) and assignee.',
      },
    ],
  },
  {
    id: 'products',
    icon: Package,
    title: 'Products & Payments',
    description: 'Manage your product catalog and payment collection.',
    articles: [
      {
        title: 'Product Management',
        content:
          'Create and manage your product catalog with name, category, price, and available quantity. Link products to leads for accurate revenue tracking. Filter leads by product category or specific product purchased.',
      },
      {
        title: 'Payment Links',
        content:
          'Generate Razorpay payment links directly from a lead\'s profile. When payment is completed, the lead\'s status automatically updates to "Paid" and revenue is recorded. Track projected vs received revenue.',
      },
      {
        title: 'Wallet System',
        content:
          'Each company has a wallet for platform purchases (licenses, add-ons, features). Recharge via Razorpay. View transaction history with descriptions for full audit trail.',
      },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings & Configuration',
    description: 'Customize every aspect of your CRM.',
    articles: [
      {
        title: 'General Settings',
        content:
          'Update your profile (name, email, phone, avatar), manage notification preferences, and configure display options. Change your password or reset it via email.',
      },
      {
        title: 'Company Settings',
        content:
          'Manage company name, logo, primary brand color, and subdomain slug. Configure lead masking to hide sensitive contact details from team members. Set unique constraints for duplicate detection.',
      },
      {
        title: 'Custom Lead Statuses',
        content:
          'Create, edit, reorder, and delete lead statuses. Assign each status a label, color, and category (New, Interested, Paid, Other). Add sub-statuses for more granular tracking. Configure which statuses trigger web push notifications.',
      },
      {
        title: 'Custom Domain',
        content:
          'Connect your own domain to your CRM workspace. Add a TXT record for verification, then point your CNAME to our servers. Your team accesses the CRM at your custom domain.',
      },
      {
        title: 'Industry Selection',
        content:
          'Your industry determines lead fields, default statuses, and UI components. Changing industry after initial setup requires a one-time fee and admin approval. Industry can be locked to prevent accidental changes.',
      },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Security & Access',
    description: 'Enterprise-grade security for your data.',
    articles: [
      {
        title: 'Authentication',
        content:
          'Secure email + password authentication powered by Supabase Auth. Password reset via email link. Session management with automatic token refresh.',
      },
      {
        title: 'Row-Level Security',
        content:
          'All data is protected by Supabase Row-Level Security (RLS). Users can only access leads belonging to their company. Managers see their subordinates\' leads based on hierarchy. Admins have full company-wide access.',
      },
      {
        title: 'Lead Masking',
        content:
          'Enable lead masking in Company Settings to hide phone numbers and emails from non-admin team members. Masked values show as "••••" until the user has explicit permission to view.',
      },
      {
        title: 'Data Isolation',
        content:
          'Every company\'s data is completely isolated via company_id-based RLS policies. Cross-company data access is impossible at the database level. Platform admins have a separate, audited access path.',
      },
    ],
  },
];

export default function Documentation() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = docSections.filter((section) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      section.title.toLowerCase().includes(q) ||
      section.description.toLowerCase().includes(q) ||
      section.articles.some(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q)
      )
    );
  });

  const selectedSection = activeSection
    ? docSections.find((s) => s.id === activeSection)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={selectedSection ? `${selectedSection.title} | Documentation` : "Documentation | Fastest CRM"}
        description={selectedSection ? selectedSection.description : "Comprehensive guide to using Fastest CRM. Learn about lead management, automations, auto-dialer, and more."}
        keywords="CRM documentation, user guide, help center, lead management guide, sales automation help"
        canonical={activeSection ? `https://www.fastestcrm.com/documentation?section=${activeSection}` : "https://www.fastestcrm.com/documentation"}
      />
      <BreadcrumbSchema items={[
        { name: 'Home', item: 'https://www.fastestcrm.com' },
        { name: 'Documentation', item: 'https://www.fastestcrm.com/documentation' },
        ...(selectedSection ? [{ name: selectedSection.title, item: `https://www.fastestcrm.com/documentation?section=${selectedSection.id}` }] : [])
      ]} />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">
                FastestCRM Documentation
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Search */}
        <div className="mb-8 flex flex-col items-center text-center">
          <h2 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How can we help?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Search our documentation or browse by topic below.
          </p>
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documentation..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setActiveSection(null);
              }}
              className="pl-10"
            />
          </div>
        </div>

        {/* Section Detail View */}
        {selectedSection && !searchTerm ? (
          <div>
            <button
              onClick={() => setActiveSection(null)}
              className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to all topics
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <selectedSection.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {selectedSection.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedSection.description}
                </p>
              </div>
            </div>

            <Accordion type="multiple" className="space-y-2">
              {selectedSection.articles.map((article, idx) => (
                <AccordionItem
                  key={idx}
                  value={`article-${idx}`}
                  className="rounded-lg border bg-card px-4"
                >
                  <AccordionTrigger className="text-left font-medium hover:no-underline">
                    {article.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {article.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : (
          /* Topics Grid */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSections.map((section) => (
              <Card
                key={section.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => {
                  setActiveSection(section.id);
                  setSearchTerm('');
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <section.icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {section.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                    {section.articles.length} article{section.articles.length !== 1 ? 's' : ''}
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredSections.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <HelpCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No results found for "{searchTerm}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
