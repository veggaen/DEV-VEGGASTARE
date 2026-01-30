export const dynamic = 'force-dynamic';
export const revalidate = 0;

import AllCompanies from "@/components/uicustom/company/all-companies";

export default function CompaniesPage() {
  return (
    <div className="w-full">
      <AllCompanies />
    </div>
  );
}
