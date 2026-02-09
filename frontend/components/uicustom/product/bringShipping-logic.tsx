import React, { useState, useEffect } from 'react';
import { fetchBringShippingDetails, ShippingError } from '@/lib/fetch-bring-shipping-details';
import MyShippingDetailsDisplay from './bring-shipping-details-display';
import { FiAlertTriangle, FiWifiOff, FiRefreshCw, FiServer } from 'react-icons/fi';

// Define the structure of the shipping details response
interface GuiInformation {
  sortOrder: string;
  mainDisplayCategory: string;
  subDisplayCategory: string;
  trackable: boolean;
  logo: string;
  logoUrl: string;
  displayName: string;
  productName: string;
  descriptionText: string;
  helpText: string;
  shortName: string;
  productURL: string;
  deliveryType: string;
  maxWeightInKgs: string;
  closestPickupPoint: string;
}

interface PriceInfo {
  amountWithoutVAT: string;
  vat: string;
  amountWithVAT: string;
  currencyCode: string;
}

interface ListPrice {
  priceWithoutAdditionalServices: PriceInfo;
  priceWithAdditionalServices: PriceInfo;
}

interface Product {
  id: string;
  productionCode: string;
  shippingWeight: number;
  guiInformation: GuiInformation;
  price: {
    listPrice: ListPrice;
    zones: {
      totalZoneCount: number;
    };
  };
}

interface Consignment {
  products: Product[];
  consignmentId: string;
}

// Main interface for the shipping details response BRING API
export interface ShippingDetails {
  traceMessages: any[]; // Specify more detailed type if needed
  consignments: Consignment[];
  uniqueId: string;
}

// Define the structure of the package specifications BRING API
interface PackageSpecification {
    length: number;
    width: number;
    height: number;
    grossWeight: number;
}

// Define the structure for the request data being sent to fetchBringShippingDetails
interface ShippingRequestData {
    fromPostalCode: string;
    toPostalCode: string;
    packages: PackageSpecification[]; // Assuming it's an array of package specifications
}

interface WarehouseInfo {
  postalCode: string;
  city?: string;
  address?: string;
  distanceKm?: number;
}

// Update the MyBringShippingLogicProps interface to use ShippingRequestData
interface MyBringShippingLogicProps {
    shippingDetailsFromUser: ShippingRequestData; // Now using the detailed type
    toPostalCode: string;
    /** Warehouse details for local pickup option */
    warehouse?: WarehouseInfo;
    /** User's distance from warehouse in km */
    userDistanceKm?: number;
}

interface ShippingErrorState {
  code: string;
  message: string;
}

const LOG_PREFIX = '[frontend/components/uicustom/product/bringShipping-logic.tsx]'
export const MyBringShippingLogic: React.FC<MyBringShippingLogicProps> = ({ shippingDetailsFromUser, toPostalCode, warehouse, userDistanceKm }) => {
  const [shippingResponse, setShippingResponse] = useState<ShippingDetails | null>(null);
  const [error, setError] = useState<ShippingErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchShipping = async () => {
    try {
      if (!shippingDetailsFromUser?.toPostalCode) return;
      setError(null);
      setShippingResponse(null);
      setIsLoading(true);

      console.log(LOG_PREFIX, 'fetchBringShippingDetails()', shippingDetailsFromUser);
      const response = await fetchBringShippingDetails(shippingDetailsFromUser);
      setShippingResponse(response);
    } catch (e) {
      if (e instanceof ShippingError) {
        setError({ code: e.code, message: e.message });
      } else {
        const message = e instanceof Error ? e.message : 'Failed to fetch shipping details';
        setError({ code: 'UNKNOWN_ERROR', message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShipping();
  }, [shippingDetailsFromUser, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          {error.code === 'BACKEND_UNAVAILABLE' ? (
            <FiServer className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : error.code === 'NETWORK_ERROR' ? (
            <FiWifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <FiAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {error.code === 'BACKEND_UNAVAILABLE' 
                ? 'Shipping Service Unavailable'
                : error.code === 'NETWORK_ERROR'
                  ? 'Connection Error'
                  : 'Unable to Load Shipping'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
              {error.message}
            </p>
            <button
              onClick={handleRetry}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
            >
              <FiRefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-3">
        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        Calculating shipping options...
      </div>
    );
  }

  return (
    <div>
      {shippingResponse ? (
        <MyShippingDetailsDisplay 
          shippingResponse={shippingResponse} 
          toPostalCode={toPostalCode}
          warehouse={warehouse}
          userDistanceKm={userDistanceKm}
        />
      ) : (
        <div className="text-sm text-muted-foreground">
          Enter your postal code to see shipping options
        </div>
      )}
    </div>
  );
};