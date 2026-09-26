'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { DraftImage } from './AiDrafts';
import type { ChatImageView } from '@/lib/ai-chat/image-policy';

function LocalPreview({ image }: { image: DraftImage }) {
  const element = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(image.file);
    if (element.current) element.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [image.file]);
  // Blob previews and authenticated files must not use the public image proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={element} alt={image.file.name} width={80} height={80} className="size-20 rounded-xl bg-muted object-cover" />;
}
export function DraftImages({ images, remove, busy }: { images: DraftImage[]; remove: (id: string) => void; busy: boolean }) {
  return <div className="flex flex-wrap gap-3 px-3 pb-2" aria-label="Attached images">
    {images.map(image => <div key={image.id} className="relative shrink-0 rounded-xl border border-border">
      <LocalPreview image={image} />
      <button type="button" disabled={busy} onClick={() => remove(image.id)} aria-label={`Remove ${image.file.name}`} title={`Remove ${image.file.name}`}
        className="absolute -right-2 -top-2 grid size-11 place-items-center rounded-full bg-background/90 shadow-sm focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><X size={16} aria-hidden="true" /></button>
    </div>)}
  </div>;
}
export function MessageImages({ images }: { images: ChatImageView[] }) {
  return <div className="mb-2 flex flex-wrap justify-end gap-2">
    {images.map((image, index) => <a key={image.id} href={`/api/ai-chat/images/${image.id}`} target="_blank" rel="noopener noreferrer" className="max-w-64 overflow-hidden rounded-xl border border-border focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open attached image ${index + 1}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/ai-chat/images/${image.id}`} alt={`Attached image ${index + 1}`} width={image.width} height={image.height} loading="lazy" className="max-h-64 w-auto max-w-full object-contain" />
    </a>)}
  </div>;
}
