'use client'

import Image from 'next/image';
import React from 'react';

const MyShippingDetailsDisplay = ({ shippingResponse }: any) => {
  const options = Array.isArray(shippingResponse?.options) ? shippingResponse.options : null;
  const consignments = Array.isArray(shippingResponse?.consignments) ? shippingResponse.consignments : [];

  return (
    <div className="w-fit bg-gray-200 dark:bg-gray-900 shadow-lg rounded-lg">
      {options ? (
        <div className="p-4 space-y-2">
          <div className="text-sm font-semibold">Shipping options</div>
          {options.length === 0 ? (
            <p className="text-center text-gray-500">No shipping options available</p>
          ) : (
            options.map((opt: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-white/70 dark:bg-black/30 rounded-md border border-black/5 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-sm">
                      {opt?.serviceName || opt?.serviceCode || 'Shipping option'}
                    </div>
                    {opt?.serviceCode ? (
                      <div className="text-xs text-gray-600 dark:text-gray-300">{opt.serviceCode}</div>
                    ) : null}
                    {opt?.estimatedDelivery ? (
                      <div className="text-xs text-gray-600 dark:text-gray-300">{opt.estimatedDelivery}</div>
                    ) : null}
                  </div>

                  {opt?.price?.amount != null && opt?.price?.currency ? (
                    <div className="text-sm font-semibold">
                      {opt.price.amount} {opt.price.currency}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 dark:text-gray-300">Price unavailable</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : consignments.length > 0 ? (
        consignments.map((consignment: any, index: number) => (
          <div key={index} className="mb-6">
            {consignment.products.map((product: any, prodIndex: number) => (
              <div key={prodIndex} className="p-4 border-b last:border-b-0">
                <div className="flex items-center space-x-4 mb-2">
                  <Image
                    src={product.guiInformation.logoUrl}
                    alt="Shipping Logo"
                    width={50}
                    height={50}
                    className="rounded-full"
                  />
                  <h4 className="text-lg font-semibold">{product.guiInformation.displayName}</h4>
                </div>
                <p className="text-gray-600">{product.guiInformation.descriptionText}</p>
                <span className="font-semibold text-xs mr-2">Pickup Point:</span>
                <span className="italic text-xs">{product.guiInformation.closestPickupPoint}</span>
                <br />
                <span className="font-semibold text-xs mr-2">Price:</span>
                <span className="italic text-xs">
                  {product.price.listPrice.priceWithAdditionalServices.amountWithVAT}{' '}
                  {product.price.listPrice.currencyCode}{' '}
                </span>

                <div className="hidden  grid-cols-2 gap-4 text-sm mt-4">
                  <span className="font-semibold">Weight:</span>
                  <span>{product.shippingWeight} kg</span>
                  <span className="font-semibold">Max Weight:</span>
                  <span>{product.guiInformation.maxWeightInKgs} kg</span>
                  <span className="font-semibold">Price without VAT:</span>
                  <span>
                    {product.price.listPrice.priceWithoutAdditionalServices.amountWithoutVAT}{' '}
                    {product.price.listPrice.currencyCode}
                  </span>
                  <span className="font-semibold">Price with VAT:</span>
                  <span>
                    {product.price.listPrice.priceWithAdditionalServices.amountWithVAT}{' '}
                    {product.price.listPrice.currencyCode}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))
      ) : (
        <p className="p-4 text-center text-gray-500">No shipping details available</p>
      )}
    </div>
  );
};

export default MyShippingDetailsDisplay;