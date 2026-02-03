'use client'

import Image from 'next/image';
import React, { useState } from 'react';
import { FiTruck, FiMapPin, FiPackage, FiClock, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShippingOption {
  serviceName?: string;
  serviceCode?: string;
  estimatedDelivery?: string;
  price?: {
    amount: number;
    currency: string;
  };
}

interface GuiInformation {
  sortOrder?: string;
  mainDisplayCategory?: string;
  subDisplayCategory?: string;
  trackable?: boolean;
  logo?: string;
  logoUrl?: string;
  displayName?: string;
  productName?: string;
  descriptionText?: string;
  helpText?: string;
  shortName?: string;
  productURL?: string;
  deliveryType?: string;
  maxWeightInKgs?: string;
  closestPickupPoint?: string;
}

interface PriceInfo {
  amountWithoutVAT?: string;
  vat?: string;
  amountWithVAT?: string;
  currencyCode?: string;
}

interface ListPrice {
  priceWithoutAdditionalServices?: PriceInfo;
  priceWithAdditionalServices?: PriceInfo;
  currencyCode?: string;
}

interface Product {
  id?: string;
  productionCode?: string;
  shippingWeight?: number;
  guiInformation?: GuiInformation;
  price?: {
    listPrice?: ListPrice;
    zones?: { totalZoneCount?: number };
  };
}

interface Consignment {
  products?: Product[];
  consignmentId?: string;
}

interface ShippingResponse {
  error?: string;
  options?: ShippingOption[];
  consignments?: Consignment[];
}

const MyShippingDetailsDisplay = ({ shippingResponse }: { shippingResponse: ShippingResponse }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [expandedDetails, setExpandedDetails] = useState<boolean>(false);

  // Handle error responses from the API
  if (shippingResponse?.error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
        <p className="text-sm text-red-600 dark:text-red-400">
          Unable to fetch shipping options: {shippingResponse.error}
        </p>
      </div>
    );
  }

  const options = Array.isArray(shippingResponse?.options) ? shippingResponse.options : null;
  const consignments = Array.isArray(shippingResponse?.consignments) ? shippingResponse.consignments : [];

  // Flatten all products from consignments for easier rendering
  const allProducts: { product: Product; consignmentId?: string }[] = [];
  consignments.forEach((consignment) => {
    if (Array.isArray(consignment?.products)) {
      consignment.products.forEach((product) => {
        if (product?.guiInformation) {
          allProducts.push({ product, consignmentId: consignment.consignmentId });
        }
      });
    }
  });

  // No shipping options available
  if (!options && allProducts.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="h-12 w-12 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-3">
          <FiPackage className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No shipping options available</p>
      </div>
    );
  }

  // Simple options display
  if (options && options.length > 0) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Available Options
        </div>
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedIndex(idx)}
            className={cn(
              'w-full flex items-center justify-between gap-4 p-3 rounded-lg border transition-all duration-200',
              selectedIndex === idx
                ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                : 'border-border hover:border-emerald-500/50 bg-surface-2/50 dark:bg-white/[0.02]'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
                selectedIndex === idx
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted/50 text-muted-foreground'
              )}>
                <FiTruck className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">
                  {opt?.serviceName || opt?.serviceCode || 'Shipping option'}
                </div>
                {opt?.estimatedDelivery && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <FiClock className="h-3 w-3" />
                    {opt.estimatedDelivery}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {opt?.price?.amount != null && opt?.price?.currency ? (
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {opt.price.amount} {opt.price.currency}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Quote on request</div>
              )}
              {selectedIndex === idx && (
                <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <FiCheck className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Consignment products display (Bring Shipping Guide response)
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Shipping Options ({allProducts.length})
      </div>

      {allProducts.map(({ product, consignmentId }, idx) => {
        const guiInfo = product.guiInformation!;
        const priceInfo = product.price?.listPrice;
        const deliveryType = guiInfo.deliveryType?.toLowerCase();
        const isPickup = deliveryType?.includes('pickup') || !!guiInfo.closestPickupPoint;
        const isSelected = selectedIndex === idx;
        const price = priceInfo?.priceWithAdditionalServices?.amountWithVAT;
        const currency = priceInfo?.currencyCode || priceInfo?.priceWithAdditionalServices?.currencyCode || 'NOK';

        return (
          <motion.div
            key={`${consignmentId || 'c'}-${idx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <button
              onClick={() => setSelectedIndex(idx)}
              className={cn(
                'w-full text-left rounded-xl border transition-all duration-200 overflow-hidden',
                isSelected
                  ? 'border-emerald-500 ring-1 ring-emerald-500/20 shadow-sm'
                  : 'border-border hover:border-emerald-500/50'
              )}
            >
              {/* Main content */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Logo */}
                  {guiInfo.logoUrl ? (
                    <div className="h-12 w-12 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center overflow-hidden p-2 shrink-0 border border-border/50">
                      <Image
                        src={guiInfo.logoUrl}
                        alt={guiInfo.displayName || 'Carrier'}
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-surface-2 dark:bg-white/10 flex items-center justify-center shrink-0">
                      <FiPackage className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm leading-tight">
                          {guiInfo.displayName || guiInfo.productName || 'Shipping option'}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          {isPickup && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase">
                              <FiMapPin className="h-2.5 w-2.5" />
                              Pickup
                            </span>
                          )}
                          {guiInfo.trackable && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                              Trackable
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right shrink-0">
                        {price != null ? (
                          <>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              {price} {currency}
                            </div>
                            <div className="text-[10px] text-muted-foreground">incl. VAT</div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">Price on request</div>
                        )}
                      </div>
                    </div>

                    {/* Description - collapsed */}
                    {guiInfo.descriptionText && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {guiInfo.descriptionText}
                      </p>
                    )}
                  </div>

                  {/* Selection indicator */}
                  <div className={cn(
                    'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-muted-foreground/30'
                  )}>
                    {isSelected && <FiCheck className="h-3.5 w-3.5 text-white" />}
                  </div>
                </div>
              </div>

              {/* Pickup point info (if selected and has pickup) */}
              <AnimatePresence>
                {isSelected && guiInfo.closestPickupPoint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border dark:border-white/5"
                  >
                    <div className="px-4 py-3 bg-blue-500/5 dark:bg-blue-500/10">
                      <div className="flex items-start gap-2">
                        <FiMapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            Nearest Pickup Point
                          </div>
                          <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                            {guiInfo.closestPickupPoint}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        );
      })}

      {/* Show more details toggle */}
      {allProducts.length > 0 && allProducts[selectedIndex] && (
        <button
          onClick={() => setExpandedDetails(!expandedDetails)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expandedDetails ? (
            <>
              <FiChevronUp className="h-3.5 w-3.5" />
              Hide details
            </>
          ) : (
            <>
              <FiChevronDown className="h-3.5 w-3.5" />
              Show details
            </>
          )}
        </button>
      )}

      {/* Expanded details */}
      <AnimatePresence>
        {expandedDetails && allProducts[selectedIndex] && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg bg-surface-2/50 dark:bg-white/[0.02] border border-border dark:border-white/5 p-3"
          >
            <div className="grid grid-cols-2 gap-3 text-xs">
              {allProducts[selectedIndex].product.guiInformation?.maxWeightInKgs && (
                <div>
                  <div className="text-muted-foreground">Max Weight</div>
                  <div className="font-medium text-foreground">
                    {allProducts[selectedIndex].product.guiInformation.maxWeightInKgs} kg
                  </div>
                </div>
              )}
              {allProducts[selectedIndex].product.shippingWeight && (
                <div>
                  <div className="text-muted-foreground">Package Weight</div>
                  <div className="font-medium text-foreground">
                    {allProducts[selectedIndex].product.shippingWeight} kg
                  </div>
                </div>
              )}
              {allProducts[selectedIndex].product.guiInformation?.deliveryType && (
                <div>
                  <div className="text-muted-foreground">Delivery Type</div>
                  <div className="font-medium text-foreground capitalize">
                    {allProducts[selectedIndex].product.guiInformation.deliveryType.toLowerCase().replace('_', ' ')}
                  </div>
                </div>
              )}
              {allProducts[selectedIndex].product.price?.listPrice?.priceWithoutAdditionalServices?.amountWithVAT && (
                <div>
                  <div className="text-muted-foreground">Base Price</div>
                  <div className="font-medium text-foreground">
                    {allProducts[selectedIndex].product.price.listPrice.priceWithoutAdditionalServices.amountWithVAT}{' '}
                    {allProducts[selectedIndex].product.price.listPrice.currencyCode || 'NOK'}
                  </div>
                </div>
              )}
            </div>
            {allProducts[selectedIndex].product.guiInformation?.helpText && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                {allProducts[selectedIndex].product.guiInformation.helpText}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyShippingDetailsDisplay;
