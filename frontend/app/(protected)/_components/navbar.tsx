'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AiOutlineCloudServer, AiOutlineSetting, AiOutlineUser } from "react-icons/ai";
import { MdWork, MdAddCircleOutline, MdBusiness } from "react-icons/md";
import { CiInboxIn } from "react-icons/ci";
import { SiGooglebigquery } from "react-icons/si";

import { useState } from 'react';
import { useCurrentUser } from "@/hooks/use-current-user";
import { MyDialogbarNavigator } from "./dialog-bar";

export const MyNavbarProtected = () => {
  const user = useCurrentUser();
  const pathname = usePathname();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDialogOpenChange = (isOpen: boolean) => {
    console.log('handleDialogOpenChange:', isOpen);
    setIsDialogOpen(isOpen);
  };

  const handleLinkClick = () => {
    setIsDialogOpen(false);
  };

  if (!pathname.startsWith('/nexus')) {
    return null;
  }

  return (
    <div>
      <nav className="hidden lg:flex text-white justify-center items-center w-full mx-auto py-2">
        <div className="flex flex-wrap justify-center items-center gap-3 text-black dark:text-white">
          <div className={`flex flex-wrap justify-center items-center gap-3 text-black dark:text-white ${user && user.role === 'ADMIN' ? '' : 'hidden'}`}>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/server' ? 'bg-black/20 dark:bg-zinc-700' : ''}`}>
            <Link href='/server' className='flex flex-col items-center'>
              <AiOutlineCloudServer className="text-2xl" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Server</span>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/client' ? 'bg-black/20 dark:bg-zinc-700' : ''}`}>
            <Link href='/client' className='flex flex-col items-center'>
              <AiOutlineUser className="text-2xl" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Client</span>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/admin' ? 'bg-black/20 dark:bg-zinc-700' : ''}`}>
            <Link href='/admin' className='flex flex-col items-center'>
              <AiOutlineUser className="text-2xl" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Admin</span>
            </Link>
          </Button>
          </div>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus' ? 'bg-black/20 dark:bg-zinc-700' : ''}`}>
            <Link href='/nexus' className='flex flex-col items-center'>
              <AiOutlineSetting className="text-2xl" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Settings</span>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company' ? 'bg-black/20 dark:bg-zinc-700' : ''}`}>
            <Link href='/nexus/company' className='flex flex-col items-center'>
              <MdBusiness className="text-2xl" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Company</span>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company/create' ? 'bg-black/20 dark:bg-zinc-700' : ''}`} >
            <Link href='/nexus/company/create' className='flex flex-col items-center'>
              <MdBusiness className="text-2xl hidden group-hover:flex" />
              <MdAddCircleOutline className="text-2xl group-hover:hidden" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Create</span>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company/job-box' ? 'bg-black/20 dark:bg-zinc-700' : ''}`}>
            <Link href='/nexus/company/job-box' className='flex flex-col items-center'>
              <CiInboxIn className="text-2xl" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Job Box</span>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company/job-ask' ? 'bg-black/20 dark:bg-zinc-700' : ''}`}>
            <Link href='/nexus/company/job-ask' className='flex flex-col items-center'>
              <SiGooglebigquery className="text-2xl" />
              <span className="text-xxs mt-1 group-hover:font-semibold">Job Ask</span>
            </Link>
          </Button>
        </div>
      </nav>
      <div className='lg:hidden'>
        <MyDialogbarNavigator />
      </div>
    </div>
  );
};