'use client';

import React, { useState, useEffect } from 'react';
import { MyBringShippingLogic } from './bringShipping-logic';
import { BringShippingRequestBody } from '@/app/api/bring-shipping/route';


interface ProductSpecifications {
  length: number;
  width: number;
  height: number;
  grossWeight: number;
}

interface BringShippingDetailsProps {
  fromPostalCode: string;
  toPostalCode: string;
  productSpecifications: ProductSpecifications;
}

const LOG_PREFIX = '[frontend/components/uicustom/product/bringShipping-details.tsx]'
export const BringShippingDetails: React.FC<BringShippingDetailsProps> = ({
  fromPostalCode,
  toPostalCode,
  productSpecifications,
}) => {
const [shippingDetailsFromUser, setShippingDetailsFromUser] = useState<{ fromPostalCode: string; toPostalCode: string; packages: ProductSpecifications[]; } | null>(null);
const [shippingResFromAPI, setShippingResFromAPI] = useState< BringShippingRequestBody | null>(null);

useEffect(() => {
    console.log(LOG_PREFIX,'useEffect() bringShipping-details.tsx toPostalCode:', toPostalCode)
    const shippingData = {
        fromPostalCode,
        toPostalCode,
        packages: [productSpecifications],
    };
    setShippingDetailsFromUser(shippingData);
}, [fromPostalCode, toPostalCode, productSpecifications]);

if (!shippingDetailsFromUser) {
    return <div className="text-center text-gray-500 dark:text-gray-500">Loading shipping details...</div>;
}

  return (
    <div>
      <MyBringShippingLogic shippingDetailsFromUser={shippingDetailsFromUser} />
    </div>
  );
};