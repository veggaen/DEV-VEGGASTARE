'use client'

import { Button } from "@/components/ui/button"
// import { MyUserButton } from "@/components/uicustom/auth/buttons/user-button";
import Link from "next/link";
import { usePathname } from "next/navigation"

export const MyNavbarProtected = () => {
  
    const pathname = usePathname();

    return (
      <nav className="bg-secondary flex justify-between items-center p-4 rounded-xl max-w-[600px] w-full m-4 shadow-sm">
        <div className="flex flex-wrap gap-x-2">
          <Button  asChild variant={pathname === '/server' ? 'default' : 'outline'} >
            <Link href='/server'>server</Link>
          </Button>
          <Button asChild variant={pathname === '/client' ? 'default' : 'outline'}>
            <Link href='/client'>Client</Link>
          </Button>
          <Button asChild variant={pathname === '/admin' ? 'default' : 'outline'}>
            <Link href='/admin'>Admin</Link>
          </Button>
          <Button asChild variant={pathname === '/settings' ? 'default' : 'outline'}>
            <Link href='/settings'>Settings</Link>
          </Button>
          <Button asChild variant={pathname === '/settings/company' ? 'default' : 'outline'}>
            <Link href='/settings/company'>Company</Link>
          </Button>
            
        </div>
        {/* <MyUserButton /> */}
      </nav>
    )
}