'use client'

import Image from 'next/image';
import React, { useEffect } from 'react';

const MyShippingDetailsDisplay = ({ shippingResponse }: any) => {
    const consignments = shippingResponse?.consignments || [];

    return (
      <div className="w-fit bg-gray-200 dark:bg-gray-900 shadow-lg rounded-lg">
        {consignments.length > 0 ? (
          consignments.map((consignment: any, index: number) => (
            <div key={index} className="mb-6">
              {consignment.products.map((product: any, prodIndex: number) => (
                <div key={prodIndex} className="p-4 border-b last:border-b-0">
                  <div className="flex items-center space-x-4 mb-2">
                    <Image src={product.guiInformation.logoUrl} alt="Shipping Logo" width={50} height={50} className="rounded-full" />
                    <h4 className="text-lg font-semibold">{product.guiInformation.displayName}</h4>
                  </div>
                  <p className="text-gray-600">{product.guiInformation.descriptionText}</p>
                  <span className="font-semibold text-xs mr-2">Pickup Point:</span>
                  <span className="italic text-xs">{product.guiInformation.closestPickupPoint}</span>
                  <br />
                  <span className="font-semibold text-xs mr-2">Price:</span>
                  <span className='italic text-xs'>{product.price.listPrice.priceWithAdditionalServices.amountWithVAT} {product.price.listPrice.currencyCode} </span>

                  <div className="hidden  grid-cols-2 gap-4 text-sm mt-4">
                    <span className="font-semibold">Weight:</span>
                    <span>{product.shippingWeight} kg</span>
                    <span className="font-semibold">Max Weight:</span>
                    <span>{product.guiInformation.maxWeightInKgs} kg</span>
                    <span className="font-semibold">Price without VAT:</span>
                    <span>{product.price.listPrice.priceWithoutAdditionalServices.amountWithoutVAT} {product.price.listPrice.currencyCode}</span>
                    <span className="font-semibold">Price with VAT:</span>
                    <span>{product.price.listPrice.priceWithAdditionalServices.amountWithVAT} {product.price.listPrice.currencyCode}</span>
                    {/* Utilize more data as needed */}
                  </div>
                  {/* Optionally, display icons for smaller viewports */}
                </div>
              ))}
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500">No shipping details available</p>
        )}
      </div>
    );
  };

export default MyShippingDetailsDisplay;