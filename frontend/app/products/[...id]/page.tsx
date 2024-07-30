'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { StarIcon } from 'lucide-react';
import Image from 'next/image';
import { BringShippingDetails } from '@/components/uicustom/product/bringShipping-details';
import { fetchPostalCodeFromCoords } from '@/components/uicustom/product/postal-code-from-coords';
import { getCountryCode, haversineDistance } from '@/lib/utils';
import { fetchCoordsFromPostalCode } from '@/components/uicustom/product/postal-cords-from-code';
import ProductSkeleton from '@/components/uicustom/skeletons/product-skeleton';

interface Specification {
  key: string;
  value: string;
}

interface WarehouseLocation {
  id: string;
  country: string;
  postalCode: string;
  countryCode?: string;
}

interface Inventory {
  id: string;
  stock: number;
  warehouseId: string;
}

interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  image: string[];
  specifications: Specification[] | null;
  company: {
    warehouseLocations: WarehouseLocation[] | null;
  } | null;
  inventory: Inventory[];
  shipFromPostalId: string;
  updatedAt: string;
  createdAt: string;
}

const parseWarehouseLocations = (locations: WarehouseLocation[] = []): WarehouseLocation[] => {
  return locations.map((location) => {
    const countryCode = getCountryCode(location.country);
    return { ...location, countryCode };
  });
};

const ProductPage = ({ params }: { params: { id: string[] } }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const uid = params.id[0];
      try {
        console.log(`Fetching product with ID: ${uid}`);
        const response = await fetch(`/api/products/${uid}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch product: ${response.statusText}`);
        }
        const data: Product | null = await response.json();
        console.log('Product data:', data);
        setProduct(data);
      } catch (error) {
        console.error('Error fetching product:', error);
        setError('Product not found');
        setProduct(null);
      }
    };

    fetchData();
  }, [params.id]);

  if (error) return <p>{error}</p>;
  if (!product) return <ProductSkeleton />;

  return <ProductDetails product={product} />;
};

