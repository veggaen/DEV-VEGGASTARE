import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Product } from "@prisma/client";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { StarIcon } from "lucide-react";
import Image from "next/image";

export const MyProductSingle = ({ product }: { product: Product }) => {

  const formatDate = (dateString: string) => {
  const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  
  return (
    <div className={`MyProductSingle w-full`}>
      {/* part one */}
      <div className='flex justify-between items-center md:flex-col md:justify-center py-1 px-2 p-4'>
          <h1 className='text-xl font-bold capitalize'>{product.title}</h1>
          <div className='md:flex items-center md:gap-2'>
            <p className='text-xs text-nowrap capitalize'>{product.category}</p>
            <p className='hidden md:block font-semibold'>|</p>
            <p className='text-xs text-nowrap text-end'>Price: {product.price}$</p>
          </div>
      </div>
      <div className={`flex justify-center bg-black/20`}>
        <div className='md:rounded overflow-hidden'>
          <Carousel>
            <CarouselContent className="-ml-2 md:-ml-4">
              {product.image.map((image, index) => {
                return (
                  <CarouselItem className="pl-2 md:pl-4" key={index}>
                    <Image src={image} alt={product.title} width={640} height={480} />
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </div>

      {/* part two */}
    <div className='w-full flex justify-center bg-slate-200 dark:bg-slate-800'>
      <div className='flex flex-col p-2 w-full max-w-[1280px]'>
        {/* <div className='hidden md:flex justify-between w-full py-2 px-4'>
          <h1 className='text-2xl font-bold text-pretty capitalize'>{product.title}</h1>
          <p className='text-xl'> <StarFilledIcon className="h-4 w-4 text-black/50 dark:text-white/50"/></p>
        </div> */}
        <div className=' bg-slate-300 dark:bg-slate-700 py-1 px-2'>
          <div className='flex flex-col justify-center items-start py-2 pr-4'>
            <div className='flex justify-between w-full'>
              <h1 className='text-lg font-bold'>Price:</h1>
              <h1 className='text-lg font-mono tracking-tighter italic bg-emerald-500/50 py-1 px-2 rounded-lg'>{product.price} $</h1>
            </div>
            <div className="flex flex-col gap-2 justify-between">
              <p className='font-bold text-md'>Description: </p>
              <p className='italic font-semibold bg-slate-100/50 dark:bg-slate-900/50 py-1 px-2 rounded text-pretty'>{product.description}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 justify-between">
            <div className='font-bold text-md'>Category: <p className="capitalize">{product.category}</p></div>
            <p className='font-bold text-md'>Specifications: </p>
            <p className='italic font-semibold bg-slate-100/50 dark:bg-slate-900/50 py-1 px-2 rounded'>
              {Array.isArray(product.specifications) && product.specifications.length > 0 ? (
                <ul className="">
                  {product.specifications.map((spec, index) => (
                  typeof spec === 'object' && spec && Array.isArray(Object.keys(spec)) && Array.isArray(Object.values(spec)) && (
                    <li className="" key={index}>• {`${Object.values(spec)[0]}: ${Object.values(spec)[1]}`}</li>
                  )
                  ))}
                </ul>
                ) : (
                <p>No specifications provided</p>
              )}
            </p>
          </div>
          <div className='w-full mt-5'>
              <Button variant={'vegaBuyBtn'} className={`w-full`}>Buy</Button>
              <div className='flex justify-end py-2 w-full gap-3'>
              <Button variant={'vegaAddBasketBtn'} className={`w-full`}>Add to Basket</Button>
              <Button variant={'vegaAddWishlistBtn'} className={`w-full`}>Add to Wishlist</Button>
              </div>
          </div>
        </div>
      </div>
    </div>

    <div className='flex flex-col w-full items-center md:justify-between text-xs text-nowrap text-ellipsis py-4 px-2'>
        <div className="flex justify-between md:w-1/5">
          <p className=''>ProductID:</p>
          <span className='tracking-tighter'>{product.id}</span>
        </div>
        <div className="flex justify-between md:w-1/5">
          <p className=''>Availability:</p>
          <span className='tracking-tighter'>{product.stock >= 1 ? product.stock : 'No more products left.'}</span>
        </div>
        <div className="flex justify-between md:w-1/5">
          <p className=''>Updated At:</p>
          <span className='tracking-tighter'>{formatDate(product.updatedAt.toISOString())}</span>
        </div>
        <div className="flex justify-between md:w-1/5">
          <p className=''>Created At:</p>
          <span className='tracking-tighter'>{formatDate(product.createdAt.toISOString())}</span>
        </div>
    </div>
    </div>
  )
}