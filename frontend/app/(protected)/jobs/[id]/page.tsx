'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow, format } from 'date-fns';
import { FiArrowLeft, FiExternalLink, FiFileText, FiTruck, FiDollarSign, FiMessageSquare } from 'react-icons/fi';

interface UserSummary {
  id: string;
  name: string | null;
  image: string | null;
}

// Security: Validate and sanitize user-provided URLs
function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  // Only allow http/https URLs - block javascript:, data:, vbscript:, etc.
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  try {
    new URL(url); // Validate URL format
    return true;
  } catch {
    return false;
  }
}

interface JobRequest {
  id: string;
  title: string;
  descriptions: string[];
  images: string[];
  links: string[];
  docs: string[];
  price: number | null;
  negotiable: boolean | null;
  paymentMethod: string | null;
  delivery: string | null;
  additionalNotes: string | null;
  createdAt: string;
  user: UserSummary;
}

export default function JobDetailPage() {
  const reduceMotion = useReducedMotion();
  const params = useParams();
  const { id } = params;
  const [jobRequest, setJobRequest] = useState<JobRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const fetchJobRequest = async () => {
        try {
          const response = await fetch(`/api/job-requests/${id}`);
          if (!response.ok) throw new Error('Failed to fetch job request');
          const data = await response.json();
          setJobRequest(data);
          if (data.images?.length > 0) {
            setSelectedImage(data.images[0]);
          }
        } catch (error) {
          console.error('Error fetching job request:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchJobRequest();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
        <div className="relative mx-auto w-full max-w-5xl px-6 py-10 lg:py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded bg-white/10" />
            <div className="h-12 w-3/4 rounded bg-white/10" />
            <div className="aspect-video w-full rounded-2xl bg-white/5" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-white/5" />
              <div className="h-4 w-5/6 rounded bg-white/5" />
              <div className="h-4 w-4/6 rounded bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!jobRequest) {
    return (
      <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
        <div className="relative mx-auto w-full max-w-5xl px-6 py-10 lg:py-12">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <svg className="h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-white/80">Request not found</p>
            <p className="mt-1 text-sm text-white/50">This request may have been removed or doesn&apos;t exist.</p>
            <Link
              href="/jobs"
              className="mt-6 inline-flex rounded-xl bg-indigo-500/20 px-5 py-2.5 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30"
            >
              Back to Job Board
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/5" />
        <motion.div
          className="absolute -right-20 top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -10, 0], y: [0, 8, 0], opacity: [0.1, 0.18, 0.1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "radial-gradient(closest-side, rgba(99,102,241,0.15), rgba(56,189,248,0.08), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-6 py-10 lg:py-12">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Back Link */}
          <Link 
            href="/jobs" 
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to Job Board
          </Link>

          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {jobRequest.user?.image && (
                <Image
                  src={jobRequest.user.image}
                  alt={jobRequest.user.name || 'User'}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white/10"
                />
              )}
              <div>
                <p className="text-sm font-medium text-white/80">{jobRequest.user?.name || 'Anonymous'}</p>
                <p className="text-xs text-white/50">
                  Posted {formatDistanceToNow(new Date(jobRequest.createdAt), { addSuffix: true })}
                  <span className="mx-1.5">·</span>
                  {format(new Date(jobRequest.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            
            <h1 className="text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">
              {jobRequest.title || `Request #${jobRequest.id.slice(0, 8)}`}
            </h1>
            
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {jobRequest.negotiable && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  Negotiable
                </span>
              )}
              {jobRequest.price && (
                <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                  Budget: ${jobRequest.price}
                </span>
              )}
              {jobRequest.delivery && (
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                  {jobRequest.delivery}
                </span>
              )}
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-5">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Images */}
              {jobRequest.images.length > 0 && (
                <div className="space-y-3">
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                    {selectedImage && (
                      <Image
                        src={selectedImage}
                        alt="Request image"
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                  {jobRequest.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {jobRequest.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(img)}
                          className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg transition-all ${
                            selectedImage === img 
                              ? 'ring-2 ring-indigo-400' 
                              : 'ring-1 ring-white/10 hover:ring-white/30'
                          }`}
                        >
                          <Image src={img} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Descriptions */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Description</h2>
                {jobRequest.descriptions.map((desc, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Additional Notes */}
              {jobRequest.additionalNotes && (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
                    <FiMessageSquare className="h-4 w-4" />
                    Additional Notes
                  </h2>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                      {jobRequest.additionalNotes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-2 space-y-6">
              {/* Contact Card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">Interested in this request?</h3>
                <Link
                  href={`/conversations?userId=${jobRequest.user?.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
                >
                  <FiMessageSquare className="h-4 w-4" />
                  Contact Requester
                </Link>
              </div>

              {/* Details Card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white/80">Request Details</h3>
                
                {jobRequest.price && (
                  <div className="flex items-center gap-3 text-sm">
                    <FiDollarSign className="h-4 w-4 text-white/40" />
                    <div>
                      <p className="text-white/50">Budget</p>
                      <p className="text-white/90">${jobRequest.price}</p>
                    </div>
                  </div>
                )}
                
                {jobRequest.delivery && (
                  <div className="flex items-center gap-3 text-sm">
                    <FiTruck className="h-4 w-4 text-white/40" />
                    <div>
                      <p className="text-white/50">Delivery</p>
                      <p className="text-white/90">{jobRequest.delivery}</p>
                    </div>
                  </div>
                )}

                {jobRequest.paymentMethod && (
                  <div className="flex items-center gap-3 text-sm">
                    <FiDollarSign className="h-4 w-4 text-white/40" />
                    <div>
                      <p className="text-white/50">Payment Method</p>
                      <p className="text-white/90">{jobRequest.paymentMethod}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Links */}
              {jobRequest.links.filter(l => l && isSafeUrl(l)).length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-white/80">Reference Links</h3>
                  {jobRequest.links.filter(l => l && isSafeUrl(l)).map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-indigo-300 transition-colors hover:bg-white/10"
                    >
                      <FiExternalLink className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Documents */}
              {jobRequest.docs.filter(d => d && isSafeUrl(d)).length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-white/80">Documents</h3>
                  {jobRequest.docs.filter(d => d && isSafeUrl(d)).map((doc, idx) => (
                    <a
                      key={idx}
                      href={doc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
                    >
                      <FiFileText className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Document {idx + 1}</span>
                    </a>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
