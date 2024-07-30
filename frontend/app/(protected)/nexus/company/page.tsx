'use client'

import MyCompanies from "@/components/uicustom/company/my-companies";
import { useCurrentUser } from "@/hooks/use-current-user";

const MyProtectedSettingsCompany = () => {
    const user = useCurrentUser();
    if (!user) return <div>User is loading...</div>;
    return (
        <div className='w-full'>
          <MyCompanies />
        </div>
    );
}
export default MyProtectedSettingsCompany; // protected router component