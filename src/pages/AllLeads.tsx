import { Suspense } from 'react';
import { useCompany } from '@/hooks/useCompany';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';

const RealEstateAllLeads = lazy(() => import('@/industries/real_estate/RealEstateAllLeads'));
const SaaSAllLeads = lazy(() => import('@/industries/saas/SaaSAllLeads'));
const HealthcareAllLeads = lazy(() => import('@/industries/healthcare/HealthcareAllLeads'));
const InsuranceAllLeads = lazy(() => import('@/industries/insurance/InsuranceAllLeads'));
const TravelAllLeads = lazy(() => import('@/industries/travel/TravelAllLeads'));
const GenericAllLeads = lazy(() => import('./GenericAllLeads'));

function LeadsLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

export default function AllLeads() {
  const { company, loading } = useCompany();

  if (loading) {
    return <LeadsLoadingFallback />;
  }

  const renderIndustryLeads = () => {
    if (company?.custom_leads_table) {
      return <GenericAllLeads />;
    }

    const industry = (company as any)?.industry?.toLowerCase();

    if (industry === 'saas') {
      return <SaaSAllLeads />;
    }

    if (industry === 'real_estate') {
      return <RealEstateAllLeads />;
    }

    if (industry === 'healthcare') {
      return <HealthcareAllLeads />;
    }

    if (industry === 'insurance') {
      return <InsuranceAllLeads />;
    }

    if (industry === 'travel') {
      return <TravelAllLeads />;
    }

    return <GenericAllLeads />;
  };

  return (
    <Suspense fallback={<LeadsLoadingFallback />}>
      {renderIndustryLeads()}
    </Suspense>
  );
}
