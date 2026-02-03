"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MyFormError } from "@/components/uicustom/forms/form-error";
import { MyFormSuccess } from "@/components/uicustom/forms/form-sucess";
import { MyUpdateProductAction } from "@/actions/products";
import { useDropzone } from "react-dropzone";
import { useEdgeStore } from "@/lib/edgestore";
import { CheckCircle, ArrowLeft, Save, ExternalLink } from "lucide-react";

type ChainFamily = "EVM" | "SOLANA";
type FiatCurrency = "USD" | "NOK" | "EUR" | "GBP";

type AcceptedToken = {
  family: ChainFamily;
  symbol: string;
  decimals: number;
  tokenAddress: string | null;
  tokenMint: string | null;
};

type Product = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  priceCurrency: FiatCurrency;
  acceptedFiatCurrencies: FiatCurrency[];
  condition: string;
  stock: number;
  shipFromPostalId: string;
  image: string[];
  specifications: Array<{ key: string; value: string | number }> | null;
  userId: string;
  companyId: string | null;
  acceptedTokens: AcceptedToken[];
};

const FIAT_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "NOK", label: "NOK" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
] as const;

const CONDITION_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "AS_NEW", label: "As New" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
] as const;

function normalizeToken(row: AcceptedToken): AcceptedToken {
  return {
    family: row.family,
    symbol: String(row.symbol ?? "").toUpperCase().trim(),
    decimals: Number.isFinite(row.decimals) ? row.decimals : 18,
    tokenAddress: row.tokenAddress?.trim() ? row.tokenAddress.trim() : null,
    tokenMint: row.tokenMint?.trim() ? row.tokenMint.trim() : null,
  };
}

function normalizeSpecs(value: unknown): Array<{ key: string; value: string | number }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        key: String(x.key ?? "").trim(),
        value: typeof x.value === "number" ? x.value : String(x.value ?? ""),
      }))
      .filter((x) => x.key.length > 0);
  }
  if (typeof value === "string") {
    try {
      return normalizeSpecs(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => String(s ?? "").trim()).filter(Boolean)));
}

