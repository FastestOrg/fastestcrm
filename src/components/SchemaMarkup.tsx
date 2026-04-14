import React from 'react';

/**
 * Organization Schema
 */
export const OrganizationSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Fastest CRM",
    "url": "https://www.fastestcrm.com",
    "logo": "https://www.fastestcrm.com/fastestcrmlogo.png",
    "sameAs": [
      "https://twitter.com/LeadCubed",
      "https://linkedin.com/company/fastestcrm"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-XXXXXXXXXX",
      "contactType": "sales",
      "areaServed": "IN",
      "availableLanguage": ["en", "hi"]
    }
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
};

/**
 * Breadcrumb Schema
 */
export const BreadcrumbSchema = ({ items }: { items: { name: string; item: string }[] }) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.item
    }))
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
};

/**
 * FAQ Schema
 */
export const FAQSchema = ({ faqs }: { faqs: { question: string; answer: string }[] }) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
};

/**
 * SoftwareApplication Schema (Enhanced)
 */
export const SoftwareAppSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Fastest CRM",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "url": "https://www.fastestcrm.com",
    "description": "India's first AI-powered CRM built for sales teams, training companies, and enrollment teams. Manage leads, calls, payments, and analytics with intelligent automation powered by Google Gemini.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "INR",
      "description": "Free starter plan available. Paid plans start from Rs.10/day/employee."
    },
    "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "120"
      },
    "featureList": [
      "AI-Powered Lead Management",
      "Auto Dialer",
      "Razorpay Payment Integration",
      "Workflow Automation",
      "Team Hierarchy Management",
      "Real-time Analytics"
    ]
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
};

/**
 * Article Schema
 */
export const ArticleSchema = ({ 
  title, 
  description, 
  image, 
  author, 
  datePublished, 
  dateModified, 
  url 
}: {
  title: string;
  description: string;
  image: string;
  author: string;
  datePublished: string;
  dateModified?: string;
  url: string;
}) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "description": description,
    "image": image,
    "author": {
      "@type": "Person",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Fastest CRM",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.fastestcrm.com/fastestcrmlogo.png"
      }
    },
    "datePublished": datePublished,
    "dateModified": dateModified || datePublished,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    }
  };

  return <script type="application/ld+json">{JSON.stringify(schema)}</script>;
};
