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

export const MyDialogbarNavigator = () => {
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

  return (
    <div className="">
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogTrigger asChild>
          <div className={'w-full h-full flex items-center justify-center gap-3 rounded-lg p-2 transition duration-300 ease-in-out transform hover:bg-black/20/0 dark:hover:bg-zinc-700/0'}>
            <TbHexagons className={`min-h-[1.6rem] min-w-[1.6rem]`} />
            <p className=''>Nexus</p>
          </div>
        </DialogTrigger>
        <DialogContent className='bg-black bg-gradient-to-tr dark:from-slate-600 dark:to-slate-800 from-blue-100 via-gray-200 to-blue-200 border-gray-500/50 top-[50%]'>
          <DialogHeader className=''>
            <DialogTitle className='flex justify-center items-center gap-1'>
              <TbHexagons className={`min-h-[1.6rem] min-w-[1.6rem]`} />
              <h1 className='py-4'>Nexus Menu</h1>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 py-2">
          <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus' ? 'bg-black/20 border-black/50 dark:border-white/50 border dark:bg-zinc-700' : ''}`} onClick={handleLinkClick} >
          <Link href='/nexus' className='flex flex-col items-center'>
            <AiOutlineSetting className="text-2xl" />
            <span className="text-xxs mt-1 group-hover:font-semibold">Settings</span>
          </Link>
        </Button>
        <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company' ? 'bg-black/20 border-black/50 dark:border-white/50 border dark:bg-zinc-700' : ''}`} onClick={handleLinkClick} >
          <Link href='/nexus/company' className='flex flex-col items-center'>
            <MdBusiness className="text-2xl" />
            <span className="text-xxs mt-1 group-hover:font-semibold">Company</span>
          </Link>
        </Button>
        <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company/create' ? 'bg-black/20 border-black/50 dark:border-white/50 border dark:bg-zinc-700' : ''}`}  onClick={handleLinkClick} >
          <Link href='/nexus/company/create' className='flex flex-col items-center'>
            <MdBusiness className="text-2xl hidden group-hover:flex" />
            <MdAddCircleOutline className="text-2xl group-hover:hidden" />
            <span className="text-xxs mt-1 group-hover:font-semibold">Create</span>
          </Link>
        </Button>
        <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company/job-box' ? 'bg-black/20 border-black/50 dark:border-white/50 border dark:bg-zinc-700' : ''}`} onClick={handleLinkClick} >
          <Link href='/nexus/company/job-box' className='flex flex-col items-center'>
            <CiInboxIn className="text-2xl" />
            <span className="text-xxs mt-1 group-hover:font-semibold">Job Box</span>
          </Link>
        </Button>
        <Button asChild variant="vegaThemeBtn" className={`group w-[72px] h-[64px] flex flex-col items-center justify-center ${pathname === '/nexus/company/job-ask' ? 'bg-black/20 border-black/50 dark:border-white/50 border  dark:bg-zinc-700' : ''}`} onClick={handleLinkClick} >
          <Link href='/nexus/company/job-ask' className='flex flex-col items-center'>
            <SiGooglebigquery className="text-2xl" />
            <span className="text-xxs mt-1 group-hover:font-semibold">Job Ask</span>
          </Link>
        </Button>
          </div>
          <DialogFooter className=''>
    <div className='w-full flex justify-center items-center'>
              <Button variant='outline' onClick={() => setIsDialogOpen(false)} className='border-black/25 dark:border-white/25 hover:border-black/45 hover:dark:border-white/45'>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};