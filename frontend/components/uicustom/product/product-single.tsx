import { AspectRatio } from "@/components/ui/aspect-ratio";
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
    <div className="lg:flex">
        {/* part two */}
      <div className={`flex justify-center bg-black/20`}>
        <div className='md:rounded overflow-hidden'>
          <Carousel>
            <CarouselContent className="-ml-2 md:-ml-4">
              {product.image.map((image, index) => (
  
                  <CarouselItem className="pl-2 md:pl-4" key={index}>
                      {/* <AspectRatio ratio={3 / 2}> | 800 ✕ 600 | 1024 ✕ 768 | */}
                      <Image src={image} alt={product.title} width={800} height={600} className='rounded' />
                      {/* </AspectRatio> */}
  
                  </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </div>
        {/* part three */}
      <div className='w-full flex justify-center bg-slate-200 dark:bg-slate-800'>
        <div className='flex flex-col p-2 w-full max-w-[1280px]'>
          {/* <div className='hidden md:flex justify-between w-full py-2 px-4'>
            <h1 className='text-2xl font-bold text-pretty capitalize'>{product.title}</h1>
            <p className='text-xl'> <StarFilledIcon className="h-4 w-4 text-black/50 dark:text-white/50"/></p>
          </div> */}
          <div className='h-full flex flex-col justify-between bg-slate-300 dark:bg-slate-700 border dark:border-slate-900 rounded-lg py-2 px-4'>
            <div className='flex flex-col gap-2 justify-center items-center'>
              <div className='flex justify-between w-full bg-slate-100/50 dark:bg-slate-900/50 py-2 px-4 pr-2 rounded-lg'>
                <h1 className='text-lg font-bold py-1 px-2'>Price:</h1>
                <h1 className='text- text-center font-mono tracking-tighter italic bg-emerald-500/50 min-w-32 py-1 px-2 rounded-lg'>
                  {product.price}$
                </h1>
              </div>
              <div className="flex gap-2 justify-between">
                <div className='italic font-semibold bg-slate-100/50 dark:bg-slate-900/50 py-1 px-2 rounded-lg text-pretty'>
                <h1 className='font-bold text-md'>Description: </h1>
                  {product.description}
                </div>
              </div>
              <div className="flex gap-2 justify-between w-full">
                <div className='font-bold text-md'>
                  <div className="capitalize h-full bg-slate-100/50 dark:bg-slate-900/50 py-1 px-2 rounded-lg text-xs text-nowrap">
                  <h1 className='font-bold text-md'>Category:</h1>
                    •{product.category}
                  <div className="flex justify-between md:w-1/5">
                    <p className=''>Availability:</p>
                    <div className='tracking-tighter whitespace-normal'>
                      {product.stock >= 1 ? `${product.stock} in stock ` : `${product.stock} not in stock!`}
                    </div>
                  </div>
                  </div>
                </div>
                <div className='italic w-full font-semibold bg-slate-100/50 dark:bg-slate-900/50 py-1 px-2 rounded-lg'>
                <h1 className='font-bold text-md'>Specifications: </h1>
                  {Array.isArray(product.specifications) && product.specifications.length > 0 ? (
                      <ul className="">
                      {product.specifications.map((spec, index) => (typeof spec === 'object' && spec && Array.isArray(Object.keys(spec)) && Array.isArray(Object.values(spec)) && (
                      <li className="" key={index}>• {`${Object.values(spec)[0]}: ${Object.values(spec)[1]}`}</li>
                      )))}
                    </ul>
                    ) : (
                      <p>No specifications provided</p>
                    )
                  }
                </div>
              </div>
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
    </div>
      {/* part four */}
    <div className='flex flex-col w-full items-center md:justify-center md:gap-3 text-xs text-nowrap text-ellipsis pt-2 px-2'>

          <div className="flex justify-between md:w-1/5">
            <p className=''>ProductID:</p>
            <div className='tracking-tighter'>
              {product.id}
            </div>
          </div>

          {/* <div className="flex justify-between md:w-1/5">
            <p className=''>Availability:</p>
            <div className='tracking-tighter'>
              {product.stock >= 1 ? product.stock : 'No more products left.'}
            </div>
          </div> */}
        
          <div className="flex justify-between md:w-1/5">
            <p className=''>Updated At:</p>
            <div className='tracking-tighter'>
              {formatDate(product.updatedAt.toISOString())}
            </div>
          </div>
          <div className="flex justify-between md:w-1/5">
            <p className=''>Created At:</p>
            <div className='tracking-tighter'>
              {formatDate(product.createdAt.toISOString())}
            </div>
          </div>
        
    </div>
  </div>
  )
}