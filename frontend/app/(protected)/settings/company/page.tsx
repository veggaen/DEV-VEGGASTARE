'use client'

import { MyCompanyCreateForm } from "@/components/uicustom/company/company-create-form";
import MyCompanies from "@/components/uicustom/company/my-companies";
import { useCurrentUser } from "@/hooks/use-current-user";
import Link from "next/link";

const MyProtectedSettingsCompany = () => {
    const user = useCurrentUser();
    if (!user) return <div>loading...</div>;
    return (
        <div className='flex flex-col gap-2 w-full'>
          <div className='text-center'>
            <h1>Company Settings</h1>
          </div>
          <div className="flex justify-center items-start py-4">
              <Link href="/settings/company/create">
                <div className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                  Create a Company
                </div>
              </Link>
          </div>
          <MyCompanies />
        </div>
    );
}
export default MyProtectedSettingsCompany; // protected router component