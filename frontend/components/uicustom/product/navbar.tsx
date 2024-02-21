'use client'

import { Button } from "@/components/ui/button"
// import { MyUserButton } from "@/components/uicustom/auth/buttons/user-button";
import Link from "next/link";
import { usePathname } from "next/navigation"

export const MyNavbarProducts = () => {
  
    const pathname = usePathname();

    return (
      <nav className="bg-secondary flex justify-center items-center p-4 rounded-xl w-[90%] m-4 shadow-sm">
        <div className="flex flex-wrap gap-1 justify-center w-full md:flex-row gap-x-2">
          <Button asChild variant={pathname === '/products' ? 'vegaEmeraldBtn' : 'vegaNormalBtn'} className="hover:shadow-md transition-shadow duration-300">
            <Link href='/products'>Discovery</Link>
          </Button>
          <Button asChild variant={pathname === '/products/daily-deals' ? 'vegaEmeraldBtn' : 'vegaNormalBtn'} className="hover:shadow-md transition-shadow duration-300">
            <Link href='/products/daily-deals'>Daily Deals</Link>
          </Button>
          <Button asChild variant={pathname === '/products/member-discount' ? 'vegaEmeraldBtn' : 'vegaNormalBtn'} className="hover:shadow-md transition-shadow duration-300">
            <Link href='/products/member-discount'>Member Discounts</Link>
          </Button>
          <Button  asChild variant={pathname === '/products/create' ? 'vegaEmeraldBtn' : 'vegaNormalBtn'} className="hover:shadow-md transition-shadow duration-300">
            <Link href='/products/create'>Create</Link>
          </Button>
        </div>
        <div>
          
        </div>
        {/* <MyUserButton /> */}
      </nav>
    )
}