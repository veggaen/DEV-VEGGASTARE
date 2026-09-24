"use client";

import { type ReactNode, useEffect, useMemo, useState, useCallback, useRef } from "react";
import PriceAmount from '@/components/crypto-related/PriceAmount';
import CreditAmountEditor from '@/components/checkout/credit-amount-editor';
import { DEFAULT_PURCHASE_CREDITS, quoteCreditPurchase } from '@/lib/ai-credit-purchase';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CiStar } from "react-icons/ci";
import { useSession } from "next-auth/react";
import { useCart } from "@/contexts/cart-context";
import { CiMapPin } from "react-icons/ci";
import { GoPackage } from "react-icons/go";
import { CiDeliveryTruck } from "react-icons/ci";
import { Button } from "@/components/ui/button";
import ProductGallery from '@/components/uicustom/product/product-gallery';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { BringShippingDetails } from "@/components/uicustom/product/bringShipping-details";
import { fetchPostalCodeFromCoords } from "@/components/uicustom/product/postal-code-from-coords";
import { fetchCoordsFromPostalCode } from "@/components/uicustom/product/postal-cords-from-code";
import { PostalCodeAutocomplete } from "@/components/uicustom/postal-code-autocomplete";
import { cn, getCountryCode, haversineDistance } from "@/lib/utils";
import ProductSkeleton from "@/components/uicustom/skeletons/product-skeleton";
import { fetchUserEmployeePermissions } from "@/actions/user-company-permissions";
import { MyDeleteProductAction, MySetProductVisibilityAction } from "@/actions/products";
import type { EmployeePermissions } from "@/lib/types/company-permissions";
import { Archive, ArrowLeft, CreditCard, Eye, EyeOff, Pencil, Share2, ShieldCheck, ShoppingCart, Trash2, Loader2, Navigation, Flag, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "@/components/uicustom/report/ReportDialog";
import { SHOWCASE_PRODUCTS } from "@/lib/showcase-catalog";
import SiteFooter from "@/components/uicustom/site-footer";

interface Specification { key: string; value: string; }
interface Feature { text: string; key?: string; icon?: string; }
interface WarehouseLocation { id: string; country: string; postalCode: string; countryCode?: string; }
interface Inventory { id: string; stock: number; warehouseId: string; }
type ProductVisibility = "PUBLIC" | "HIDDEN" | "ARCHIVED";

interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number; // Stored in priceCurrency; checkout quotes remain server-authoritative.
  priceCurrency: string;
  acceptedFiatCurrencies: string[];
  stock: number;
  productType: "PHYSICAL" | "DIGITAL" | "HYBRID";
  visibility: ProductVisibility;
  hiddenAt?: string | null;
  archivedAt?: string | null;
  downloadsEnabled: boolean;
  condition: string;
  image: string[];
  specifications: Specification[] | null;
  features: Feature[] | null;
  userId: string;
  companyId: string | null;
  acceptedTokens: Array<{
    family: "EVM" | "SOLANA";
    symbol: string;
    decimals: number;
    tokenAddress: string | null;
    tokenMint: string | null;
  }>;
  company: { warehouseLocations: WarehouseLocation[] | null } | null;
  inventory: Inventory[];
  shipFromPostalId: string;
  updatedAt: string;
  createdAt: string;
}

function getAcceptedTokenSymbols(product: Product) {
  return Array.from(
    new Set((product.acceptedTokens ?? []).map((token) => token.symbol).filter(Boolean))
  );
}

