'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { FaDownload, FaCheckCircle, FaClock, FaBan } from 'react-icons/fa';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import Image from 'next/image';

const UNLIMITED_DOWNLOAD_USES = 2_147_483_647;

interface DownloadToken {
  id: string;
  token: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
  digitalAsset: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
  order: {
    id: string;
    createdAt: string;
  };
  product: {
    id: string;
    title: string;
    image: string[];
  };
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusInfo(token: DownloadToken) {
  if (token.isRevoked) {
    return { status: 'revoked', label: 'Tilbakekalt', color: 'text-red-500', icon: FaBan };
  }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    return { status: 'expired', label: 'Utløpt', color: 'text-amber-500', icon: FaClock };
  }
  if (token.usedCount >= token.maxUses) {
    return { status: 'exhausted', label: 'Brukt opp', color: 'text-gray-500', icon: FaCheckCircle };
  }
  return { status: 'active', label: 'Aktiv', color: 'text-emerald-500', icon: FaCheckCircle };
}

function formatDownloadUsage(token: DownloadToken) {
  if (token.maxUses >= UNLIMITED_DOWNLOAD_USES) {
    return `${token.usedCount} av ubegrenset brukt`;
  }
  return `${token.usedCount} av ${token.maxUses} brukt`;
}

export default function MyDownloadsPage() {
  const user = useCurrentUser();
  const [downloads, setDownloads] = useState<DownloadToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDownloads() {
      if (!user?.id) return;
      
      try {
        const response = await fetch('/api/my-downloads');
        if (!response.ok) {
          throw new Error('Failed to fetch downloads');
        }
        const data = await response.json();
        setDownloads(data.downloads || []);
      } catch (err) {
        console.error('Error fetching downloads:', err);
        setError('Kunne ikke hente nedlastinger');
      } finally {
        setLoading(false);
      }
    }

    fetchDownloads();
  }, [user?.id]);

  const handleDownload = async (token: DownloadToken) => {
    const statusInfo = getStatusInfo(token);
    if (statusInfo.status !== 'active') {
      return;
    }

    setDownloadingId(token.id);
    try {
      // Open download in new tab/initiate download
      window.open(`/api/download/${token.token}`, '_blank');
      
      // Refresh the list after a short delay to update usage count
      setTimeout(async () => {
        const response = await fetch('/api/my-downloads');
        if (response.ok) {
          const data = await response.json();
          setDownloads(data.downloads || []);
        }
        setDownloadingId(null);
      }, 2000);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Mine nedlastinger</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Mine nedlastinger</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-500">
          {error}
        </div>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Mine nedlastinger</h1>
        <div className="bg-muted/30 rounded-lg p-8 text-center">
          <FaDownload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">Ingen nedlastinger ennå</h2>
          <p className="text-muted-foreground">
            Når du kjøper digitale produkter, vil de vises her.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Mine nedlastinger</h1>
      
      <div className="space-y-4">
        {downloads.map((token) => {
          const statusInfo = getStatusInfo(token);
          const StatusIcon = statusInfo.icon;
          const isDownloadable = statusInfo.status === 'active';
          
          return (
            <div 
              key={token.id} 
              className="bg-card border border-border rounded-lg p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Product Image */}
                {token.product.image?.[0] && (
                  <div className="shrink-0 relative w-full sm:w-24 h-32 sm:h-24">
                    <Image
                      src={token.product.image[0]}
                      alt={token.product.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 96px"
                      className="object-cover rounded-lg"
                    />
                  </div>
                )}
                
                {/* Product Info */}
                <div className="grow min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-lg truncate">{token.product.title}</h3>
                    <div className={`flex items-center gap-1.5 text-sm ${statusInfo.color}`}>
                      <StatusIcon className="h-4 w-4" />
                      <span>{statusInfo.label}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground mb-4">
                    <p>
                      <span className="font-medium">Fil:</span> {token.digitalAsset.fileName}
                      <span className="ml-2">({formatFileSize(token.digitalAsset.fileSize)})</span>
                    </p>
                    <p>
                      <span className="font-medium">Nedlastinger:</span> {formatDownloadUsage(token)}
                    </p>
                    {token.expiresAt && (
                      <p>
                        <span className="font-medium">Utløper:</span>{' '}
                        {format(new Date(token.expiresAt), 'PPP', { locale: nb })}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Kjøpt:</span>{' '}
                      {format(new Date(token.order.createdAt), 'PPP', { locale: nb })}
                    </p>
                  </div>
                  
                  {/* Download Button */}
                  <button
                    onClick={() => handleDownload(token)}
                    disabled={!isDownloadable || downloadingId === token.id}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                      transition-colors duration-150
                      ${isDownloadable 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' 
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }
                      disabled:opacity-60
                    `}
                  >
                    {downloadingId === token.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Starter nedlasting...
                      </>
                    ) : (
                      <>
                        <FaDownload className="h-4 w-4" />
                        Last ned
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
