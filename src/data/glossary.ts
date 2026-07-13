export interface GlossaryTerm {
  term: string;
  slug: string;
  definition: string;
  fullDescription: string;
  category: 'Fundamentals' | 'AI' | 'Sales' | 'Technical';
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    term: 'CRM (Customer Relationship Management)',
    slug: 'what-is-crm',
    definition: 'A technology for managing all your company\'s relationships and interactions with customers and potential customers.',
    fullDescription: 'CRM software helps businesses stay connected to customers, streamline processes, and improve profitability. At its core, the goal is simple: Improve business relationships. Fastest CRM takes this further by integrating AI to automate most manual data entry tasks.',
    category: 'Fundamentals'
  },
  {
    term: 'AI CRM',
    slug: 'what-is-ai-crm',
    definition: 'A Customer Relationship Management system that leverages Artificial Intelligence to automate tasks, predict behavior, and provide insights.',
    fullDescription: 'AI CRM systems like Fastest CRM use large language models (like FastAI) to analyze lead sentiment, prioritize high-value calls, and automate follow-ups without manual intervention.',
    category: 'AI'
  },
  {
    term: 'Auto Dialer',
    slug: 'how-auto-dialer-works',
    definition: 'An automated system that dials phone numbers sequentially from a list for sales agents.',
    fullDescription: 'Auto dialers significantly increase agent productivity by eliminating manual dialing. Fastest CRM features a one-click continuous dialer that allows agents to update status and take notes during the call flow.',
    category: 'Sales'
  },
  {
    term: 'Lead Management',
    slug: 'lead-management-system',
    definition: 'The process of capturing leads, tracking their activities and behavior, and qualifying them before passing them to sales.',
    fullDescription: 'Effective lead management ensures that no opportunity is lost. Fastest CRM uses 12 levels of hierarchy to ensure leads are assigned to the right agent at the right time.',
    category: 'Fundamentals'
  },
  {
    term: 'Workflow Automation',
    slug: 'sales-workflow-automation',
    definition: 'A set of pre-defined rules that trigger actions based on specific criteria within the sales process.',
    fullDescription: 'Workflow automation reduces human error and ensures consistency. For example, when a lead pays via Razorpay, Fastest CRM automatically updates their status and sends a confirmation WhatsApp message.',
    category: 'Technical'
  },
  {
    term: 'Sales Pipeline',
    slug: 'sales-pipeline-stages',
    definition: 'A visual representation of where prospects are in the purchasing process.',
    fullDescription: 'A well-structured pipeline helps sales managers forecast revenue and identify bottlenecks. Fastest CRM provides real-time visualization of your pipeline from LG (Lead Generation) to Paid.',
    category: 'Sales'
  },
  {
    term: 'Lead Scoring',
    slug: 'ai-lead-scoring',
    definition: 'A methodology used to rank prospects against a scale that represents the value each lead represents to the organization.',
    fullDescription: 'Fastest CRM uses AI to score leads based on their interactions, behavior, and demographics, ensuring your team focuses on the hottest prospects first.',
    category: 'AI'
  },
  {
    term: 'FastAI',
    slug: 'fastai-crm-integration',
    definition: 'FastAI multimodal AI model integrated into Fastest CRM for advanced text and data analysis.',
    fullDescription: 'By integrating FastAI, Fastest CRM can provide deep insights into client conversations, summary reports, and even draft personalized email/WhatsApp responses automatically.',
    category: 'AI'
  },
  {
    term: 'GST Invoicing',
    slug: 'gst-invoicing-software-for-crm',
    definition: 'The ability to generate invoices that comply with the Goods and Services Tax regulations in India.',
    fullDescription: 'Fastest CRM features built-in GST-ready invoicing and quotations, allowing Indian businesses to generate professional documents directly from the lead profile.',
    category: 'Technical'
  },
  {
    term: 'Razorpay Integration',
    slug: 'razorpay-crm-integration',
    definition: 'A seamless connection between your CRM and the Razorpay payment gateway for instant payment collection.',
    fullDescription: 'With Razorpay integration, Fastest CRM allows you to send payment links via WhatsApp/SMS and automatically updates the lead to "Paid" status once the transaction is complete.',
    category: 'Technical'
  }
];
