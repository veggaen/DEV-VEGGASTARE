'use client'

import { MyCompanyCreateForm } from "@/components/uicustom/company/company-create-form";

const CompanyCreatePage = () => {
    return (
        <div className='min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900'>
          <div className='mx-auto max-w-3xl px-4 py-8 sm:py-12'>
            {/* Header */}
            <div className='text-center mb-8'>
              <h1 className='text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2'>
                Create Your Company
              </h1>
              <p className='text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto'>
                Set up your business profile to start selling products and managing your team
              </p>
            </div>
            {/* Form */}
            <div className="flex justify-center items-start">
                <MyCompanyCreateForm />
            </div>
          </div>
        </div>
    );
}
export default CompanyCreatePage;
