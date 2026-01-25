import Image from 'next/image';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { HiOutlineCog6Tooth } from "react-icons/hi2";

export default function ProductsSkeleton() {
  const placeholderItems = Array.from({ length: 10 });

  return (
    <div className="w-full space-y-4">
      <div className='flex flex-col justify-center items-center'>
      </div>
      <div className="grid py-6 px-2 md:px-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {placeholderItems.map((_, idx) => (
          <div key={idx} className="flex flex-col rounded overflow-hidden p-2 bg-white dark:bg-gray-800 animate-pulse">
            <div className="relative w-full aspect-w-1 aspect-h-1">
              <AspectRatio ratio={1 / 1}>
                <Image src="/loading.webp" alt="Loading..." sizes="100%" width={500} height={500} className="object-fill rounded" />
              </AspectRatio>
            </div>
            <div className="p-2 pt-4 flex flex-col justify-between flex-grow">
              <div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6 mb-1"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
              </div>
              <div className="flex justify-between items-center my-2 sm:mt-4 gap-2">
                <HiOutlineCog6Tooth className="h-5 w-5 text-gray-500" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
              </div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}