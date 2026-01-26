'use client';

import MyCompanies from "@/components/uicustom/company/my-companies";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function CompanyListClient() {
  const user = useCurrentUser();
  if (!user) return <div>User is loading...</div>;
  return (
    <div className="w-full">
      <MyCompanies />
    </div>
  );
}