function getAcceptedFiatCurrencies(product: Product) {
  const currencies = product.acceptedFiatCurrencies?.length
    ? product.acceptedFiatCurrencies
    : [product.priceCurrency || "USD"];
  return Array.from(new Set(currencies.filter(Boolean)));
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
  const router = useRouter();
  const { data: session } = useSession();
  const { addItem, items: cartItems, isLoading: cartLoading, error: cartError } = useCart();
  const purchaseLock = useRef(false);
  const [selectedCredits, setSelectedCredits] = useState(DEFAULT_PURCHASE_CREDITS);
  const [dirtyCredits, setDirtyCredits] = useState(false);
  const [purchasePending, setPurchasePending] = useState<'add' | 'buy' | null>(null);
  const [purchaseFailure, setPurchaseError] = useState('');
  const purchaseError = purchaseFailure || (cartError ? 'We could not verify your saved basket. Open your basket and refresh it before purchasing.' : '');
  const reduceMotion = useReducedMotion();

  const [companyEditAllowed, setCompanyEditAllowed] = useState(false);
  const [companyLifecycleAllowed, setCompanyLifecycleAllowed] = useState(false);
  const [currentVisibility, setCurrentVisibility] = useState<ProductVisibility>(product.visibility ?? "PUBLIC");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const sessionUserId = (session as any)?.user?.id as string | undefined;
  const sessionRole = (session as any)?.user?.role as string | undefined;
  const isAdminLike = sessionRole === "ADMIN" || sessionRole === "OWNER";

  useEffect(() => {
    setCurrentVisibility(product.visibility ?? "PUBLIC");
  }, [product.visibility]);

  const canEditProduct = useMemo(() => {
    if (!sessionUserId) return false;
    if (isAdminLike) return true;
    if (product.userId === sessionUserId) return true;
    if (product.companyId && companyEditAllowed) return true;
    return false;
  }, [companyEditAllowed, isAdminLike, product.companyId, product.userId, sessionUserId]);

  const canManageProductLifecycle = useMemo(() => {
    if (!sessionUserId) return false;
    if (canEditProduct) return true;
    if (product.companyId && companyLifecycleAllowed) return true;
    return false;
  }, [canEditProduct, companyLifecycleAllowed, product.companyId, sessionUserId]);

  const handleDeleteProduct = useCallback(async () => {
    setIsDeleting(true);
    try {
      const result = await MyDeleteProductAction(product.id);
      if (result.error) {
        toast.error(result.error);
        setIsDeleting(false);
        return;
      }
      setCurrentVisibility("ARCHIVED");
      toast.success(result.success || "Product archived");
      setDeleteDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Failed to archive product");
    } finally {
      setIsDeleting(false);
    }
  }, [product.id, router]);

  const handleSetVisibility = useCallback(
    async (nextVisibility: ProductVisibility) => {
      setIsUpdatingVisibility(true);
      try {
        const result = await MySetProductVisibilityAction(product.id, nextVisibility);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setCurrentVisibility(result.visibility ?? nextVisibility);
        toast.success(result.success || "Product visibility updated");
        router.refresh();
      } catch {
        toast.error("Failed to update product visibility");
      } finally {
        setIsUpdatingVisibility(false);
      }
    },
    [product.id, router]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!sessionUserId || session?.user?.isDemo) return;
        if (!product.companyId) return;
        // Ask server for employee permissions
        const res = await fetchUserEmployeePermissions({ id: sessionUserId }, product.companyId);
        if (!alive) return;
        if (!res.success) {
          setCompanyEditAllowed(false);
          setCompanyLifecycleAllowed(false);
          return;
        }
        const perms = (res.permissions ?? {}) as EmployeePermissions;
        setCompanyEditAllowed(perms?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true);
        setCompanyLifecycleAllowed(
          perms?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true ||
            perms?.CAN_DELETE_PRODUCT === true ||
            perms?.CAN_MANAGE_PRODUCT_VISIBILITY === true
        );
      } catch {
        if (!alive) return;
        setCompanyEditAllowed(false);
        setCompanyLifecycleAllowed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [product.companyId, sessionUserId, session?.user?.isDemo]);

  const [userPostalCode, setUserPostalCode] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [closestWarehouse, setClosestWarehouse] = useState<WarehouseLocation | null>(null);
  const [hasFetchedLocation, setHasFetchedLocation] = useState(false);
  const [showShippingDetails, setShowShippingDetails] = useState(false);
  const [isLocLoading, setIsLocLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

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

  // Specs normalization - use sensible defaults for shipping calculation
  const specs = useMemo(() => {
    // Default package: 20x15x10cm, 500g (reasonable small parcel)
    const base = { length: 20, width: 15, height: 10, grossWeight: 500 };
    (product.specifications || []).forEach((s) => {
      const v = parseFloat(s.value);
      if (!isNaN(v) && v > 0) {
        if (s.key === "Length") base.length = v;
        if (s.key === "Width") base.width = v;
        if (s.key === "Height") base.height = v;
        if (s.key === "Weight") base.grossWeight = v;
      }
    });
    return base;
  }, [product.specifications]);

  // Inventory helpers
  const totalStock = useMemo(() => {
    if (Number.isFinite(product.stock)) return Math.max(0, product.stock);
    const inventory = product.inventory ?? [];
    return inventory.reduce((sum, it) => sum + it.stock, 0);
  }, [product.inventory, product.stock]);

  const stockAtClosest = useMemo(() => {
    if (!closestWarehouse) return totalStock;
    const inventory = product.inventory ?? [];
    const match = inventory.find((it) => it.warehouseId === closestWarehouse.id);
    if (match) return match.stock;
    if (!inventory.length) return totalStock;
    return inventory.reduce((m, it) => (it.stock > m ? it.stock : m), 0);
  }, [closestWarehouse, product.inventory, totalStock]);

  const isDigitalProduct = product.productType === "DIGITAL";
  const isCreditPack = product.id === SHOWCASE_PRODUCTS.credits.id;
  const deliveryDestination = isCreditPack ? "AI credit balance" : "My downloads";
  const hasShipping = product.productType !== "DIGITAL";
  const acceptedTokenSymbols = useMemo(() => getAcceptedTokenSymbols(product), [product]);
  const acceptedFiatCurrencies = useMemo(() => getAcceptedFiatCurrencies(product), [product]);
  const hasCryptoPayments = acceptedTokenSymbols.length > 0;
  const isPublicListing = currentVisibility === "PUBLIC";
  const visibilityLabel =
    currentVisibility === "PUBLIC"
      ? "Public"
      : currentVisibility === "HIDDEN"
        ? "Hidden"
        : "Archived";
  const availabilityLabel =
    currentVisibility === "ARCHIVED"
      ? "Archived listing"
      : currentVisibility === "HIDDEN"
        ? "Hidden listing"
        : isDigitalProduct
          ? product.downloadsEnabled
            ? isCreditPack ? "Credits available" : "Digital access available"
            : "Listing unavailable"
          : totalStock > 0
            ? `${totalStock} in stock`
            : "Stock check needed";
  const canPurchase = isPublicListing && product.downloadsEnabled !== false && (isDigitalProduct || totalStock > 0);

  // State for user's distance to closest warehouse
  const [userDistanceToWarehouseKm, setUserDistanceToWarehouseKm] = useState<number | undefined>(undefined);

  // Find closest warehouse from user geolocation
  const resolveClosestWarehouse = useCallback(
    async (userLat: number, userLon: number): Promise<{ warehouse: WarehouseLocation; distanceKm: number } | null> => {
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
      return { warehouse: closest, distanceKm: min === Number.MAX_VALUE ? 999 : min };
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
      
      // Try to fetch city from postal code
      try {
        const res = await fetch(`/api/bring-shipping-suggest-postcode?postalCode=${postal}&countryCode=no`);
        const data = await res.json();
        const match = data?.postal_codes?.find((p: any) => p.postal_code === postal);
        if (match?.city) {
          setUserCity(match.city);
        }
      } catch {
        // Ignore city lookup errors
      }
      
      const result = await resolveClosestWarehouse(latitude, longitude);
      if (result) {
        setClosestWarehouse(result.warehouse);
        setUserDistanceToWarehouseKm(result.distanceKm);
      }
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

  // One lock for both desktop/mobile actions, including clicks before React paints.
  // An uncertain network response must be reviewed in the cart, not blindly replayed.
  const purchase = useCallback(async (action: 'add' | 'buy') => {
    if (purchaseLock.current || cartLoading || dirtyCredits || purchaseError || !canPurchase) return;
    if (!session?.user?.id) {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/products/${product.id}`)}`);
      return;
    }
    purchaseLock.current = true;
    setPurchasePending(action);
    let navigating = false;
    try {
      const alreadyInCart = cartItems.some(item => item.product.id === product.id);
      if (isCreditPack || !(alreadyInCart && (action === 'buy' || isDigitalProduct))) {
        if (!await addItem(product.id, 1, isCreditPack ? selectedCredits : undefined)) throw new Error('Cart update not confirmed');
      }
      if (action === 'buy') {
        navigating = true;
        router.push('/checkout');
      } else {
        toast.success(isCreditPack && alreadyInCart ? 'Credit amount updated' : alreadyInCart && isDigitalProduct ? 'Already in your basket' : 'Added to basket', {
          description: product.title,
          action: { label: 'View basket', onClick: () => router.push('/cart') },
          duration: 4000,
        });
      }
    } catch {
      setPurchaseError('We could not confirm the cart update. Review your basket before trying again. No payment has been taken.');
    } finally {
      if (!navigating) { purchaseLock.current = false; setPurchasePending(null); }
    }
  }, [cartLoading, dirtyCredits, purchaseError, canPurchase, session?.user?.id, router, product.id, product.title, cartItems, isDigitalProduct, isCreditPack, selectedCredits, addItem]);
  const handleAddToCart = () => purchase('add');
  const handleBuyNow = () => purchase('buy');
  const purchaseDisabled = !canPurchase || dirtyCredits || cartLoading || purchasePending !== null || Boolean(purchaseError);
  const displayPrice = <PriceAmount amount={isCreditPack ? quoteCreditPurchase(selectedCredits).amountOre / 100 : product.price} currency={isCreditPack ? 'NOK' : product.priceCurrency || 'USD'} />;
  const productKindLabel = isCreditPack ? "AI usage credits" : isDigitalProduct ? "Digital download" : product.productType === "HYBRID" ? "Hybrid product" : "Physical product";
  const updatedAt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(product.updatedAt));
  const createdAt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(product.createdAt));

  return (
    <div data-product-detail className="relative w-full min-w-0 space-y-6 pb-8 text-foreground">
      <div data-mobile-product-actions role="region" aria-label="Product purchase" style={{ marginBlock: 0 }} className="fixed inset-x-0 bottom-[var(--cookie-banner-offset,0px)] z-50 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{product.title}</p>
            <p className="mt-1 font-semibold tabular-nums">{displayPrice}</p>
          </div>
          <Button type="button" variant="vegaAddBasketBtn" className="h-12 shrink-0 rounded-xl px-4" onClick={handleAddToCart} disabled={purchaseDisabled}>{purchasePending ? "Adding…" : "Add to basket"}</Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/products"
          aria-label="Back to products"
          title="Back to products"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to products
        </Link>
        {canManageProductLifecycle && (
          <div
            className={cn(
              "border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]",
              currentVisibility === "PUBLIC" && "border-emerald-300/35 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
              currentVisibility === "HIDDEN" && "border-amber-300/35 bg-amber-400/10 text-amber-200",
              currentVisibility === "ARCHIVED" && "border-zinc-500/45 bg-zinc-500/10 text-muted-foreground"
            )}
          >
            {visibilityLabel}
          </div>
        )}
      </div>

      {/* Top section */}
      <motion.section
        className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8"
        initial={false}
        animate="show"
      >
        {/* Gallery */}
        <motion.div
          className="min-w-0 lg:col-span-7"
        >
          <ProductGallery images={product.image} title={product.title} credits={isCreditPack ? selectedCredits : undefined} />

          {/* Quick stats — text on background, divided by hairlines (no boxes) */}
          {!isDigitalProduct && <div className="mt-5 hidden grid-cols-3 gap-3 lg:grid">
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-center shadow-sm  motion-safe:transition-transform motion-safe:duration-200 [@media(hover:hover)]:motion-safe:hover:-translate-y-0.5">
              <div className="text-sm font-semibold text-foreground">{availabilityLabel}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Availability</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-center shadow-sm  motion-safe:transition-transform motion-safe:duration-200 [@media(hover:hover)]:motion-safe:hover:-translate-y-0.5">
              <div className="text-sm font-semibold text-foreground">{product.condition}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Condition</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-center shadow-sm  motion-safe:transition-transform motion-safe:duration-200 [@media(hover:hover)]:motion-safe:hover:-translate-y-0.5">
              <div className="text-sm font-semibold text-foreground">{isDigitalProduct ? deliveryDestination : product.shipFromPostalId || "Not set"}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{isDigitalProduct ? "Delivery" : "Ships from"}</div>
            </div>
          </div>}
        </motion.div>

        {/* Details */}
        <motion.div
          className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm  sm:p-6 lg:col-span-5"
        >
          {/* category + title */}
          <motion.div
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-700 dark:text-emerald-300">
                  {productKindLabel}
                </span>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                  {product.category}
                </span>
              </div>
              <h1 className="mt-4 max-w-2xl break-words text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                {product.title}
              </h1>
              <div className="mt-5 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                <span data-product-price className="tabular-nums">{displayPrice}</span>
              </div>
            </div>
          </motion.div>

          {/* rating */}
          {isCreditPack && <CreditAmountEditor value={selectedCredits} onSave={setSelectedCredits} onDirtyChange={setDirtyCredits}
            disabled={cartLoading || purchasePending !== null} />}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <CiStar className="h-5 w-5 text-yellow-500" />
              <span className="text-sm">No reviews yet</span>
            </div>

            {/* Report button — visible to logged-in non-owners */}
            {sessionUserId && !canManageProductLifecycle && (
              <Button variant="ghost" size="sm" className="min-h-11 gap-2 text-muted-foreground hover:text-red-600" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4" />
                Report
              </Button>
            )}

            {canManageProductLifecycle && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canEditProduct && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href={`/products/edit/${product.id}`}>
                      <Pencil className="h-4 w-4" />
                      Edit listing
                    </Link>
                  </Button>
                )}
                {currentVisibility === "PUBLIC" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-amber-300/25 text-amber-200 hover:bg-amber-400/10"
                    disabled={isUpdatingVisibility}
                    onClick={() => handleSetVisibility("HIDDEN")}
                  >
                    {isUpdatingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                    Hide
                  </Button>
                ) : currentVisibility === "HIDDEN" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-emerald-300/25 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-400/10"
                    disabled={isUpdatingVisibility}
                    onClick={() => handleSetVisibility("PUBLIC")}
                  >
                    {isUpdatingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Publish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-zinc-500/40 text-muted-foreground hover:bg-white/10"
                    disabled={isUpdatingVisibility}
                    onClick={() => handleSetVisibility("HIDDEN")}
                  >
                    {isUpdatingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    Restore hidden
                  </Button>
                )}
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                      disabled={currentVisibility === "ARCHIVED"}
                    >
                      <Trash2 className="h-4 w-4" />
                      Archive
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Archive listing</DialogTitle>
                      <DialogDescription>
                        This removes &quot;{product.title}&quot; from the public marketplace and stops new purchases. Existing orders and download records stay valid.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button 
                        variant="outline" 
                        onClick={() => setDeleteDialogOpen(false)}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteProduct}
                        disabled={isDeleting}
                        className="gap-2"
                      >
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isDeleting ? "Archiving..." : "Archive listing"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </motion.div>

          {/* actions */}
          <motion.div
            className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3"
          >
            <motion.div
            >
              <Button
                type="button"
                variant="vegaBuyBtn"
                className="h-12 w-full rounded-xl px-4 text-sm"
                onClick={handleBuyNow}
                disabled={purchaseDisabled}
                title={canPurchase ? undefined : "This product can't be purchased right now"}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {purchasePending === "buy" ? "Opening checkout…" : purchasePending ? "Adding…" : canPurchase ? "Buy now" : "Unavailable"}
              </Button>
            </motion.div>

            <motion.div className="col-start-1 row-start-2 hidden lg:block">
              <Button
                type="button"
                variant="vegaAddBasketBtn"
                className="h-12 w-full rounded-xl px-4 text-sm font-semibold"
                onClick={handleAddToCart}
                disabled={purchaseDisabled}
              >
                {purchasePending ? "Adding…" : "Add to basket"}
              </Button>
            </motion.div>
            <motion.div
            >
              {/* Repurposed: was a dead "Wishlist" button that only toasted
                  "not connected yet" — now a working Share action. */}
              <Button
                type="button"
                variant="vegaAddWishlistBtn"
                className="h-12 rounded-xl px-4 text-sm font-semibold"
                onClick={async () => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: document.title, url });
                    } else {
                      await navigator.clipboard.writeText(url);
                      toast.success("Link copied to clipboard");
                    }
                  } catch (error) {
                    if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Could not share the link. You can copy it from your address bar.");
                  }
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </motion.div>
          </motion.div>

          {purchaseError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{purchaseError} <Link href="/cart" className="inline-flex min-h-11 items-center font-semibold underline">Review basket</Link></p>}

          {/* Seller preferences; availability is confirmed at checkout. */}
          <motion.div
            className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            <span className="font-medium text-muted-foreground">Payment</span>

            {/* Crypto chains from product's acceptedTokens */}
            {Array.isArray(product.acceptedTokens) && product.acceptedTokens.length > 0 && (
              <>
                {[...new Set(product.acceptedTokens.map((t: any) => t.family as string))].map((family) => (
                  <span
                    key={family}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-medium text-emerald-800 dark:text-emerald-200"
                  >
                    <WalletCards className="h-3.5 w-3.5" />
                    {family === "EVM" ? "EVM mainnet" : "Solana mainnet"}
                  </span>
                ))}
              </>
            )}

            {/* Provider availability is checked at checkout. */}
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 font-medium text-sky-800 dark:text-sky-200">
              <CreditCard className="h-3.5 w-3.5" />
              PayPal · check at checkout ({acceptedFiatCurrencies.join(", ")})
            </span>
            {!hasCryptoPayments && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 font-medium text-muted-foreground">
                <WalletCards className="h-3.5 w-3.5" />
                Crypto not configured
              </span>
            )}
          </motion.div>

          {/* shipping — available to everyone, including logged-out visitors.
              Location detection + Bring price lookup need no auth. */}
          {hasShipping ? (
          <motion.div
            className="mt-6 overflow-hidden rounded-xl border border-border bg-surface-1"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-3">
                <CiDeliveryTruck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Shipping estimate</div>
                  <div className="text-xs text-muted-foreground">
                    {userPostalCode
                      ? `Delivering to ${userPostalCode}${userCity ? ` ${userCity}` : ''}`
                      : 'Get shipping costs instantly'}
                  </div>
                </div>
              </div>
              {showShippingDetails && userPostalCode && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowShippingDetails(false);
                    setUserPostalCode(null);
                    setUserCity(null);
                    setShowManualInput(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Change
                </Button>
              )}
            </div>

            {/* Location Input - Prominent Auto-Detect Design */}
            <div className="p-4">
              {warehouseLocations.length > 0 ? (
                <>
                  {/* Show detected location or input options */}
                  {!userPostalCode ? (
                    <div className="space-y-3">
                      {/* Primary: Auto-Detect Button — single accent, no heavy gradient */}
                      <motion.button
                        type="button"
                        onClick={handleLocate}
                        disabled={isLocLoading}
                        className={cn(
                          "flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3",
                          "bg-emerald-600 font-medium text-foreground",
                          "transition-colors duration-200 hover:bg-emerald-500",
                          isLocLoading && "cursor-wait opacity-70"
                        )}
                        whileHover={!reduceMotion && !isLocLoading ? { scale: 1.005 } : {}}
                        whileTap={!reduceMotion && !isLocLoading ? { scale: 0.99 } : {}}
                      >
                        {isLocLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Finding your location...</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="h-5 w-5" />
                            <span>Use My Location</span>
                          </>
                        )}
                      </motion.button>

                      {/* Secondary: Manual entry toggle */}
                      {!showManualInput ? (
                        <button
                          type="button"
                          onClick={() => setShowManualInput(true)}
                          className="w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-2"
                        >
                          Or enter postal code manually
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <PostalCodeAutocomplete
                            value=""
                            onChange={(postal, city) => {
                              if (postal.length >= 4) {
                                setUserPostalCode(postal);
                                if (city) setUserCity(city);
                                setShowShippingDetails(true);
                              }
                            }}
                            onSelect={async (suggestion) => {
                              setUserPostalCode(suggestion.postal_code);
                              setUserCity(suggestion.city || null);
                              setShowShippingDetails(true);
                              setLocationError(null);
                              
                              if (suggestion.latitude && suggestion.longitude) {
                                const lat = parseFloat(suggestion.latitude);
                                const lon = parseFloat(suggestion.longitude);
                                if (!isNaN(lat) && !isNaN(lon)) {
                                  const result = await resolveClosestWarehouse(lat, lon);
                                  if (result) {
                                    setClosestWarehouse(result.warehouse);
                                    setUserDistanceToWarehouseKm(result.distanceKm);
                                  }
                                }
                              }
                              setHasFetchedLocation(true);
                            }}
                            isLocating={isLocLoading}
                            placeholder="Type postal code (e.g. 4310)"
                            countryCode={warehouseLocations[0]?.countryCode?.toLowerCase() || "no"}
                            disabled={isLocLoading}
                            showLocateButton={false}
                          />
                          <button
                            type="button"
                            onClick={() => setShowManualInput(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            ← Back to auto-detect
                          </button>
                        </div>
                      )}

                      {locationError && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-1.5">
                          <CiMapPin className="h-3 w-3" />
                          {locationError}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Location detected - show confirmation */
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CiMapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-foreground">
                          {userPostalCode} {userCity}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          ✓ Location confirmed
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  Shipping not available for this product
                </p>
              )}
            </div>

            {/* Shipping Results — shown to everyone once a postal code is known */}
            <AnimatePresence mode="wait">
              {showShippingDetails && userPostalCode && (closestWarehouse?.postalCode || product.shipFromPostalId) && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  className="border-t border-gray-100 dark:border-border"
                >
                  <div className="p-4 bg-white dark:bg-transparent">
                    <BringShippingDetails
                      fromPostalCode={closestWarehouse?.postalCode || product.shipFromPostalId}
                      toPostalCode={userPostalCode}
                      productSpecifications={specs}
                      warehouse={closestWarehouse ? {
                        postalCode: closestWarehouse.postalCode,
                        city: userCity || undefined,
                        distanceKm: userDistanceToWarehouseKm,
                      } : undefined}
                      userDistanceKm={userDistanceToWarehouseKm}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          ) : (
          <motion.div
            className="mt-2 overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-3 border-b border-border p-4">
              <GoPackage className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <div>
                <div className="text-sm font-semibold text-foreground">{isCreditPack ? "AI credit delivery" : "Digital delivery"}</div>
                <div className="text-xs text-muted-foreground">{isCreditPack ? "Credits appear in your AI balance after verified payment." : "Private files appear in My downloads after verified payment."}</div>
              </div>
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              <div className="bg-card p-4">
                <div className="text-xs font-medium text-muted-foreground">Access</div>
                <div className="mt-1.5 text-sm text-foreground">{isCreditPack ? `${selectedCredits} usage credits` : "Account-protected downloads"}</div>
              </div>
              <div className="bg-card p-4">
                <div className="text-xs font-medium text-muted-foreground">Delivery model</div>
                <div className="mt-1.5 text-sm text-foreground">{isCreditPack ? "Prepaid usage, no subscription" : "Time-limited links, no shipping"}</div>
              </div>
            </div>
          </motion.div>
          )}

          {/* availability + ships-from — quiet inline stats, hairline separated */}
          {!isDigitalProduct && <motion.div
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <GoPackage className="h-3.5 w-3.5" />
                Availability
              </div>
              <div className="mt-1.5 text-sm text-foreground">
                {isDigitalProduct ? (
                  product.downloadsEnabled ? (isCreditPack ? `${selectedCredits} usage credits` : "Digital download") : <span className="text-amber-600 dark:text-amber-400">Unavailable</span>
                ) : totalStock > 0 ? (
                  closestWarehouse ? (
                    stockAtClosest > 0
                      ? `${stockAtClosest} in stock nearby`
                      : "Check other locations"
                  ) : (
                    `${totalStock} in stock`
                  )
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Out of stock</span>
                )}
              </div>
              {!isDigitalProduct && totalStock > 0 && closestWarehouse && stockAtClosest !== totalStock && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {totalStock} across all locations
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CiMapPin className="h-3.5 w-3.5" />
                {isDigitalProduct ? "Delivery" : "Ships from"}
              </div>
              <div className="mt-1.5 text-sm text-foreground">
                {isDigitalProduct ? deliveryDestination : closestWarehouse?.postalCode || product.shipFromPostalId || "—"}
              </div>
            </div>
          </motion.div>}
        </motion.div>
      </motion.section>

      <section aria-labelledby="product-description-title" className="grid gap-4 border-t border-border py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
        <h2 id="product-description-title" className="text-xl font-semibold tracking-tight">About this item</h2>
        <div className="min-w-0 max-w-prose space-y-4">
          <p className="break-words text-sm leading-7 text-muted-foreground">{product.description}</p>
          {isDigitalProduct && <p className="text-sm leading-6 text-muted-foreground">
            Questions about access or a refund? <Link href="/terms" className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Read the delivery and refund terms</Link>.
            Downloading or using credits does not remove your rights if the product is faulty.
          </p>}
        </div>
      </section>

      {/* Features section */}
      {product.features && product.features.length > 0 && (
        <motion.section
          className="border-t border-border pt-6"
          initial={false}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">Highlights</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">What stands out</h2>

          {/* Group features by category key */}
          {(() => {
            const grouped = new Map<string, Feature[]>();
            for (const f of product.features!) {
              const cat = f.key?.trim() || '';
              if (!grouped.has(cat)) grouped.set(cat, []);
              grouped.get(cat)!.push(f);
            }
            
            return Array.from(grouped.entries()).map(([category, items], groupIdx) => (
              <div key={groupIdx} className={groupIdx > 0 ? 'mt-6' : 'mt-8'}>
                {category && (
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {category}
                  </h3>
                )}
                <ul className="grid gap-3 sm:grid-cols-2">
                  {items.map((feature, idx) => (
                    <li key={idx} className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-4">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                      <span className="min-w-0 break-words text-sm leading-relaxed text-muted-foreground">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ));
          })()}
        </motion.section>
      )}

      {/* Specifications */}
      <motion.section
        className="border-t border-border pt-6"
        initial={false}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">Specifications</p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Technical facts</h2>
        <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(product.specifications || []).map((spec, idx) => (
            <div key={idx} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 rounded-xl border border-border bg-card p-4">
              <dt className="min-w-0 break-words text-sm text-muted-foreground">{spec.key}</dt>
              <dd className="min-w-0 break-words text-right text-sm font-medium text-foreground">
                {spec.key.trim().toLowerCase() === 'price'
                  ? displayPrice
                  : spec.value}
                {spec.key === "Weight" && " g"}
                {["Height", "Length", "Width"].includes(spec.key) && " cm"}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm ">
            <dt className="text-sm text-muted-foreground">Updated</dt>
            <dd className="text-right text-sm font-medium text-foreground">{updatedAt}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm ">
            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="text-right text-sm font-medium text-foreground">{createdAt}</dd>
          </div>
        </dl>
      </motion.section>

      {/* Report Dialog */}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        contentType="PRODUCT"
        contentId={product.id}
        contentLabel="dette produktet"
      />
    </div>
  );
}

export default function ProductClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const pageShellClassName = "relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 lg:px-8";
  const renderShell = (children: ReactNode) => (
    <div data-product-detail className="relative isolate flex min-h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(52,211,153,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.035)_1px,transparent_1px)] bg-[size:46px_46px] opacity-20" />
      <div className={pageShellClassName}>{children}</div>
      <div className="relative pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"><SiteFooter /></div>
    </div>
  );

  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setIsLoading(true);
    setError(null);
    
    (async () => {
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, { cache: "no-store", signal: controller.signal });
        if (stopped) return;
        
        if (res.status === 404) {
          setError("not-found");
          setProduct(null);
          return;
        }
        
        if (!res.ok) {
          setError("fetch-error");
          setProduct(null);
          return;
        }
        
        const data: Product | null = await res.json();
        if (!stopped) {
          setProduct(data);
          if (!data) setError('not-found');
        }
      } catch {
        if (!stopped) {
          setError("network-error");
          setProduct(null);
        }
      } finally {
        window.clearTimeout(timeout);
        if (!stopped) setIsLoading(false);
      }
    })();
    return () => { stopped = true; window.clearTimeout(timeout); controller.abort(); };
  }, [productId, attempt]);

  if (error === "not-found")
    return renderShell(
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Product Not Found</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            This product may have been removed or the link is invalid.
          </p>
          <Link
            href="/products"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Browse Products
          </Link>
        </div>
    );

  if (error)
    return renderShell(
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            We couldn&apos;t load this product. Please try again.
          </p>
          <button
            onClick={() => { setError(null); setIsLoading(true); setAttempt(value => value + 1); }}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
    );

  if (isLoading || !product)
    return renderShell(<ProductSkeleton />);

  return renderShell(<ProductDetails key={product.id} product={product} />);
}
