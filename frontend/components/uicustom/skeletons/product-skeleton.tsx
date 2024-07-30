import Image from 'next/image';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export default function ProductSkeleton() {
  return (
    <div className='w-full xs:w-[calc(100%-1rem)] flex flex-col'>
      <div className='lg:flex-row flex flex-col justify-start items-center xs:rounded-t-lg bg-white dark:bg-gray-800 animate-pulse'>
        <div className='relative flex flex-col w-full h-full max-w-[800px] xs:rounded-t-lg lg:rounded-tr-none overflow-hidden'>
          <div className="relative w-full aspect-w-1 aspect-h-1">
            <AspectRatio ratio={1 / 1}>
              <Image src="/loading.webp" alt="Loading..." sizes="100%" fill className="object-fill rounded" />
            </AspectRatio>
          </div>
        </div>
        <div className='flex flex-col w-fit p-8'>
          <div className='uppercase tracking-wide text-sm bg-slate-200 dark:bg-slate-700 rounded w-1/2 h-4 mb-2'></div>
          <div className='block mt-1 text-lg leading-tight font-medium bg-slate-200 dark:bg-slate-700 rounded w-3/4 h-6 mb-4'></div>
          <div className='mt-2 bg-slate-200 dark:bg-slate-700 rounded w-full h-20 mb-4'></div>
          <div className='mt-4 flex items-center'>
            <div className='text-yellow-500 h-5 w-5'>
              {/* Placeholder for Star Icon */}
            </div>
            <div className='ml-2 bg-slate-200 dark:bg-slate-700 rounded w-1/4 h-4'></div>
          </div>
          <div className='flex flex-wrap gap-2 mt-4'>
            <div className='bg-slate-200 dark:bg-slate-700 rounded w-24 h-8'></div>
            <div className='bg-slate-200 dark:bg-slate-700 rounded w-32 h-8'></div>
            <div className='bg-slate-200 dark:bg-slate-700 rounded w-28 h-8'></div>
            <div className='bg-slate-200 dark:bg-slate-700 rounded w-40 h-8'></div>
          </div>
        </div>
      </div>
      <div className='flex flex-col p-4 md:p-8 text-sm text-center sm:text-start bg-slate-100 dark:bg-gray-700 sm:rounded-b-lg'>
        <div className='mt-6'>
          <div className='text-lg font-semibold bg-slate-200 dark:bg-slate-700 rounded w-1/3 h-6 mb-4'></div>
          <dl className='mt-2 grid items-center grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 lg:mb-1'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className='flex flex-col'>
                <dt className='text-sm font-medium bg-slate-200 dark:bg-slate-700 rounded w-1/2 h-4 mb-2'></dt>
                <dd className='mt-1 text-sm bg-slate-200 dark:bg-slate-700 rounded w-3/4 h-4'></dd>
              </div>
            ))}
          </dl>
        </div>
        <div className='mt-6 border-t border-gray-200 dark:border-gray-700 p-6'>
          <div className='text-lg font-semibold bg-slate-200 dark:bg-slate-700 rounded w-1/3 h-6 mb-4'></div>
          <dl className='mt-2 pl-4'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className='py-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <dt className='text-sm font-medium bg-slate-200 dark:bg-slate-700 rounded w-1/3 h-4'></dt>
                <dd className='text-sm bg-slate-200 dark:bg-slate-700 rounded w-2/3 h-4'></dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}