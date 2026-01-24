"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { CiStar } from "react-icons/ci";
import { useSession } from "next-auth/react";
import { CiMapPin } from "react-icons/ci";
import { GoPackage } from "react-icons/go";
import { CiDeliveryTruck } from "react-icons/ci";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import { BringShippingDetails } from "@/components/uicustom/product/bringShipping-details";
import { fetchPostalCodeFromCoords } from "@/components/uicustom/product/postal-code-from-coords";
import { fetchCoordsFromPostalCode } from "@/components/uicustom/product/postal-cords-from-code";
import { getCountryCode, haversineDistance } from "@/lib/utils";
import ProductSkeleton from "@/components/uicustom/skeletons/product-skeleton";
import PriceAmount from "@/components/crypto-related/PriceAmount";

interface Specification { key: string; value: string; }
interface WarehouseLocation { id: string; country: string; postalCode: string; countryCode?: string; }
interface Inventory { id: string; stock: number; warehouseId: string; }

interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number; // stored in USD
  image: string[];
  specifications: Specification[] | null;
  company: { warehouseLocations: WarehouseLocation[] | null } | null;
  inventory: Inventory[];
  shipFromPostalId: string;
  updatedAt: string;
  createdAt: string;
}

const parseWarehouseLocations = (locations: WarehouseLocation[] = []) =>
  locations.map((location) => ({ ...location, countryCode: getCountryCode(location.country) }));

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

