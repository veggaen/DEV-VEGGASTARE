'use client'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { AiOutlineCluster } from "react-icons/ai";
import { TbHexagons } from "react-icons/tb";
import { FaCartFlatbed } from "react-icons/fa6";
import { FaUser } from 'react-icons/fa'
import { useCurrentUser } from '@/hooks/use-current-user'
import { MyLogoutButton } from './logout-button'
import Link from 'next/link'
import { ExitIcon } from '@radix-ui/react-icons'
import { MyThemeBtn } from '../../themebtn'
import { useTheme } from 'next-themes'  // Add this import
import { MyNavbarProtected } from '@/app/(protected)/_components/navbar';

interface MyUserButtonProps { 
  size: string
}

export const MyUserButton = () => {
    const user = useCurrentUser();
    const customName = 'vegaThemeBtnDefault'

    const { setTheme, theme } = useTheme()  // Move this out of the function to be directly within the component

    const handleThemeToggle = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }

    return (
      <DropdownMenu>
        <div className='flex justify-center items-center gap-3'>
          <div className='hidden md:flex'>
            {user && user.name}
          </div>
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
          <DropdownMenuItem>

          <div className='flex justify-start items-center' onClick={handleThemeToggle}>
            <MyThemeBtn customName={customName} onClick={handleThemeToggle} />
            <p className='hidden dark:flex'>Dark mode</p>
            <p className='dark:hidden'>Light mode</p>
          </div>
          </DropdownMenuItem>
          <Link href='/nexus/company'>
            <DropdownMenuItem>
              <div className={'flex items-center justify-center gap-3 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
                <TbHexagons className={`min-h-[1.2rem] min-w-[1.2rem]`} />
                <p className=''>Nexus</p>
              </div>
            </DropdownMenuItem>
          </Link>
          <Link href='/cart'>
            <DropdownMenuItem>
              <div className={'flex items-center justify-center gap-3 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
                <FaCartFlatbed className={`min-h-[1.2rem] min-w-[1.2rem]`} />
                <p className=''>Cart</p>
              </div>
            </DropdownMenuItem>
          </Link>
          <div className="flex md:hidden">
            <DropdownMenuItem>
              <div className={'flex items-center justify-center gap-2 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
                <MyNavbarProtected />
              </div>
            </DropdownMenuItem>
          </div>
          <MyLogoutButton >
            <DropdownMenuItem>
              <div className={'flex items-center justify-center gap-2 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
                <ExitIcon className={`h-6 w-6 pr-1`} /><span>Logout</span>
              </div>
            </DropdownMenuItem>
          </MyLogoutButton>
        </DropdownMenuContent>
      </DropdownMenu>
    )
}