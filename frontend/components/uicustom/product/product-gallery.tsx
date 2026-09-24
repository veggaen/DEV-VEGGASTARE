'use client';
/** @fileOverview Stable product media with keyboard/touch controls and an exact credit preview. @stability experimental */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, Sparkles } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

export default function ProductGallery({ images, title, credits }: {
  images: string[]; title: string; credits?: number;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    update(); api.on('select', update); api.on('reInit', update);
    return () => { api.off('select', update); api.off('reInit', update); };
  }, [api]);

  if (credits !== undefined) return <figure aria-label="Selected credit amount" className="overflow-hidden rounded-xl border border-border bg-card p-3">
    <AspectRatio ratio={3 / 2}>
      <div className="flex h-full min-w-0 flex-col justify-between rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-5 sm:p-8">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          <span>Veggat AI</span><Sparkles aria-hidden className="size-6 shrink-0" />
        </div>
        <div>
          <p data-credit-preview className="text-[clamp(2.75rem,10vw,5.5rem)] font-semibold leading-none tracking-tight tabular-nums">{new Intl.NumberFormat('en-US').format(credits)}</p>
          <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 sm:text-lg">Prepaid usage credits</p>
        </div>
        <p className="border-t border-emerald-500/20 pt-3 text-xs leading-5 text-muted-foreground">One-time purchase. No automatic top-ups.</p>
      </div>
    </AspectRatio>
  </figure>;

  if (!images.length) return <div className="rounded-xl border border-border bg-card p-3">
    <AspectRatio ratio={3 / 2}><div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <ImageIcon aria-hidden className="size-8" /><p className="text-sm">No preview image available</p>
    </div></AspectRatio>
  </div>;

  return <div className="min-w-0 space-y-3" data-product-gallery>
    <div className="overflow-hidden rounded-xl border border-border bg-card p-3">
      <Carousel setApi={setApi} tabIndex={0} aria-label="Product images"
        className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
        <CarouselContent>
          {images.map((src, index) => <CarouselItem key={`${src}-${index}`} aria-label={`Image ${index + 1} of ${images.length}`}>
            <AspectRatio ratio={3 / 2}>
              <Image src={src} alt={`${title} — image ${index + 1}`} fill priority={index === 0}
                sizes="(max-width: 639px) calc(100vw - 58px), (max-width: 1023px) calc(100vw - 74px), (max-width: 1279px) 53vw, 664px"
                className="rounded-lg object-contain" />
            </AspectRatio>
          </CarouselItem>)}
        </CarouselContent>
        {images.length > 1 && <>
          <CarouselPrevious aria-label="Previous product image" className="flex size-11 border border-border bg-card text-foreground disabled:opacity-30" />
          <CarouselNext aria-label="Next product image" className="flex size-11 border border-border bg-card text-foreground disabled:opacity-30" />
        </>}
      </Carousel>
    </div>
    {images.length > 1 && <div className="flex min-w-0 items-center gap-3">
      <div role="group" aria-label="Choose product image" className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain p-1">
        {images.map((src, index) => <button key={`${src}-${index}`} type="button" aria-label={`View product image ${index + 1}`}
          aria-pressed={selected === index} onClick={() => api?.scrollTo(index)}
          className={cn('relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-card p-1 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            selected === index ? 'border-emerald-500' : 'border-border hover:border-muted-foreground')}>
          <Image src={src} alt="" fill sizes="80px" className="object-contain p-1" />
        </button>)}
      </div>
      <p aria-live="polite" aria-atomic="true" className="shrink-0 text-xs tabular-nums text-muted-foreground">{selected + 1} / {images.length}</p>
    </div>}
  </div>;
}
