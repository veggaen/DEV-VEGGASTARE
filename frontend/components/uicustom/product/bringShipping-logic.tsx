import React, { useState, useEffect } from 'react';
import { fetchBringShippingDetails } from '@/lib/fetch-bring-shipping-details';
import MyShippingDetailsDisplay from './bring-shipping-details-display';

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

// Update the MyBringShippingLogicProps interface to use ShippingRequestData
interface MyBringShippingLogicProps {
    shippingDetailsFromUser: ShippingRequestData; // Now using the detailed type
}

const LOG_PREFIX = '[frontend/components/uicustom/product/bringShipping-logic.tsx]'
export const MyBringShippingLogic: React.FC<MyBringShippingLogicProps> = ({ shippingDetailsFromUser }) => {
  const [shippingResponse, setShippingResponse] = useState<ShippingDetails | null>(null);
  const [error, setError] = useState<string>('');

  const fetchData = async () => {
    try {
        console.log(LOG_PREFIX,' try fetchBringShippingDetails')
      if (shippingDetailsFromUser !== null) {
        const response = await fetchBringShippingDetails(shippingDetailsFromUser);
        setShippingResponse(response);
      }
    } catch (error) {
      setError('Failed to fetch shipping details');
    }
  };

  if (shippingDetailsFromUser.toPostalCode !== '') {
    if (!shippingResponse){
      fetchData()
    }
  }

  if (error) {
    return <div>Error loading shipping details</div>;
  }

  return (
    <div>
      {shippingResponse ? (
        <div>
            <MyShippingDetailsDisplay shippingResponse={shippingResponse} />
            {/* <h1 className='text-green-500'>{JSON.stringify(shippingResponse)}</h1> */}
        </div>
        
      ) : (
        <div>Loading shipping details.</div>
      )}
    </div>
  );
};