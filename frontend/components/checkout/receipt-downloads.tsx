'use client';
/** @fileOverview Keep buyers on their receipt while authenticated files transfer. @stability stable */
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePrivateDownload } from '@/hooks/use-private-download';

export default function ReceiptDownloads({ files }: { files: { id: string; token: string; fileName: string }[] }) {
  const { pending, transfer, download } = usePrivateDownload();
  return <div className="mt-4 space-y-3">{files.map(file => <div key={file.id}>
    <Button variant="outline" className="h-auto min-h-12 w-full justify-start gap-3 whitespace-normal px-4 py-3 text-left"
      disabled={!!pending} onClick={() => void download(file)}>
      <Download aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{pending === file.id ? 'Downloading…' : `Download ${file.fileName}`}</span>
    </Button>
    {transfer?.id === file.id && <p role={transfer.failed ? 'alert' : 'status'} className={'mt-2 text-sm ' + (transfer.failed ? 'text-destructive' : 'text-muted-foreground')}>{transfer.message}</p>}
  </div>)}</div>;
}
