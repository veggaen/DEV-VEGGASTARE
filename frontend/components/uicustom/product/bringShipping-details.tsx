'use client';

import React, { useMemo, useState } from 'react';
import { MyBringShippingLogic } from './bringShipping-logic';
import { BringShippingRequestBody } from '@/app/api/bring-shipping/route';


interface ProductSpecifications {
  length: number;
  width: number;
  height: number;
  grossWeight: number;
}

interface WarehouseInfo {
  postalCode: string;
  city?: string;
  address?: string;
  distanceKm?: number; // Distance from user to warehouse
}

interface BringShippingDetailsProps {
  fromPostalCode: string;
  toPostalCode: string;
  productSpecifications: ProductSpecifications;
  /** Warehouse details for local pickup option */
  warehouse?: WarehouseInfo;
  /** User's distance from warehouse in km (for showing local pickup) */
  userDistanceKm?: number;
}

const LOG_PREFIX = '[frontend/components/uicustom/product/bringShipping-details.tsx]'
export const BringShippingDetails: React.FC<BringShippingDetailsProps> = ({
  fromPostalCode,
  toPostalCode,
  productSpecifications,
  warehouse,
  userDistanceKm,
}) => {
const shippingDetailsFromUser = useMemo(() => ({
  fromPostalCode,
  toPostalCode,
  packages: [productSpecifications],
}), [fromPostalCode, toPostalCode, productSpecifications]);
const [shippingResFromAPI, setShippingResFromAPI] = useState< BringShippingRequestBody | null>(null);

  return (
    <div>
      <MyBringShippingLogic 
        shippingDetailsFromUser={shippingDetailsFromUser} 
        toPostalCode={toPostalCode}
        warehouse={warehouse}
        userDistanceKm={userDistanceKm}
      />
    </div>
  );
};