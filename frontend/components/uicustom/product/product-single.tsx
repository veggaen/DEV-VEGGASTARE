import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Product as PrismaProduct} from "@prisma/client";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { StarIcon } from "lucide-react";
import Image from "next/image";

// Extending the Product type to include specifications as an array of objects
interface Specification {
    key: string;
    value: string;
}

interface Product extends Omit<PrismaProduct, 'specifications'> {
  specifications: Specification[];
}

export const MyProductSingle = ({ product }: { product: Product }) => {

  const formatDate = (dateInput: Date | string): string => {
      const date = new Date(dateInput);
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  
  return (
  <div className="w-full xs:w-[90%] flex flex-col bg-white dark:bg-gray-800 sm:rounded-lg shadow">
    <div className="lg:flex-row flex flex-col mb-1 hover:shadow-md transition-shadow duration-300">
      <div className="relative flex flex-col w-full rounded-tl-lg overflow-hidden">
        <Carousel>
          <CarouselContent>
            {product.image.map((image, idx) => (
              <CarouselItem key={idx}>
                <AspectRatio ratio={5 / 4}>
                  <Image src={image} alt={product.title} fill className="object-fill" />
                </AspectRatio>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
      <div className="flex flex-col w-fit p-8">
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
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="vegaBuyBtn" className="hover:shadow-md transition-shadow duration-300">Buy Now</Button>
          <Button variant="vegaAddBasketBtn" className="hover:shadow-md transition-shadow duration-300">Add to Basket</Button>
          <Button variant="vegaAddWishlistBtn" className="hover:shadow-md transition-shadow duration-300">Add to Wishlist</Button>
        </div>
      </div>
    </div>
    <div className="flex flex-col p-4 md:p-8 text-sm text-center sm:text-start bg-slate-100 dark:bg-gray-700 ">
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Specifications:</h3>
        <dl className="mt-2 grid items-center grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 lg:mb-1">
          {product.specifications?.map((spec, index) => (
          <div key={index} className="flex flex-col">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{spec.key}</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">{spec.value}</dd>
          </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 border-t border-gray-200 dark:border-gray-700 p-6">
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