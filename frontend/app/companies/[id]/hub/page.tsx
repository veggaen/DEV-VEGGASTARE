export const dynamic = 'force-dynamic';
export const revalidate = 0;

import CompanyHubClient from './CompanyHubClient';

export default async function CompanyHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: companyId } = await params;
  return <CompanyHubClient companyId={companyId} />;
}
