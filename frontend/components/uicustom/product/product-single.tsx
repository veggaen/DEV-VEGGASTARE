'use client';

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Product as PrismaProduct, Inventory, WarehouseLocation as PrismaWarehouseLocation } from "@prisma/client";
import { StarIcon } from "lucide-react";
import Image from "next/image";
import { BringShippingDetails } from "./bringShipping-details";
import { useEffect, useState, useCallback } from "react";
import { fetchPostalCodeFromCoords } from "./postal-code-from-coords";
import { getCountryCode, haversineDistance } from "@/lib/utils";
import { fetchCoordsFromPostalCode } from "./postal-cords-from-code";

interface Specification {
  key: string;
  value: string;
}

interface WarehouseLocation extends Omit<PrismaWarehouseLocation, 'createdAt' | 'updatedAt'> {
  countryCode?: string;
}

interface Product extends Omit<PrismaProduct, 'specifications'> {
  specifications?: Specification[] | null;
  company: {
    warehouseLocations: WarehouseLocation[];
  };
  inventory: Inventory[];
}

const parseWarehouseLocations = (locations: WarehouseLocation[] = []): WarehouseLocation[] => {
  return locations.map((location) => {
    const countryCode = getCountryCode(location.country);
    return { ...location, countryCode };
  });
};

export const MyProductSingle = ({ product }: { product: Product }) => {
  const [userPostalCode, setUserPostalCode] = useState<string | null>(null);
  const [closestWarehouse, setClosestWarehouse] = useState<WarehouseLocation | null>(null);
  const [hasFetchedLocation, setHasFetchedLocation] = useState<boolean>(false);

  const warehouseLocations = parseWarehouseLocations(product.company.warehouseLocations || []);

  const requestLocationAndPostalCode = useCallback(async () => {
    if (warehouseLocations.length > 0 && !hasFetchedLocation) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const postalCode = await fetchPostalCodeFromCoords(latitude, longitude);
            setUserPostalCode(postalCode);

            const userCoords = { latitude, longitude };
            let closestLocation = warehouseLocations[0];
            let minDistance = Number.MAX_VALUE;

            for (const warehouse of warehouseLocations) {
              const coords = await fetchCoordsFromPostalCode(warehouse.postalCode, warehouse.countryCode || 'NO');
              if (coords) {
                const distance = haversineDistance(userCoords.latitude, userCoords.longitude, coords.latitude, coords.longitude);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestLocation = warehouse;
                }
              }
            }
            setClosestWarehouse(closestLocation);
            setHasFetchedLocation(true);
          } catch (error) {
            console.error('Error fetching postal code:', error);
            alert('Unable to retrieve postal code for your location.');
          }
        }, (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to retrieve your location.');
        });
      } else {
        alert('Geolocation is not supported by this browser.');
      }
    }
  }, [warehouseLocations, hasFetchedLocation]);

  useEffect(() => {
    console.log("Executing useEffect for location fetching.");
    requestLocationAndPostalCode();
  }, [requestLocationAndPostalCode]);

  const formatDate = (dateInput: Date | string): string => {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  let transformedSpecifications = { length: 0, width: 0, height: 0, grossWeight: 0 };

  if (product.specifications) {
    product.specifications.forEach(spec => {
      const value = parseFloat(spec.value);

      if (spec.key === 'Length') transformedSpecifications.length = value;
      if (spec.key === 'Width') transformedSpecifications.width = value;
      if (spec.key === 'Height') transformedSpecifications.height = value;
      if (spec.key === 'Weight') transformedSpecifications.grossWeight = value;
    });
  }

  const totalStock = product.inventory.reduce((total, item) => total + item.stock, 0);

  const getStockFromClosestWarehouse = (): number => {
    if (closestWarehouse) {
      const inventoryItem = product.inventory.find(item => item.warehouseId === closestWarehouse.id);
      return inventoryItem ? inventoryItem.stock : 0;
    }
    return 0;
  };

  const availableStock = getStockFromClosestWarehouse();

  return (
    <div className="w-full xs:w-[90%] flex flex-col">
      <div className="lg:flex-row flex flex-col xs:rounded-t-lg bg-white dark:bg-gray-800">
        <div className="relative flex flex-col w-full h-full max-w-[800px] xs:rounded-t-lg lg:rounded-tr-none overflow-hidden">
          <Carousel>
            <CarouselContent>
              {product.image.map((image, idx) => (
                <CarouselItem key={idx} className="bg-transparent">
                  <AspectRatio ratio={5 / 4}>
                    <Image src={image} priority alt={product.title} fill className="object-fill" />
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
            {userPostalCode && closestWarehouse && <BringShippingDetails 
              fromPostalCode={closestWarehouse.postalCode} // Closest warehouse postal code
              toPostalCode={userPostalCode} // User postal code
              productSpecifications={transformedSpecifications}
            />}
          </div>
        </div>
      </div>
      <div className="flex flex-col p-4 md:p-8 text-sm text-center sm:text-start bg-slate-100 dark:bg-gray-700 sm:rounded-b-lg">
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Specifications:</h3>
          <dl className="mt-2 grid items-center grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 lg:mb-1">
            {product.specifications?.map((spec, index) => (
              <div key={index} className="flex flex-col">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{spec.key}</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">{spec.value} {spec.key === 'Weight' && 'g'} {['Height', 'Length', 'Width'].includes(spec.key) && 'cm'}</dd>
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
              <dd className="text-sm text-gray-900 dark:text-gray-200">{availableStock > 0 ? `${availableStock} in stock at closest warehouse` : 'Out of stock at closest warehouse'}</dd>
            </div>
            <div className="py-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall Availability:</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-200">{totalStock} in stock</dd>
            </div>
            <div className="py-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Shipping from:</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-200">{closestWarehouse?.postalCode}</dd>
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
  );
};