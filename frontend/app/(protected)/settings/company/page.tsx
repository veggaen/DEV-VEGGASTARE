'use client'

import { MyCompanyCreateForm } from "@/components/uicustom/company/company-create-form";

const MyProtectedSettingsCompany = () => {
    return (
        <div className='flex flex-col gap-2 w-full'>
          <div className='text-center'>
            <h1>Company Settings</h1>
          </div>
          <div className="flex justify-center items-start py-4">
              <MyCompanyCreateForm />
          </div>
        </div>
    );
}
export default MyProtectedSettingsCompany; // protected router component