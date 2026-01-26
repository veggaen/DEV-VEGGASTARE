export const dynamic = 'force-dynamic';
export const revalidate = 0;

import CompanyListClient from './CompanyListClient';

export default function MyProtectedSettingsCompany() {
  return <CompanyListClient />;
}