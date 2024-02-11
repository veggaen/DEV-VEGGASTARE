'use client'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { FaUser } from 'react-icons/fa'
import { useCurrentUser } from '@/hooks/use-current-user'
import { MyLogoutButton } from './logout-button'
import Link from 'next/link'
import { ExitIcon } from '@radix-ui/react-icons'

interface MyUserButtonProps { 
  size: string
}

export const MyUserButton = () => {
    const user = useCurrentUser();

    return (
      <DropdownMenu>
        <div className='flex justify-center items-center gap-3'>
          {user && user.name}
          <DropdownMenuTrigger className='outline-none'>
            <Avatar className={`h-12 w-12 hover:scale-105`}>
              <AvatarImage src={user?.image || ''} alt="User" />
              <AvatarFallback className='bg-emerald-500 outline-none'>
                <FaUser />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent className={`w-40 pr-1`} align='end'>
        <Link href='/settings'><DropdownMenuItem>Settings</DropdownMenuItem></Link>
          <MyLogoutButton >
            <DropdownMenuItem><ExitIcon className={`h-6 w-6 pr-1`} /><span>Logout</span></DropdownMenuItem>
          </MyLogoutButton>
        </DropdownMenuContent>
      </DropdownMenu>
    )
}