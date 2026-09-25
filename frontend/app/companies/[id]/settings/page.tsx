export const dynamic = 'force-dynamic';
export const revalidate = 0;

import CompanySettingsClient from './CompanySettingsClient';

export default async function CompanySettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A company switch must never carry a receiving-email or metadata draft over.
  return <CompanySettingsClient key={id} />;
}
