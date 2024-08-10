'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TiMessages } from "react-icons/ti";
import { AiOutlineSetting } from "react-icons/ai";
import { MdAddCircleOutline, MdBusiness } from "react-icons/md";
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
import { AspectRatio } from '@/components/ui/aspect-ratio';
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
  const style = {
    btn: 'group w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/6 flex flex-col items-center justify-center'
  }
  return (
  <div className="">
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <div className={'w-full h-full flex items-center justify-center gap-3 rounded-lg p-2 transition duration-300 ease-in-out transform'}>
          <TbHexagons className={`min-h-[1.6rem] min-w-[1.6rem]`} />
          <p className=''>Nexus</p>
        </div>
      </DialogTrigger>
      <DialogContent className='bg-black lg:min-w-[1650px] bg-gradient-to-tr dark:from-slate-700 dark:to-slate-800 from-blue-100 via-gray-200 to-blue-200 border-gray-500/50 top-[50%] lg:top-[25%]'>
        <DialogHeader className=''>
          <DialogTitle className='flex justify-center items-center gap-1'>
            <TbHexagons className={`min-h-[1.6rem] min-w-[1.6rem]`} />
            <h1 className='py-4'>Nexus Navigator</h1>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap md:flex-row justify-center items-center gap-4 py-2">
          <Button asChild variant="vegaThemeBtn" className={`${style.btn} ${pathname === '/nexus' ? 'bg-black/20 border-black/50 dark:border-white/20 border dark:bg-zinc-200/10' : ''}`} onClick={handleLinkClick} >
              <Link href='/nexus'>
                <div className='flex items-center w-fit h-fit gap-2'>
                  <AiOutlineSetting className="text-2xl" />
                  <span className="text-xxs  group-hover:font-semibold">User Settings</span>
                </div>
              </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`${style.btn} ${pathname === '/nexus/company' ? 'bg-black/20 border-black/50 dark:border-white/20 border dark:bg-zinc-200/10' : ''}`} onClick={handleLinkClick} >
            <Link href='/nexus/company'>
              <div className='flex items-center w-fit h-fit gap-2'>
                <MdBusiness className="text-2xl" />
                <span className="text-xxs  group-hover:font-semibold">Company</span>
              </div>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`${style.btn} ${pathname === '/nexus/company/create' ? 'bg-black/20 border-black/50 dark:border-white/20 border dark:bg-zinc-200/10' : ''}`}  onClick={handleLinkClick} >
            <Link href='/nexus/company/create'>
              <div className='flex items-center w-fit h-fit gap-2'>
                <MdBusiness className="text-2xl hidden group-hover:flex" />
                <MdAddCircleOutline className="text-2xl group-hover:hidden" />
                <span className="text-xxs  group-hover:font-semibold">Create</span>
              </div>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`${style.btn} ${pathname === '/nexus/company/job-box' ? 'bg-black/20 border-black/50 dark:border-white/20 border dark:bg-zinc-200/10' : ''}`} onClick={handleLinkClick} >
            <Link href='/nexus/company/job-box'>
              <div className='flex items-center w-fit h-fit gap-2'>
                <CiInboxIn className="text-2xl" />
                <span className="text-xxs  group-hover:font-semibold">Job Box</span>
              </div>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`${style.btn} ${pathname === '/nexus/company/job-ask' ? 'bg-black/20 border-black/50 dark:border-white/20 border  dark:bg-zinc-200/10' : ''}`} onClick={handleLinkClick} >
            <Link href='/nexus/company/job-ask'>
              <div className='flex items-center w-fit h-fit gap-2'>
                <SiGooglebigquery className="text-2xl" />
                <span className="text-xxs  group-hover:font-semibold">Job Ask</span>
              </div>
            </Link>
          </Button>
          <Button asChild variant="vegaThemeBtn" className={`${style.btn} ${pathname === '/conversations' ? 'bg-black/20 border-black/50 dark:border-white/20 border  dark:bg-zinc-200/10' : ''}`} onClick={handleLinkClick} >
            <Link href='/conversations'>
              <div className='flex items-center w-fit h-fit gap-2'>
                <TiMessages  className="text-2xl" />
                <span className="text-xxs  group-hover:font-semibold">Conversations</span>
              </div>
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