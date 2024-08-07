'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AiOutlineCloudServer, AiOutlineSetting, AiOutlineUser } from "react-icons/ai";
import { MdWork, MdAddCircleOutline, MdBusiness } from "react-icons/md";
import { CiInboxIn } from "react-icons/ci";
import { SiGooglebigquery } from "react-icons/si";
import { TbHexagons } from "react-icons/tb";
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { useCurrentUser } from "@/hooks/use-current-user";

export const MyNavbarProtected = () => {
  const user = useCurrentUser();
  const pathname = usePathname();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDialogOpenChange = (isOpen: boolean) => {
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
      <div className="lg:hidden">
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild className={`hover:bg-black/10 hover:font-semibold dark:hover:bg-white/10 rounded-sm py-1 md:py-2 px-2 md:px-4 transition-colors underline-offset-4`}>
            <Button variant='vegaNormalBtn' className=''>
              Nexus Menu
            </Button>
          </DialogTrigger>
          <DialogContent className='bg-black bg-gradient-to-tr dark:from-slate-600 dark:to-slate-800 from-blue-100 via-gray-200 to-blue-200 border-gray-500/50 top-[50%]'>
            <DialogHeader className=''>
              <DialogTitle className='flex justify-center items-center gap-1'>
                <TbHexagons className={`min-h-[1.6rem] min-w-[1.6rem]`} />
                <h1 className='py-4'>Nexus Menu</h1>
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-2 py-2">
              <Button asChild variant={pathname === '/nexus' ? 'default' : 'outline'} className="w-full flex items-center justify-start dark:bg-gray-800 dark:text-white dark:border-gray-700" onClick={handleLinkClick}>
                <Link href='/nexus' className='flex w-full justify-start gap-1 items-center'>
                  <AiOutlineSetting className="text-2xl" />
                  <span className=''>User Settings</span>
                </Link>
              </Button>
              <Button asChild variant={pathname === '/nexus/company' ? 'default' : 'outline'} className="w-full flex items-center justify-start dark:bg-gray-800 dark:text-white dark:border-gray-700" onClick={handleLinkClick}>
                <Link href='/nexus/company' className='flex w-full justify-start gap-1 items-center'>
                  <MdBusiness className="text-2xl" />
                  <span className=''>Company Dashboard</span>
                </Link>
              </Button>
              <Button asChild variant={pathname === '/server' ? 'default' : 'outline'} className="w-full flex items-center justify-start dark:bg-gray-800 dark:text-white dark:border-gray-700" onClick={handleLinkClick}>
                <Link href='/server' className='flex w-full justify-start gap-1 items-center'>
                  <AiOutlineCloudServer className="text-2xl" />
                  <span className=''>My Server Data</span>
                </Link>
              </Button>
              <Button asChild variant={pathname === '/client' ? 'default' : 'outline'} className="w-full flex items-center justify-start dark:bg-gray-800 dark:text-white dark:border-gray-700" onClick={handleLinkClick}>
                <Link href='/client' className='flex w-full justify-start gap-1 items-center'>
                  <AiOutlineUser className="text-2xl" />
                  <span className=''>My Client data</span>
                </Link>
              </Button>
              <Button asChild variant={pathname === '/admin' ? 'default' : 'outline'} className="w-full flex items-center justify-start dark:bg-gray-800 dark:text-white dark:border-gray-700" onClick={handleLinkClick}>
                <Link href='/admin' className='flex w-full justify-start gap-1 items-center'>
                  <AiOutlineUser className="text-2xl" />
                  <span className=''>My Admin Manager</span>
                </Link>
              </Button>
              <Button asChild variant={pathname === '/nexus/company/create' ? 'default' : 'outline'} className="w-full flex items-center justify-start dark:bg-gray-800 dark:text-white dark:border-gray-700" onClick={handleLinkClick}>
                <Link href='/nexus/company/create' className='flex w-full justify-start gap-1 items-center'>
                  <MdAddCircleOutline className="text-2xl" />
                  <span className=''>Create Company</span>
                </Link>
              </Button>
            </div>
            <DialogFooter className='flex justify-center items-center w-full'>
              <Button variant='outline' onClick={() => setIsDialogOpen(false)} className='border-black/25 dark:border-white/25 hover:border-black/45 hover:dark:border-white/45'>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};