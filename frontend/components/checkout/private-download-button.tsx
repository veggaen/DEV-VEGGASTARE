'use client';
/** @fileOverview First-transfer reminder, not a new consent or refund eligibility decision. @stability stable */
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type File = { id: string; token: string; fileName: string; usedCount: number };

export default function PrivateDownloadButton({ file, disabled, onDownload, children, className, variant = 'default' }: {
  file: File;
  disabled?: boolean;
  onDownload: (file: File) => Promise<void>;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  const reminderSeen = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const start = () => {
    // UI convenience only. This is NOT consent, proof of delivery or a waiver.
    reminderSeen.current = true;
    setOpen(false);
    void onDownload(file);
  };
  return <>
    <Button ref={trigger} variant={variant} className={className} disabled={disabled}
      onClick={() => file.usedCount > 0 || reminderSeen.current ? start() : setOpen(true)}>{children}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideCloseButton className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-xl motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}>
        <DialogTitle className="leading-snug">Before you download</DialogTitle>
        <p className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">{file.fileName}</p>
        <DialogDescription className="text-pretty leading-relaxed">
          Starting delivery can end your change-of-mind withdrawal right only if the required consent and confirmation are in place. Faulty or misdescribed files remain eligible for review.
        </DialogDescription>
        <div className="grid grid-cols-2 gap-3">
          <DialogClose asChild><Button variant="outline" className="min-h-11">Cancel</Button></DialogClose>
          <Button className="min-h-11" disabled={disabled} onClick={start}>Download file</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