function clampInt(n: number, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

export default function EditProductClient({ productId }: { productId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { edgestore } = useEdgeStore();
  const formRef = useRef<HTMLDivElement>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveAction, setSaveAction] = useState<'save' | 'saveAndView'>('save');

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceText, setPriceText] = useState("0");
  const [priceCurrency, setPriceCurrency] = useState<FiatCurrency>("USD");
  const [acceptedFiatCurrencies, setAcceptedFiatCurrencies] = useState<FiatCurrency[]>(["USD"]);
  const [condition, setCondition] = useState<string>("NEW");
  const [stockText, setStockText] = useState("0");
  const [shipFromPostalId, setShipFromPostalId] = useState("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [specifications, setSpecifications] = useState<Array<{ key: string; value: string }>>([]);
  const [acceptedTokens, setAcceptedTokens] = useState<AcceptedToken[]>([]);

  const sessionUserId = (session as any)?.user?.id as string | undefined;
  const isSignedIn = Boolean(sessionUserId);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch product: ${res.statusText}`);
        const data: any = await res.json();
        if (stopped) return;

        const p: Product = {
          id: data.id,
          title: data.title,
          description: data.description ?? "",
          category: data.category ?? "",
          price: data.price,
          priceCurrency: (data.priceCurrency ?? "USD") as FiatCurrency,
          acceptedFiatCurrencies: Array.isArray(data.acceptedFiatCurrencies) ? (data.acceptedFiatCurrencies as FiatCurrency[]) : [],
          condition: data.condition,
          stock: typeof data.stock === 'number' ? data.stock : 0,
          shipFromPostalId: data.shipFromPostalId ?? "",
          image: Array.isArray(data.image) ? data.image : [],
          specifications: normalizeSpecs(data.specifications),
          userId: data.userId,
          companyId: data.companyId ?? null,
          acceptedTokens: Array.isArray(data.acceptedTokens) ? data.acceptedTokens : [],
        };

        setProduct(p);
        setTitle(p.title ?? "");
        setDescription(p.description ?? "");
        setCategory(p.category ?? "");
        setPriceText(String(p.price));
        setStockText(String(p.stock ?? 0));
        setShipFromPostalId(p.shipFromPostalId ?? "");
        setExistingImages(Array.isArray(p.image) ? p.image : []);
        setSpecifications((p.specifications ?? []).map((s) => ({ key: s.key, value: String(s.value ?? "") })));
        setPriceCurrency((p.priceCurrency ?? "USD") as FiatCurrency);
        setAcceptedFiatCurrencies(
          ((p.acceptedFiatCurrencies?.length ? p.acceptedFiatCurrencies : [p.priceCurrency ?? "USD"]) as FiatCurrency[]).filter(Boolean)
        );
        setCondition(p.condition ?? "NEW");
        setAcceptedTokens((p.acceptedTokens ?? []).map(normalizeToken));
      } catch {
        if (stopped) return;
        setProduct(null);
        setError("Failed to load product.");
      }
    })();
    return () => {
      stopped = true;
    };
  }, [productId]);

  // Cleanup previews
  useEffect(() => {
    return () => {
      newImagePreviews.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceValue = useMemo(() => {
    const n = Number(priceText);
    return Number.isFinite(n) ? n : NaN;
  }, [priceText]);

  const stockValue = useMemo(() => {
    const n = Number(stockText);
    return Number.isFinite(n) ? clampInt(n, 0, 1_000_000) : NaN;
  }, [stockText]);

  const MAX_IMAGES = 8;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const currentCount = existingImages.length + newImages.length;
      const remaining = Math.max(0, MAX_IMAGES - currentCount);
      const nextFiles = acceptedFiles.slice(0, remaining);
      if (!nextFiles.length) return;

      setNewImages((prev) => [...prev, ...nextFiles]);
      const previews = nextFiles.map((f) => URL.createObjectURL(f));
      setNewImagePreviews((prev) => [...prev, ...previews]);
    },
    [existingImages.length, newImages.length]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  const removeExistingImage = (url: string) => {
    setExistingImages((prev) => prev.filter((x) => x !== url));
  };

  const removeNewImage = (idx: number) => {
    const url = newImagePreviews[idx];
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    setNewImages((prev) => prev.filter((_, i) => i !== idx));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadNewImages = async (): Promise<string[]> => {
    if (!newImages.length) return [];
    setIsUploadingImages(true);
    try {
      const urls: string[] = [];
      for (const file of newImages) {
        const res = await edgestore.myPublicImages.upload({ file });
        urls.push(res.url);
      }
      return urls;
    } finally {
      setIsUploadingImages(false);
    }
  };

  const onSave = async () => {
    setError(undefined);
    setSuccess(undefined);

    if (!isSignedIn) {
      setError("Please sign in to edit products.");
      return;
    }

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    if (!category.trim()) {
      setError("Category is required.");
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError("Price must be a valid number.");
      return;
    }

    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setError("Stock must be a valid number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedNewUrls = await uploadNewImages();
      const finalImages = uniqueStrings([...existingImages, ...uploadedNewUrls]);

      const normalizedSpecs = specifications
        .map((s) => ({ key: String(s.key ?? "").trim(), value: String(s.value ?? "").trim() }))
        .filter((s) => s.key.length > 0);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        price: priceValue,
        priceCurrency,
        acceptedFiatCurrencies: acceptedFiatCurrencies.length ? acceptedFiatCurrencies : [priceCurrency],
        condition: condition as any,
        stock: stockValue,
        shipFromPostalId: shipFromPostalId.trim(),
        image: finalImages,
        specifications: normalizedSpecs,
        acceptedTokens: acceptedTokens.map(normalizeToken),
      };

      const res = await MyUpdateProductAction(productId, payload);
      if ("error" in res) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      // If save and view, redirect immediately
      if (saveAction === 'saveAndView') {
        router.push(`/products/${productId}`);
        return;
      }
      
      // Otherwise show success message
      setSuccess(res.success);
      router.refresh();
    } catch {
      setError("Failed to update product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTokenRow = () => {
    setAcceptedTokens((prev) => [
      ...prev,
      { family: "EVM", symbol: "ETH", decimals: 18, tokenAddress: null, tokenMint: null },
    ]);
  };

  const removeTokenRow = (index: number) => {
    setAcceptedTokens((prev) => prev.filter((_, i) => i !== index));
  };

  if (!product && !error) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" ref={formRef}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="mx-auto w-full max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/products/${productId}`}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Link>
              </Button>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Editing</div>
                <div className="text-sm font-medium truncate">{product?.title ?? ""}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => { setSaveAction('save'); onSave(); }} 
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting && saveAction === 'save' ? "Saving…" : "Save"}
              </Button>
              <Button 
                type="button" 
                size="sm"
                onClick={() => { setSaveAction('saveAndView'); onSave(); }} 
                disabled={isSubmitting}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {isSubmitting && saveAction === 'saveAndView' ? "Saving…" : "Save & View"}
              </Button>
            </div>
          </div>
          
          {/* Inline feedback */}
          {(error || success) && (
            <div className="mt-2">
              {error && <MyFormError message={error} />}
              {success && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  {success}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form Content - Compact 2-column layout on desktop */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Left Column - Basic Info */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="text-sm font-semibold">Details</div>
                
                <div className="space-y-1">
                  <div className="text-xs font-medium text-foreground/80">Title</div>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-foreground/80">Description</div>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Description" className="resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground/80">Category</div>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground/80">Condition</div>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground/80">Stock</div>
                    <Input value={stockText} onChange={(e) => setStockText(e.target.value)} inputMode="numeric" placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground/80">Ship-from postal</div>
                    <Input value={shipFromPostalId} onChange={(e) => setShipFromPostalId(e.target.value)} placeholder="e.g. 0579" />
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="text-sm font-semibold">Pricing</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground/80">Price</div>
                    <Input value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground/80">Currency</div>
                    <Select
                      value={priceCurrency}
                      onValueChange={(v) => {
                        const next = v as FiatCurrency;
                        setPriceCurrency(next);
                        setAcceptedFiatCurrencies((prev) => (prev.includes(next) ? prev : [next, ...prev]));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-foreground/80">Accepted fiat</div>
                  <div className="flex flex-wrap gap-1">
                    {FIAT_OPTIONS.map((opt) => {
                      const checked = acceptedFiatCurrencies.includes(opt.value);
                      return (
                        <label key={opt.value} className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs cursor-pointer hover:bg-muted/50">
                          <input
                            type="checkbox"
                            checked={checked}
                            className="h-3 w-3"
                            onChange={(e) => {
                              const nextChecked = e.target.checked;
                              setAcceptedFiatCurrencies((prev) => {
                                if (nextChecked) return Array.from(new Set([opt.value, ...prev]));
                                const filtered = prev.filter((c) => c !== opt.value);
                                return filtered.includes(priceCurrency) ? filtered : [priceCurrency, ...filtered];
                              });
                            }}
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Images, Specs, Web3 */}
            <div className="space-y-4">
              {/* Images */}
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Images</div>
                  <div className="text-[11px] text-muted-foreground">{existingImages.length + newImagePreviews.length}/{MAX_IMAGES}</div>
                </div>

                <div
                  {...getRootProps()}
                  className="cursor-pointer rounded border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground text-center hover:bg-muted/50 transition-colors"
                >
                  <input {...getInputProps()} />
                  Drop or click to add images
                </div>

                {(existingImages.length + newImagePreviews.length) > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {existingImages.map((url) => (
                      <div key={url} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted">
                        <Image 
                          src={url} 
                          alt="Product" 
                          fill 
                          className="object-cover"
                          sizes="80px"
                        />
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="sm" 
                          className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeExistingImage(url)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    {newImagePreviews.map((url, idx) => (
                      <div key={url} className="relative group aspect-square rounded-md overflow-hidden border border-border border-dashed bg-muted">
                        <Image 
                          src={url} 
                          alt={`New image ${idx + 1}`} 
                          fill 
                          className="object-cover"
                          sizes="80px"
                        />
                        <div className="absolute inset-0 bg-primary/10" />
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="sm" 
                          className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeNewImage(idx)}
                        >
                          ×
                        </Button>
                        <span className="absolute bottom-1 left-1 text-[10px] bg-primary text-primary-foreground px-1 rounded">New</span>
                      </div>
                    ))}
                  </div>
                )}
                {isUploadingImages && <div className="text-xs text-muted-foreground">Uploading…</div>}
              </div>

              {/* Specifications - Compact */}
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Specifications</div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSpecifications((prev) => [...prev, { key: "", value: "" }])}>
                    + Add
                  </Button>
                </div>

                {specifications.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No specifications</div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {specifications.map((s, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr,1fr,auto] gap-1 items-center">
                        <Input
                          value={s.key}
                          onChange={(e) => setSpecifications((prev) => { const next = prev.slice(); next[idx] = { ...next[idx], key: e.target.value }; return next; })}
                          placeholder="Key"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={s.value}
                          onChange={(e) => setSpecifications((prev) => { const next = prev.slice(); next[idx] = { ...next[idx], value: e.target.value }; return next; })}
                          placeholder="Value"
                          className="h-8 text-xs"
                        />
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSpecifications((prev) => prev.filter((_, i) => i !== idx))}>×</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Web3 Payments - Accordion */}
              <Accordion type="single" collapsible className="rounded-lg border border-border bg-background">
                <AccordionItem value="web3" className="border-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex flex-col text-left">
                      <div className="text-sm font-semibold">Web3 Payments</div>
                      <div className="text-[11px] text-muted-foreground">Optional crypto tokens</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Accepted tokens</div>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addTokenRow}>+ Add token</Button>
                      </div>

                      {acceptedTokens.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No tokens configured</div>
                      ) : (
                        <div className="space-y-2">
                          {acceptedTokens.map((t, idx) => (
                            <div key={`${t.family}:${t.symbol}:${idx}`} className="space-y-1 p-2 rounded border border-border">
                              <div className="grid grid-cols-[100px,1fr,auto] gap-2 items-center">
                                <Select
                                  value={t.family}
                                  onValueChange={(v) => setAcceptedTokens((prev) => { const next = prev.slice(); next[idx] = { ...next[idx], family: v as ChainFamily }; return next; })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="EVM">EVM</SelectItem>
                                    <SelectItem value="SOLANA">Solana</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={t.symbol}
                                  onChange={(e) => setAcceptedTokens((prev) => { const next = prev.slice(); next[idx] = { ...next[idx], symbol: e.target.value }; return next; })}
                                  placeholder="Symbol"
                                  className="h-8 text-xs"
                                />
                                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeTokenRow(idx)}>×</Button>
                              </div>
                              <Input
                                value={t.family === "EVM" ? (t.tokenAddress ?? "") : (t.tokenMint ?? "")}
                                onChange={(e) => setAcceptedTokens((prev) => {
                                  const next = prev.slice();
                                  const value = e.target.value;
                                  next[idx] = { ...next[idx], tokenAddress: t.family === "EVM" ? value : null, tokenMint: t.family === "SOLANA" ? value : null };
                                  return next;
                                })}
                                placeholder={t.family === "EVM" ? "Token address (0x…)" : "Token mint"}
                                className="h-8 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
