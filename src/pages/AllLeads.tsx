import { useCompany } from '@/hooks/useCompany';
import RealEstateAllLeads from '@/industries/real_estate/RealEstateAllLeads';
import SaaSAllLeads from '@/industries/saas/SaaSAllLeads';
import HealthcareAllLeads from '@/industries/healthcare/HealthcareAllLeads';
import InsuranceAllLeads from '@/industries/insurance/InsuranceAllLeads';
import TravelAllLeads from '@/industries/travel/TravelAllLeads';
import GenericAllLeads from './GenericAllLeads';

export default function AllLeads() {
  const { company, loading } = useCompany();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
}
