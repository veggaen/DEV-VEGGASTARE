import { CompanyEditor } from '../CompanyEditor';
export default async function CompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  return <CompanyEditor companyId={(await params).companyId} mode="view" />;
}
