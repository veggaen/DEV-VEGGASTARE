/**
 * @fileOverview ShippingMethodSelector — lets customers pick a Bring
 *   shipping method during checkout. Fetches live rates from the Bring
 *   Shipping Guide via `/api/bring-shipping`, displays pricing + estimated
 *   delivery, and optionally shows a pickup-point picker for services
 *   that deliver to pickup locations.
 * @stability maturing
 */
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════ Types ═══════════════════════════ */

/** A single Bring shipping product/service returned by the API. */
export interface ShippingOption {
  /** Bring service code, e.g. "5800", "SERVICEPAKKE" */
  serviceCode: string;
  /** Human-readable name, e.g. "Klimanøytral Servicepakke" */
  serviceName: string;
  /** Price including VAT in NOK */
  priceWithVat: number;
  /** Price excluding VAT in NOK */
  priceWithoutVat: number;
  /** Estimated delivery date ISO string */
  estimatedDelivery?: string;
  /** Expected delivery description */
  deliveryDescription?: string;
  /** Whether this service delivers to a pickup point */
  isPickupPoint?: boolean;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  distanceInKm?: number;
  openingHoursNorwegian?: string;
  type?: string;
}

/** What the parent (checkout) receives when user picks a method. */
export interface SelectedShipping {
  serviceCode: string;
  serviceName: string;
  /** Cost in NOK (with VAT) */
  priceNOK: number;
  /** Cost in USD (converted) — used for the order total */
  priceUSD: number;
  estimatedDelivery?: string;
  pickupPoint?: PickupPoint | null;
}

interface ShippingMethodSelectorProps {
  /** Seller / warehouse postal code. */
  fromPostalCode: string;
  /** Buyer postal code. */
  toPostalCode: string;
  /** Approximate total weight in grams (defaults to 1000). */
  totalWeightGrams?: number;
  /** NOK-per-USD exchange rate (for price conversion display). */
  nokPerUsd?: number;
  /** Callback when user selects a shipping method. */
  onSelect: (shipping: SelectedShipping | null) => void;
  /** Currently selected service code (controlled mode). */
  selectedServiceCode?: string | null;
  /** Whether all items are digital (skip shipping). */
  allDigital?: boolean;
}

/* ═══════════════════════════ Helpers ═══════════════════════════ */

/** Fallback NOK→USD conversion */
const DEFAULT_NOK_PER_USD = 11.0;

/** Default package dimensions (cm) for rate estimation. */
const DEFAULT_PKG = { length: 30, width: 20, height: 10, grossWeight: 1 };

/** Service codes that typically deliver to pickup points. */
const PICKUP_SERVICE_CODES = new Set([
  "5800",            // Pakke til hentested
  "SERVICEPAKKE",
  "5000",            // Pakke i postkassen (mailbox, but Bring treats it as pickup)
]);

function formatDeliveryDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("nb-NO", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function nokToUsd(nok: number, nokPerUsd: number): number {
  return nok / nokPerUsd;
}

/* ═══════════════════════════ Component ═══════════════════════════ */

export function ShippingMethodSelector({
  fromPostalCode,
  toPostalCode,
  totalWeightGrams = 1000,
  nokPerUsd = DEFAULT_NOK_PER_USD,
  onSelect,
  selectedServiceCode,
  allDigital = false,
}: ShippingMethodSelectorProps) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(
    selectedServiceCode ?? null
  );

  // Pickup points state
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<PickupPoint | null>(null);

  /* ── Fetch shipping rates ── */
  const fetchRates = useCallback(async () => {
    if (!fromPostalCode || !toPostalCode || allDigital) return;
    setLoading(true);
    setError(null);

    try {
      const weightKg = Math.max(0.1, totalWeightGrams / 1000);
      const res = await fetch("/api/bring-shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPostalCode,
          toPostalCode,
          fromCountryCode: "NO",
          toCountryCode: "NO",
          packages: [
            {
              ...DEFAULT_PKG,
              grossWeight: weightKg,
            },
          ],
          language: "no",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Kunne ikke hente fraktpriser");
      }

      const data = await res.json();

      // Handle both Integration Core (products array) and Bring direct (consignments) shapes
      const products: ShippingOption[] = [];

      if (Array.isArray(data.products)) {
        // Integration Core response
        for (const p of data.products) {
          if (!p.id && !p.productionCode) continue;
          products.push({
            serviceCode: p.id || p.productionCode,
            serviceName:
              p.guiInformation?.displayName ||
              p.guiInformation?.productName ||
              p.displayName ||
              p.id,
            priceWithVat:
              p.price?.listPrice?.priceWithAdditionalServices?.amountWithVAT ??
              p.price?.netPrice?.priceWithAdditionalServices?.amountWithVAT ??
              p.priceWithVat ??
              0,
            priceWithoutVat:
              p.price?.listPrice?.priceWithAdditionalServices?.amountWithoutVAT ??
              p.price?.netPrice?.priceWithAdditionalServices?.amountWithoutVAT ??
              p.priceWithoutVat ??
              0,
            estimatedDelivery:
              p.expectedDelivery?.workingDays ??
              p.expectedDelivery?.formattedExpectedDeliveryDate ??
              p.estimatedDelivery ??
              undefined,
            deliveryDescription:
              p.guiInformation?.descriptionText ??
              p.deliveryDescription ??
              undefined,
            isPickupPoint: PICKUP_SERVICE_CODES.has(p.id || p.productionCode),
          });
        }
      } else if (Array.isArray(data.consignments)) {
        // Direct Bring Shipping Guide response
        for (const c of data.consignments) {
          for (const p of c.products || []) {
            if (!p.id && !p.productionCode) continue;
            const price = p.price?.listPrice || p.price?.netPrice || {};
            products.push({
              serviceCode: p.id || p.productionCode,
              serviceName:
                p.guiInformation?.displayName ||
                p.guiInformation?.productName ||
                p.id,
              priceWithVat:
                price?.priceWithAdditionalServices?.amountWithVAT ?? 0,
              priceWithoutVat:
                price?.priceWithAdditionalServices?.amountWithoutVAT ?? 0,
              estimatedDelivery:
                p.expectedDelivery?.workingDays ??
                p.expectedDelivery?.formattedExpectedDeliveryDate ??
                undefined,
              deliveryDescription:
                p.guiInformation?.descriptionText ?? undefined,
              isPickupPoint: PICKUP_SERVICE_CODES.has(
                p.id || p.productionCode
              ),
            });
          }
        }
      }

      // Sort by price (cheapest first)
      products.sort((a, b) => a.priceWithVat - b.priceWithVat);
      setOptions(products);

      // Auto-select cheapest if nothing selected
      if (products.length > 0 && !selectedCode) {
        const first = products[0];
        setSelectedCode(first.serviceCode);
        onSelect({
          serviceCode: first.serviceCode,
          serviceName: first.serviceName,
          priceNOK: first.priceWithVat,
          priceUSD: nokToUsd(first.priceWithVat, nokPerUsd),
          estimatedDelivery: first.estimatedDelivery,
          pickupPoint: null,
        });
      }
    } catch (e: any) {
      console.error("[ShippingMethodSelector] Error:", e);
      setError(e.message || "Feil ved henting av fraktpriser");
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [fromPostalCode, toPostalCode, totalWeightGrams, allDigital, nokPerUsd, onSelect, selectedCode]);

  // Fetch rates when postal codes become available
  useEffect(() => {
    if (fromPostalCode && toPostalCode && !allDigital) {
      fetchRates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPostalCode, toPostalCode, totalWeightGrams, allDigital]);

  /* ── Fetch pickup points when a pickup service is selected ── */
  const fetchPickupPoints = useCallback(async () => {
    if (!toPostalCode) return;
    setPickupLoading(true);
    try {
      const params = new URLSearchParams({
        postalCode: toPostalCode,
        country: "NO",
        limit: "5",
      });
      const res = await fetch(`/api/bring-pickup-points?${params}`);
      if (!res.ok) throw new Error("Kunne ikke hente hentesteder");
      const data = await res.json();
      setPickupPoints(data.pickupPoints || []);
    } catch (e) {
      console.error("[ShippingMethodSelector] Pickup points error:", e);
      setPickupPoints([]);
    } finally {
      setPickupLoading(false);
    }
  }, [toPostalCode]);

  // Currently selected option
  const selectedOption = useMemo(
    () => options.find((o) => o.serviceCode === selectedCode) ?? null,
    [options, selectedCode]
  );

  // Load pickup points when a pickup service is selected
  useEffect(() => {
    if (selectedOption?.isPickupPoint && toPostalCode) {
      fetchPickupPoints();
      setSelectedPickupPoint(null);
    } else {
      setPickupPoints([]);
      setSelectedPickupPoint(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, toPostalCode]);

  /* ── Handle user selecting a method ── */
  const handleSelect = useCallback(
    (opt: ShippingOption) => {
      setSelectedCode(opt.serviceCode);
      setSelectedPickupPoint(null);
      onSelect({
        serviceCode: opt.serviceCode,
        serviceName: opt.serviceName,
        priceNOK: opt.priceWithVat,
        priceUSD: nokToUsd(opt.priceWithVat, nokPerUsd),
        estimatedDelivery: opt.estimatedDelivery,
        pickupPoint: null,
      });
    },
    [nokPerUsd, onSelect]
  );

  const handlePickupSelect = useCallback(
    (pp: PickupPoint) => {
      setSelectedPickupPoint(pp);
      if (selectedOption) {
        onSelect({
          serviceCode: selectedOption.serviceCode,
          serviceName: selectedOption.serviceName,
          priceNOK: selectedOption.priceWithVat,
          priceUSD: nokToUsd(selectedOption.priceWithVat, nokPerUsd),
          estimatedDelivery: selectedOption.estimatedDelivery,
          pickupPoint: pp,
        });
      }
    },
    [selectedOption, nokPerUsd, onSelect]
  );

  /* ── Digital-only: skip shipping ── */
  if (allDigital) {
    return (
      <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">📥</span>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Digital levering — ingen frakt nødvendig
          </p>
        </div>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
          Du vil motta nedlastingslenker etter betaling.
        </p>
      </div>
    );
  }

  /* ── No postal codes yet ── */
  if (!fromPostalCode || !toPostalCode) {
    return (
      <div className="mt-4 p-4 bg-muted/30 dark:bg-white/[0.02] rounded-lg border border-border dark:border-white/10">
        <p className="text-sm text-muted-foreground">
          Velg leveringsadresse for å se fraktalternativer
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
        📦 Fraktmetode
      </h3>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 p-4 bg-muted/30 dark:bg-white/[0.02] rounded-lg border border-border dark:border-white/10">
          <motion.div
            className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <span className="text-sm text-muted-foreground">Henter fraktpriser fra Bring…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-500/30">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={fetchRates}
            className="mt-2 text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
          >
            Prøv igjen
          </button>
        </div>
      )}

      {/* Options list */}
      {!loading && !error && options.length > 0 && (
        <div className="space-y-2">
          {options.map((opt) => {
            const isSelected = opt.serviceCode === selectedCode;
            const priceUsd = nokToUsd(opt.priceWithVat, nokPerUsd);
            return (
              <motion.button
                key={opt.serviceCode}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  isSelected
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 dark:border-emerald-500/50 ring-1 ring-emerald-500/30"
                    : "bg-muted/20 dark:bg-white/[0.02] border-border dark:border-white/10 hover:border-emerald-500/50"
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {opt.serviceName}
                        {opt.isPickupPoint && (
                          <span className="ml-2 text-xs text-muted-foreground">(hentested)</span>
                        )}
                      </p>
                      {opt.deliveryDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {opt.deliveryDescription}
                        </p>
                      )}
                      {opt.estimatedDelivery && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Estimert levering: {formatDeliveryDate(opt.estimatedDelivery)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground text-sm">
                      kr {opt.priceWithVat.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ~${priceUsd.toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* No options found */}
      {!loading && !error && options.length === 0 && fromPostalCode && toPostalCode && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-500/20">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Ingen fraktalternativer tilgjengelig for denne ruten.
          </p>
        </div>
      )}

      {/* Pickup point selector */}
      <AnimatePresence>
        {selectedOption?.isPickupPoint && !loading && (
          <motion.div
            className="mt-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h4 className="text-sm font-medium text-foreground mb-2">
              📍 Velg hentested
            </h4>

            {pickupLoading && (
              <div className="flex items-center gap-2 p-3 bg-muted/20 dark:bg-white/[0.02] rounded-lg">
                <motion.div
                  className="h-3 w-3 rounded-full border-2 border-emerald-500 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
                <span className="text-xs text-muted-foreground">Henter hentesteder…</span>
              </div>
            )}

            {!pickupLoading && pickupPoints.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pickupPoints.map((pp) => {
                  const isPickupSelected = selectedPickupPoint?.id === pp.id;
                  return (
                    <button
                      key={pp.id}
                      type="button"
                      onClick={() => handlePickupSelect(pp)}
                      className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                        isPickupSelected
                          ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-400 dark:border-emerald-500/40"
                          : "bg-muted/10 dark:bg-white/[0.01] border-border/50 dark:border-white/5 hover:border-emerald-500/30"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{pp.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {pp.address}, {pp.postalCode} {pp.city}
                          </p>
                          {pp.openingHoursNorwegian && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {pp.openingHoursNorwegian}
                            </p>
                          )}
                        </div>
                        {pp.distanceInKm != null && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {pp.distanceInKm} km
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!pickupLoading && pickupPoints.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Ingen hentesteder funnet nær {toPostalCode}.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
