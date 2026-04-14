import { 
  Users, Phone, Shield, Zap, TrendingUp, Brain, 
  Workflow, CreditCard, Target 
} from 'lucide-react';

export const solutionsData = {
  healthcare: {
    industry: 'Healthcare',
    icon: '🏥',
    title: 'Top AI CRM for Healthcare & Medical Clinics in India',
    description: 'Streamline patient inquiries, automate follow-ups, and manage appointments with India\'s most secure AI-powered healthcare CRM. Built for clinics, diagnostic centers, and hospitals.',
    keywords: 'healthcare crm india, clinic management software, patient lead tracking, medical sales crm, healthcare automation',
    features: [
      { icon: Shield, title: 'Patient Data Security', description: 'Enterprise-grade encryption for sensitive patient information and consultation logs.' },
      { icon: Phone, title: 'Appointment Reminders', description: 'Automated WhatsApp and SMS reminders to reduce no-shows by up to 40%.' },
      { icon: Brain, title: 'Lead Prioritization', description: 'AI-powered scoring to identify urgent medical inquiries and prioritize them for immediate response.' }
    ],
    faqs: [
      { question: 'Is Fastest CRM HIPAA compliant?', answer: 'We ensure enterprise-grade security and data residency in India, adhering to local medical data privacy standards.' },
      { question: 'Can clinics manage multiple branches?', answer: 'Yes, our 12-level hierarchy allows you to manage multiple clinics or centers under one corporate umbrella.' }
    ]
  },
  education: {
    industry: 'Education & EdTech',
    icon: '🎓',
    title: 'Best AI CRM for EdTech & Training Institutes in India',
    description: 'Convert more student inquiries into admissions. India\'s #1 EdTech CRM with automated lead capturing from Meta, Google, and your website.',
    keywords: 'edtech crm india, student admission software, education lead management, training institute crm, school management system',
    features: [
      { icon: Users, title: 'Student Journey Tracking', description: 'Track every interaction from first inquiry to course enrollment and fee payment.' },
      { icon: CreditCard, title: 'Fee Collection', description: 'Integrated Razorpay links for instant fee collection with auto-status updates.' },
      { icon: Workflow, title: 'Admission Workflows', description: 'Automate counselor assignments and follow-up schedules based on student interest.' }
    ],
    faqs: [
      { question: 'Does it integrate with Meta Ads?', answer: 'Yes, we have native integrations with Meta and Google Ads for real-time lead synchronization.' },
      { question: 'Can we track counselor performance?', answer: 'Our real-time analytics dashboard provides deep insights into each counselor\'s conversion rates and call activity.' }
    ]
  }
};
