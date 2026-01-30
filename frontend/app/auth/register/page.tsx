import { MyRegisterform } from "@/components/uicustom/auth/forms/register-form";


const LOG_PREFIX = '[frontend/app/auth/register/page.tsx]'
const MyPageLogin = async () => {

  return (
    <div className="flex flex-col items-center w-full py-8 px-4 sm:px-8">
      <div className="flex flex-col items-center justify-center mb-6">
        <h1 className="text-2xl md:text-4xl font-bold">Embark on Discovery</h1>
      </div>
      <MyRegisterform />
    </div>
  )
}
export default MyPageLogin;
