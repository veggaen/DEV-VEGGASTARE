import { Button } from "@/components/ui/button";
import { MyLoginButton } from "@/components/uicustom/auth/buttons/login-button";
import MyHeroImage from "@/components/uicustom/hero-image";
import { MyLibEmailAuth, MyLibUserAuth } from "@/lib/user-auth";

import { LockKeyhole } from "lucide-react";

const LOG_PREFIX = '[page.tsx]'
export default async function Home() {
  const user = await MyLibUserAuth()
  console.log(`${LOG_PREFIX} user`, user)

  return (
    <main className={`flex h-full flex-col items-center ${user ? 'justify-start' : 'justify-center'} scroll-smooth`}>
      {!user ? (
      <div className="space-y-6 p-6">
        <h1 className="text-6xl font-semibold text-white drop-shadow-md mb-2">The Future awaits!</h1>
        <MyLoginButton mode="modal" asChild ><Button size="lg" variant='vegaEmeraldBtn' className="group"><LockKeyhole size={21} className="mr-2 group-hover:animate-bounce"/>Auth</Button></MyLoginButton>
        <p>Build with Authentication service</p>
      </div>
      ) : (
        <div className="flex xl:min-h-screen flex-col items-center justify-start text-black dark:text-white">
          <div className="relative text-center place-items-center">
            <h1 className='font-bold font-sans text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl pt-6 md:pt-8 lg:pt-10'>Where Choices Know No Limits</h1>
            <h2 className='font-bold font-sans text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl pt-2 md:pt-4 lg:pt-6 lg:pb-6'>Freedom Store™</h2>
            <p className='py-5 hidden md:block text-xs sm:text-sm text-opacity-50 md:max-w-[800px] xl:max-w-[1000px] text-pretty'>
              Welcome to our emporium, the Freedom Store
              Embark on a shopping journey like no other, exploring a vast array of products that cater to every need, want, and desire.
              From the latest trends to timeless classics, our store is a treasure trove of possibilities, ensuring you discover the perfect items that reflect your unique style and preferences.
              At Where Choices Know No Limits we redefine the shopping experience, offering a world of options at your fingertips
            </p>
            <p className='py-5 md:hidden text-xs sm:text-sm'>
              Magical and smart – Magic Refrigerator™. Organize food, control your home, enjoy entertainment, and share messages, all in one kitchen appliance.
            </p>
          </div>
          <MyHeroImage />
        </div>
      )}
    </main>
  );
}
