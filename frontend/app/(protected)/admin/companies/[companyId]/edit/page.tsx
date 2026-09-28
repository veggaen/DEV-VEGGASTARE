import { CompanyEditor } from '../../CompanyEditor';
export default async function CompanyEditPage({ params }: { params: Promise<{ companyId: string }> }) {
  return <CompanyEditor companyId={(await params).companyId} mode="edit" />;
}
