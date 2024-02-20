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
  <div className="sm:w-[90%] bg-white dark:bg-gray-800 sm:rounded-lg shadow overflow-hidden">
    <div className="lg:flex">
      <div className="md:flex-shrink-0">
        <Carousel>
          <CarouselContent>
            {product.image.map((image, index) => (
              <CarouselItem key={index} className="relative h-[24rem] w-[12rem] md:h-[27rem] md:w-[14rem] object-cover">
                <AspectRatio ratio={3 / 2}>
                <Image src={image} alt={product.title} layout="fill" objectFit="cover" />
                </AspectRatio>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
      <div className="p-8">
        <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">{product.category}</div>
        <a href="#" className="block mt-1 text-lg leading-tight font-medium text-black hover:underline">{product.title}</a>
        <p className="mt-2 text-gray-500">{product.description}</p>
        <div className="mt-4">
          <div className="flex items-center">
            <StarIcon className="text-yellow-500 h-5 w-5" />
            {/* Future rating component */}
          </div>
          <span className="ml-2">{product.price}$</span>
        </div>
        <div className="flex mt-4">
          <Button variant="vegaBuyBtn">Buy Now</Button>
          <Button variant="vegaAddBasketBtn" className="ml-2">Add to Basket</Button>
          <Button variant="vegaAddWishlistBtn" className="ml-2">Add to Wishlist</Button>
        </div>
      </div>
    </div>
    <div className="flex flex-col p-4 md:p-8 text-sm text-center sm:text-start bg-slate-100 dark:bg-gray-700">
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Specifications:</h3>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
          {product.specifications?.map((spec, index) => (
          <div key={index} className="flex flex-col">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{spec.key}</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">{spec.value}</dd>
          </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 border-t bg-slate-200 dark:bg-gray-600 border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Additional Information:</h3>
        <dl className="mt-2 pl-4">
          <div className="py-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Product ID:</dt>
          <dd className="text-sm text-gray-900 dark:text-gray-200">{product.id}</dd>
          </div>
          <div className="py-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Availability:</dt>
          <dd className="text-sm text-gray-900 dark:text-gray-200">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</dd>
          </div>
          <div className="py-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Updated At:</dt>
          <dd className="text-sm text-gray-900 dark:text-gray-200">{formatDate(product.updatedAt)}</dd>
          </div>
          <div className="py-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created At:</dt>
          <dd className="text-sm text-gray-900 dark:text-gray-200">{formatDate(product.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
  )
}