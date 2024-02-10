import { MyRegisterform } from "@/components/uicustom/auth/forms/register-form";


const LOG_PREFIX = '[frontend/app/auth/register/page.tsx]'
const MyPageLogin = async () => {
  return (
    <div className="flex flex-col justify-start items-center w-full mt-4 bg-gradient-to-tr dark:from-slate-600 dark:to-slate-800 from-blue-100 via-gray-200 to-blue-200 myamination p-4 sm:p-8">
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-2xl md:text-4xl font-bold">Embark on Discovery</h1>
            <p className="font-semibold md:text-xl"></p>
          </div>
          <MyRegisterform />
        </div>
  )
}
export default MyPageLogin;
