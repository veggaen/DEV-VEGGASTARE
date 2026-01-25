"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { useUiPreferences, type ProductTitleAnimationMode } from "@/components/providers/ui-preferences";

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

function AnimatedTitle({
  text,
  mode,
  rsvpWpm,
}: {
  text: string;
  mode: ProductTitleAnimationMode;
  rsvpWpm: number;
}) {
  const reduceMotion = useReducedMotion();
  const letters = useMemo(() => Array.from(text ?? ""), [text]);
  const words = useMemo(
    () => String(text ?? "").split(/\s+/).filter(Boolean),
    [text]
  );

  const safeWpm = Number.isFinite(rsvpWpm) ? Math.min(900, Math.max(120, rsvpWpm)) : 420;
  const msPerWord = Math.min(500, Math.max(120, Math.round(60000 / safeWpm)));

  const [wordIndex, setWordIndex] = useState(0);
  const [rsvpDone, setRsvpDone] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    if (mode !== "rsvp") return;
    if (words.length <= 1) return;

    setWordIndex(0);
    setRsvpDone(false);

    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      if (i >= words.length) {
        window.clearInterval(t);
        setRsvpDone(true);
        return;
      }
      setWordIndex(i);
    }, msPerWord);

    return () => window.clearInterval(t);
  }, [reduceMotion, mode, msPerWord, words.length, text]);

  if (reduceMotion || mode === "off") {
    return (
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
        {text}
      </h1>
    );
  }

  if (mode === "rsvp" && words.length > 1) {
    return (
      <div className="relative">
        <div className="min-h-[2.25rem] md:min-h-[2.75rem]">
          <AnimatePresence mode="wait" initial={false}>
            {!rsvpDone && (
              <motion.h1
                key={`${words[wordIndex]}-${wordIndex}`}
                className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight tracking-tight"
                initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {String(words[wordIndex]).toUpperCase()}
              </motion.h1>
            )}
          </AnimatePresence>
        </div>

        {/* settle into full title */}
        <motion.h1
          className="absolute inset-0 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight"
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: rsvpDone ? 1 : 0, filter: rsvpDone ? "blur(0px)" : "blur(8px)" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {text}
        </motion.h1>
      </div>
    );
  }

  const baseDelay = 0.15;
  const perLetter = 0.02;

  return (
    <h1
      className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight tracking-tight"
      aria-label={text}
    >
      {/* Single visible layer; keep accessibility text intact */}
      <span className="sr-only">{text}</span>

      <motion.span
        aria-hidden
        className="inline"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { delayChildren: baseDelay, staggerChildren: perLetter } },
        }}
      >
        {letters.map((ch, i) => (
          <motion.span
            key={`${ch}-${i}`}
            className="inline-block"
            variants={{
              hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
              show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.28, ease: "easeOut" } },
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </motion.span>
        ))}
      </motion.span>
    </h1>
  );
}

function AnimatedPrice({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: [
          "0 0 0px rgba(34,197,94,0)",
          "0 0 18px rgba(34,197,94,0.35)",
          "0 0 0px rgba(34,197,94,0)",
        ],
      }}
      transition={{
        opacity: { duration: 0.25, ease: "easeOut" },
        y: { duration: 0.25, ease: "easeOut" },
        boxShadow: { delay: 0.35, duration: 1.1, ease: "easeInOut" },
      }}
      className="text-2xl font-bold text-gray-900 dark:text-gray-100 rounded-md px-2 py-1 -mx-2"
    >
      {children}
    </motion.div>
  );
}

function ProductDetails({ product }: { product: Product }) {
  const { data: session } = useSession();
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();

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
      <motion.section
        className="grid lg:grid-cols-2 gap-6 lg:gap-10"
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
      >
        {/* Gallery */}
        <motion.div
          className="lg:sticky lg:top-6"
          variants={{
            hidden: { opacity: 0, y: 14, filter: "blur(10px)" },
            show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: "easeOut" } },
          }}
        >
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
        </motion.div>

        {/* Details */}
        <motion.div
          className="flex flex-col gap-4"
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
          }}
        >
          {/* category + title */}
          <motion.div
            className="flex items-center gap-2"
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
            }}
          >
            <span className="text-[11px] uppercase tracking-wide rounded-full px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              {product.category}
            </span>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <AnimatedTitle
              text={product.title}
              mode={reduceMotion ? "off" : prefs.productTitleAnimationMode}
              rsvpWpm={prefs.rsvpWpm}
            />
          </motion.div>

          {/* rating + price */}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-3"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
            }}
          >
            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <CiStar className="h-5 w-5 text-yellow-500" />
              <span className="text-sm">Rating coming soon</span>
            </div>

            {/* network-aware pricing */}
            <AnimatedPrice>
              <PriceAmount usd={product.price} />
            </AnimatedPrice>
          </motion.div>

          {/* actions */}
          <motion.div
            className="mt-2 flex flex-wrap gap-2"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
            }}
          >
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
          </motion.div>

          {/* shipping */}
          <motion.div
            className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
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
              </motion.div>

          {/* availability */}
          <motion.div
            className="grid sm:grid-cols-2 gap-3 mt-2"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
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
          </motion.div>

          {/* description */}
          <motion.div
            className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{product.description}</p>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Bottom section */}
      <motion.section
        className="mt-8 rounded-2xl bg-slate-100/60 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-800 p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
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
      </motion.section>
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
