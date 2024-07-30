'use client'
import Link from "next/link";
import { MyThemeBtn } from "./themebtn";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MyUserButton } from "./auth/buttons/user-button";
import { usePathname } from "next/navigation";
import { MyNavbarProtected } from "@/app/(protected)/_components/navbar";

const MyTopBar = () => {

  const user = useCurrentUser();
  const pathname = usePathname();

  return (
      <div className="flex min-h-[72px] h-full max-h-[102px] w-full justify-between items-center transition-width duration-300 ease-in-out text-black dark:text-white myamination">
        <div className="flex flex-col xs:flex-row justify-center items-center py-2 px-4 space-x-2">
          <div className="transition duration-500 ease-in-out transform">
            <Link href="/" className={`hover:bg-black/10 dark:hover:bg-white/10 rounded-sm py-1 md:py-2 px-2 md:px-4 transition-colors underline-offset-4 ${pathname === '/' ? 'underline' : ''}`}> Home </Link>
          </div>
          <div className="transition duration-500 ease-in-out transform">
            <Link href="/products" className={`hover:bg-black/10 dark:hover:bg-white/10 rounded-sm py-1 md:py-2 px-2 md:px-4 transition-colors underline-offset-4 ${pathname.includes('/products') ? 'underline' : ''}`}> Products </Link>
          </div>
          <div className="transition duration-500 ease-in-out transform">
            <Link href="/warehouses" className={`hover:bg-black/10 dark:hover:bg-white/10 rounded-sm py-1 md:py-2 px-2 md:px-4 transition-colors underline-offset-4 ${pathname.includes('/warehouses') ? 'underline' : ''}`}> Warehouses </Link>
          </div>
        </div>
        <MyNavbarProtected />
        <div className="flex justify-center md:w-48 items-center gap-6 rounded-sm mr-2">
          <div className="hidden md:flex">
            <MyThemeBtn />
          </div>
          
          {user && <MyUserButton />}
        </div>
      </div>
  )
}
export default MyTopBar;