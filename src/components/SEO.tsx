import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  twitterCard?: string;
  keywords?: string;
  noindex?: boolean;
  children?: React.ReactNode;
}

const SEO: React.FC<SEOProps> = ({
  title = "Fastest CRM | AI-Powered CRM for Indian Sales Teams",
  description = "India's first AI-powered CRM. Manage leads, calls, payments, and analytics with intelligent automation. Built for sales teams, training companies, and enrollment teams.",
  canonical,
  ogType = "website",
  ogImage = "https://www.fastestcrm.com/webimg.png",
  twitterCard = "summary_large_image",
  keywords = "CRM, AI CRM, sales CRM, lead management, India CRM, sales automation, Razorpay CRM, EdTech CRM, Real Estate CRM, auto dialer, lead tracking",
  noindex = false,
  children,
}) => {
  const siteTitle = title.includes("Fastest CRM") ? title : `${title} | Fastest CRM`;
  
  // Ensure canonical always points to www.fastestcrm.com
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const finalCanonical = canonical || `https://www.fastestcrm.com${currentPath === '/' ? '' : currentPath}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={finalCanonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={finalCanonical} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={finalCanonical} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {children}
    </Helmet>
  );
};

export default SEO;
