'use client';

import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FaCartFlatbed } from "react-icons/fa6";
import { FaUser } from 'react-icons/fa';
import { useCurrentUser } from '@/hooks/use-current-user';
import { MyLogoutButton } from './logout-button';
import Link from 'next/link';
import { ExitIcon } from '@radix-ui/react-icons';
import { MyThemeBtn } from '../../themebtn';
import { useTheme } from 'next-themes';
import { TiMessages } from "react-icons/ti";
import { MyDialogbarNavigator } from '@/app/(protected)/_components/dialog-bar';
import WalletConnection from '@/components/crypto-related/WalletAdapter';

export const MyUserButton = () => {
  const user = useCurrentUser();
  const customName = 'vegaThemeBtnDefault';

  const { setTheme, theme } = useTheme();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    setDropdownOpen(false); // Hide the dropdown menu
  };

  const handleMenuItemClick = () => {
    setDropdownOpen(false); // Hide the dropdown menu
  };

  const style = {
    dropDownItemStyle: 'relative hover:bg-sky-500/40 dark:hover:bg-sky-500/40 flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  };

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
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
        <div className={style.dropDownItemStyle}>
          <div className='flex justify-start items-center' onClick={handleThemeToggle}>
            <MyThemeBtn customName={customName} onClick={handleThemeToggle} />
            <p className='hidden dark:flex'>Dark mode</p>
            <p className='dark:hidden'>Light mode</p>
          </div>
        </div>
        <div className={style.dropDownItemStyle}>
          <div className='w-full flex '>
            <MyDialogbarNavigator />
          </div>
        </div>
        <Link href='/conversations'>
          <div className={style.dropDownItemStyle} onClick={handleMenuItemClick}>
            <div className={'flex items-center justify-center gap-3 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
              <TiMessages className={`min-h-[1.2rem] min-w-[1.2rem]`} />
              <p className=''>Conversations</p>
            </div>
          </div>
        </Link>
        <Link href='/cart'>
          <div className={style.dropDownItemStyle} onClick={handleMenuItemClick}>
            <div className={'flex items-center justify-center gap-3 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
              <FaCartFlatbed className={`min-h-[1.2rem] min-w-[1.2rem]`} />
              <p className=''>Cart</p>
            </div>
          </div>
        </Link>
        <WalletConnection />
        <MyLogoutButton>
          <div className={style.dropDownItemStyle} onClick={handleMenuItemClick}>
            <div className={'flex items-center justify-center gap-2 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
              <ExitIcon className={`h-6 w-6 pr-1`} /><span>Logout</span>
            </div>
          </div>
        </MyLogoutButton>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};