const ProductDetails = ({ product }: { product: Product }) => {
  const [userPostalCode, setUserPostalCode] = useState<string | null>(null);
  const [closestWarehouse, setClosestWarehouse] = useState<WarehouseLocation | null>(null);
  const [hasFetchedLocation, setHasFetchedLocation] = useState<boolean>(false);
  const [showShippingDetails, setShowShippingDetails] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const warehouseLocations = useMemo(() => {
    if (product.company?.warehouseLocations && product.company.warehouseLocations.length > 0) {
      return parseWarehouseLocations(product.company.warehouseLocations);
    } else if (product.shipFromPostalId) {
      return [{
        id: product.id,
        country: 'Norway',  // Assuming Norway, you might need to adjust this
        postalCode: product.shipFromPostalId,
        countryCode: 'NO'   // Assuming Norway, you might need to adjust this
      }];
    } else {
      return [];
    }
  }, [product.company?.warehouseLocations, product.shipFromPostalId, product.id]);

  const requestLocationAndPostalCode = useCallback(async () => {
    if (warehouseLocations.length > 0 && !hasFetchedLocation) {
      if ('geolocation' in navigator) {
        console.log('Geolocation is available.');
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          console.log('User coordinates:', { latitude, longitude });
          try {
            console.log('Fetching postal code from coordinates...');
            const postalCode = await fetchPostalCodeFromCoords(latitude, longitude);
            console.log('User postal code:', postalCode);
            setUserPostalCode(postalCode);

            const userCoords = { latitude, longitude };
            let closestLocation = warehouseLocations[0];
            let minDistance = Number.MAX_VALUE;

            for (const warehouse of warehouseLocations) {
              console.log(`Fetching coordinates for warehouse with postal code: ${warehouse.postalCode}`);
              const coords = await fetchCoordsFromPostalCode(warehouse.postalCode, warehouse.countryCode || 'NO');
              if (coords) {
                const distance = haversineDistance(userCoords.latitude, userCoords.longitude, coords.latitude, coords.longitude);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestLocation = warehouse;
                }
              }
            }
            console.log('Closest warehouse:', closestLocation);
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
        console.error('Geolocation is not supported by this browser.');
        alert('Geolocation is not supported by this browser.');
      }
    }
  }, [warehouseLocations, hasFetchedLocation]);

  const handleGetShippingDetails = () => {
    setIsLoading(true);
    requestLocationAndPostalCode().then(() => {
      setShowShippingDetails(true);
      setIsLoading(false);
    });
  };

  const formatDate = (dateInput: Date | string): string => {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  let transformedSpecifications = { length: 0, width: 0, height: 0, grossWeight: 0 };

  if (product.specifications) {
    product.specifications.forEach((spec) => {
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
      const inventoryItem = product.inventory.find((item) => item.warehouseId === closestWarehouse.id);
      return inventoryItem ? inventoryItem.stock : 0;
    }
    return 0;
  };

  const availableStock = getStockFromClosestWarehouse();

  // Add logging to check the values of userPostalCode and closestWarehouse
  useEffect(() => {
    console.log('User postal code:', userPostalCode);
    console.log('Closest warehouse:', closestWarehouse);
  }, [userPostalCode, closestWarehouse]);

  return (
    <div className='w-full xs:w-[calc(100%-1rem)]'>
      <div className='lg:flex-row flex flex-col justify-center items-center xs:rounded-t-lg bg-white dark:bg-gray-800'>
        <div className='relative flex flex-col w-full h-full max-w-[800px] xs:rounded-t-lg lg:rounded-tr-none overflow-hidden'>
          <Carousel>
            <CarouselContent>
              {product.image.map((image, idx) => (
                <CarouselItem key={idx} className='bg-transparent'>
                  <AspectRatio ratio={1 / 1}>
                    <Image src={image} alt={product.title} sizes="100%" fill priority={idx === 0} className="object-fill rounded" />
                  </AspectRatio>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
        <div className='flex flex-col w-fit p-8'>
          <div className='uppercase tracking-wide text-sm text-indigo-500 font-semibold'>{product.category}</div>
          <a href='#' className='block mt-1 text-lg leading-tight font-medium text-black hover:underline'>{product.title}</a>
          <p className='mt-2 text-gray-500'>{product.description}</p>
          <div className='mt-4'>
            <div className='flex items-center'>
              <StarIcon className='text-yellow-500 h-5 w-5' />
              {/* Future rating component */}
            </div>
            <span className='ml-2'>{product.price}$</span>
          </div>
          <div className='flex flex-wrap gap-2 mt-4'>
            <Button variant='vegaBuyBtn' className='hover:shadow-md transition-shadow duration-300'>Buy Now</Button>
            <Button variant='vegaAddBasketBtn' className='hover:shadow-md transition-shadow duration-300'>Add to Basket</Button>
            <Button variant='vegaAddWishlistBtn' className='hover:shadow-md transition-shadow duration-300'>Add to Wishlist</Button>
            {!showShippingDetails && (
              <Button onClick={handleGetShippingDetails} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Get Shipping Details'}
              </Button>
            )}
            {showShippingDetails && userPostalCode && closestWarehouse && (
              <BringShippingDetails
                fromPostalCode={closestWarehouse.postalCode} // Closest warehouse postal code
                toPostalCode={userPostalCode} // User postal code
                productSpecifications={transformedSpecifications}
              />
            )}
          </div>
        </div>
      </div>
      <div className='flex flex-col p-4 md:p-8 mb-[1rem] text-sm text-center sm:text-start bg-slate-100 dark:bg-gray-700 sm:rounded-b-lg'>
        <div className='mt-6'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white'>Specifications:</h3>
          <dl className='mt-2 grid items-center grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 lg:mb-1'>
            {product.specifications?.map((spec, index) => (
              <div key={index} className='flex flex-col'>
                <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>{spec.key}</dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-200'>
                  {spec.value} {spec.key === 'Weight' && 'g'} {['Height', 'Length', 'Width'].includes(spec.key) && 'cm'}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className='mt-6 border-t border-gray-200 dark:border-gray-700 p-6'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white'>Additional Information:</h3>
          <dl className='mt-2 pl-4'>
            <div className='py-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>Product ID:</dt>
              <dd className='text-sm text-gray-900 dark:text-gray-200'>{product.id}</dd>
            </div>
            <div className='py-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>Availability:</dt>
              <dd className='text-sm text-gray-900 dark:text-gray-200'>
                {availableStock > 0 ? `${availableStock} in stock at closest warehouse` : 'Out of stock at closest warehouse'}
              </dd>
            </div>
            <div className='py-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>Overall Availability:</dt>
              <dd className='text-sm text-gray-900 dark:text-gray-200'>{totalStock} in stock</dd>
            </div>
            <div className='py-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>Shipping from:</dt>
              <dd className='text-sm text-gray-900 dark:text-gray-200'>{closestWarehouse?.postalCode}</dd>
            </div>
            <div className='py-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>Updated At:</dt>
              <dd className='text-sm text-gray-900 dark:text-gray-200'>{formatDate(product.updatedAt)}</dd>
            </div>
            <div className='py-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>Created At:</dt>
              <dd className='text-sm text-gray-900 dark:text-gray-200'>{formatDate(product.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;