function ProductDetails({ product }: { product: Product }) {
  const { data: session } = useSession();

  const [userPostalCode, setUserPostalCode] = useState<string | null>(null);
  const [closestWarehouse, setClosestWarehouse] = useState<WarehouseLocation | null>(null);
  const [hasFetchedLocation, setHasFetchedLocation] = useState(false);
  const [showShippingDetails, setShowShippingDetails] = useState(false);
  const [isLocLoading, setIsLocLoading] = useState(false);
  const [manualPostal, setManualPostal] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);

  // Where can we ship from?
  const warehouseLocations = useMemo(() => {
    if (product.company?.warehouseLocations?.length) {
      return parseWarehouseLocations(product.company.warehouseLocations);
    }
    if (product.shipFromPostalId) {
      // Fallback: treat shipFromPostalId as a single NO warehouse
      return [
        {
          id: product.shipFromPostalId,
          country: "Norway",
          postalCode: product.shipFromPostalId,
          countryCode: "NO",
        },
      ] as WarehouseLocation[];
    }
    return [] as WarehouseLocation[];
  }, [product.company?.warehouseLocations, product.shipFromPostalId]);

  // Specs normalization
  const specs = useMemo(() => {
    const base = { length: 0, width: 0, height: 0, grossWeight: 0 };
    (product.specifications || []).forEach((s) => {
      const v = parseFloat(s.value);
      if (s.key === "Length") base.length = v;
      if (s.key === "Width") base.width = v;
      if (s.key === "Height") base.height = v;
      if (s.key === "Weight") base.grossWeight = v;
    });
    return base;
  }, [product.specifications]);

  // Inventory helpers
  const totalStock = useMemo(
    () => product.inventory.reduce((sum, it) => sum + it.stock, 0),
    [product.inventory]
  );

  const stockAtClosest = useMemo(() => {
    if (!closestWarehouse) return 0;
    const match = product.inventory.find((it) => it.warehouseId === closestWarehouse.id);
    if (match) return match.stock;
    // fallback: max warehouse stock
    return product.inventory.reduce((m, it) => (it.stock > m ? it.stock : m), 0);
  }, [closestWarehouse, product.inventory]);

  // Find closest warehouse from user geolocation
  const resolveClosestWarehouse = useCallback(
    async (userLat: number, userLon: number) => {
      if (!warehouseLocations.length) return null;
      let closest = warehouseLocations[0];
      let min = Number.MAX_VALUE;
      for (const wh of warehouseLocations) {
        try {
          const coords = await fetchCoordsFromPostalCode(wh.postalCode, wh.countryCode || "NO");
          if (coords) {
            const d = haversineDistance(userLat, userLon, coords.latitude, coords.longitude);
            if (d < min) {
              min = d;
              closest = wh;
            }
          }
        } catch {
          // ignore failed lookups
        }
      }
      return closest;
    },
    [warehouseLocations]
  );

  const handleLocate = useCallback(async () => {
		if (!warehouseLocations.length) return false;
		setShowShippingDetails(true);
    setLocationError(null);
    setIsLocLoading(true);
    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
      const postal = await fetchPostalCodeFromCoords(latitude, longitude);
			if (!postal) {
				throw new Error("Could not determine your postal code. Please enter it manually.");
			}
			setUserPostalCode(postal);
      const closest = await resolveClosestWarehouse(latitude, longitude);
      if (closest) setClosestWarehouse(closest);
      setHasFetchedLocation(true);
      return true;
    } catch (e: any) {
			setHasFetchedLocation(false);
			setLocationError(e?.message || "Unable to retrieve your location.");
      return false;
    } finally {
      setIsLocLoading(false);
    }
	}, [warehouseLocations.length, resolveClosestWarehouse]);

  const handleManualPostal = useCallback(async () => {
    if (!manualPostal || !warehouseLocations.length) return;
		setShowShippingDetails(true);
    setLocationError(null);
    setIsLocLoading(true);
    try {
      // assume same country as first warehouse if we don’t know user’s country
      const country = warehouseLocations[0]?.countryCode || "NO";
      const user = await fetchCoordsFromPostalCode(manualPostal, country);
      if (!user) throw new Error("Could not locate that postal code.");
      setUserPostalCode(manualPostal);
      const closest = await resolveClosestWarehouse(user.latitude, user.longitude);
      if (closest) setClosestWarehouse(closest);
      setHasFetchedLocation(true);
    } catch (e: any) {
			setHasFetchedLocation(false);
      setLocationError(e?.message || "Could not use that postal code.");
    } finally {
      setIsLocLoading(false);
    }
  }, [manualPostal, warehouseLocations, resolveClosestWarehouse]);

  // Cart actions
  const handleAddToCart = useCallback(async () => {
    if (!session) {
      alert("You need to be logged in to add items to the cart");
      return;
    }
    const userId = (session as any)?.user?.id;
    try {
      const res = await fetch(`/api/cart/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Failed to add item to cart");
      alert("Item added to cart!");
    } catch {
      alert("Failed to add item to cart");
    }
  }, [session, product.id]);

  return (
    <div className="w-full">
      {/* Top section */}
      <section className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        {/* Gallery */}
        <div className="lg:sticky lg:top-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/40 backdrop-blur p-2">
            <Carousel>
              <CarouselContent>
                {product.image.map((src, idx) => (
                  <CarouselItem key={idx} className="bg-transparent">
                    <AspectRatio ratio={1 / 1}>
                      <Image
                        src={src}
                        alt={product.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 680px"
                        priority={idx === 0}
                        className="object-contain rounded-xl"
                      />
                    </AspectRatio>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
          {/* category + title */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide rounded-full px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              {product.category}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {product.title}
          </h1>

          {/* rating + price */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <CiStar className="h-5 w-5 text-yellow-500" />
              <span className="text-sm">Rating coming soon</span>
            </div>

            {/* network-aware pricing */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-gray-900 dark:text-gray-100"
            >
              <PriceAmount usd={product.price} />
            </motion.div>
          </div>

          {/* actions */}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="vegaBuyBtn" className="hover:shadow-md transition-shadow duration-300">
              Buy Now
            </Button>
            <Button
              variant="vegaAddBasketBtn"
              className="hover:shadow-md transition-shadow duration-300"
              onClick={handleAddToCart}
            >
              Add to Basket
            </Button>
            <Button variant="vegaAddWishlistBtn" className="hover:shadow-md transition-shadow duration-300">
              Add to Wishlist
            </Button>
          </div>

          {/* shipping */}
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <CiDeliveryTruck className="h-4 w-4" />
                Shipping
              </div>
						<div className="flex items-center gap-2">
							{showShippingDetails ? (
								<>
									<Button
										variant="secondary"
										onClick={handleLocate}
										disabled={isLocLoading || !warehouseLocations.length}
										size="sm"
									>
										{isLocLoading ? "Locating…" : "Retry location"}
									</Button>
									<Button variant="ghost" size="sm" onClick={() => setShowShippingDetails(false)}>
										Hide
									</Button>
								</>
							) : (
								<Button onClick={handleLocate} disabled={isLocLoading || !warehouseLocations.length} size="sm">
									{isLocLoading ? "Locating…" : "Get Shipping Details"}
								</Button>
							)}
						</div>
            </div>

					{showShippingDetails && userPostalCode && (closestWarehouse?.postalCode || product.shipFromPostalId) && (
              <div className="mt-3">
                <BringShippingDetails
								fromPostalCode={closestWarehouse?.postalCode || product.shipFromPostalId}
                  toPostalCode={userPostalCode}
                  productSpecifications={specs}
                />
              </div>
            )}

					{showShippingDetails && warehouseLocations.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-600 dark:text-gray-300">
								Enter a postal code to calculate shipping:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm w-40"
                    placeholder="Postal code"
                    value={manualPostal}
                    onChange={(e) => setManualPostal(e.target.value)}
                    inputMode="numeric"
                  />
                  <Button variant="secondary" size="sm" onClick={handleManualPostal} disabled={isLocLoading}>
                    Use Postal
                  </Button>
                </div>
                {locationError && <div className="text-xs text-red-600">{locationError}</div>}
							{!userPostalCode && !locationError && (
								<div className="text-xs text-gray-600 dark:text-gray-300">
									Tip: click <span className="font-medium">Retry location</span> to auto-detect your postal code.
								</div>
							)}
              </div>
            )}
          </div>

          {/* availability */}
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <GoPackage className="h-4 w-4" />
                Availability
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {stockAtClosest > 0
                  ? `${stockAtClosest} in stock at closest warehouse`
                  : "Out of stock at closest warehouse"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Overall: {totalStock} in stock
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <CiMapPin className="h-4 w-4" />
                Shipping from
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {closestWarehouse?.postalCode || product.shipFromPostalId || "—"}
              </div>
            </div>
          </div>

          {/* description */}
          <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{product.description}</p>
          </div>
        </div>
      </section>

      {/* Bottom section */}
      <section className="mt-8 rounded-2xl bg-slate-100/60 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Specifications</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(product.specifications || []).map((spec, idx) => (
            <div key={idx} className="flex flex-col">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{spec.key}</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {spec.value}
                {spec.key === "Weight" && " g"}
                {["Height", "Length", "Width"].includes(spec.key) && " cm"}
              </dd>
            </div>
          ))}
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Updated</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(product.updatedAt)
              )}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Created</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(product.createdAt)
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default function ProductClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageShellClassName = "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-6";

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch product: ${res.statusText}`);
        const data: Product | null = await res.json();
        if (!stopped) setProduct(data);
      } catch {
        if (!stopped) {
          setError("Product not found");
          setProduct(null);
        }
      }
    })();
    return () => { stopped = true; };
  }, [productId]);

  if (error)
    return (
      <div className={pageShellClassName}>
        <p className="text-red-600">{error}</p>
      </div>
    );

  if (!product)
    return (
      <div className={pageShellClassName}>
        <ProductSkeleton />
      </div>
    );

  return (
    <div className={pageShellClassName}>
      <ProductDetails product={product} />
    </div>
  );
}
