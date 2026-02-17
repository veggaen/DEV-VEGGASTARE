'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { FancyBackground } from '@/components/uicustom/fancy-background';
import { useUiPreferences } from '@/components/providers/ui-preferences';

interface UserSummary {
  id: string;
  name: string | null;
  image: string | null;
}

interface JobRequest {
  id: string;
  title: string;
  user: UserSummary;
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
}

export default function JobsPage() {
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState('newest');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const fetchJobRequests = async () => {
      try {
        const response = await fetch('/api/job-requests');
        if (!response.ok) throw new Error('Failed to fetch job requests');
        const data = await response.json();
        setJobRequests(data);
      } catch (error) {
        console.error('Error fetching job requests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobRequests();
  }, []);

  const sortJobRequests = (requests: JobRequest[]) => {
    return [...requests].sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortOption === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });
  };

  const filterJobRequests = (requests: JobRequest[]) => {
    if (!filterText.trim()) return requests;
    const lower = filterText.toLowerCase();
    return requests.filter((request) => {
      return (
        request.title?.toLowerCase().includes(lower) ||
        request.descriptions.some(d => d.toLowerCase().includes(lower)) ||
        request.additionalNotes?.toLowerCase().includes(lower)
      );
    });
  };

  const sortedAndFilteredRequests = filterJobRequests(sortJobRequests(jobRequests));
  const noAnimations = reduceMotion || prefs.pageAnimations === "none";

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Conditional fancy background */}
      <FancyBackground
        gradient
        spheres={[
          { position: "top-right", color: "indigo", size: "lg" },
          { position: "bottom-left", color: "emerald", size: "xl", delay: 2 },
        ]}
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-10 lg:py-12">
        <motion.div
          initial={noAnimations ? undefined : { opacity: 0, y: 14 }}
          animate={noAnimations ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header */}
          <header className="space-y-3 mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
              <motion.span
                className="h-2 w-2 rounded-full bg-indigo-400"
                aria-hidden
                animate={noAnimations ? undefined : { opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <span>Job Board</span>
            </div>
            <h1 className="text-balance text-3xl font-semibold text-zinc-900 dark:text-white sm:text-4xl">
              Browse Requests
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-zinc-600 dark:text-white/70 sm:text-base">
              Explore open requests from customers looking for products, services, or custom work.
              Connect with potential clients and find your next project.
            </p>
          </header>

          {/* Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex items-center gap-3">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 text-sm text-zinc-700 dark:text-white/90 outline-none transition-colors hover:bg-black/10 dark:hover:bg-white/10 focus:border-indigo-500/50"
              >
                <option value="newest" className="bg-white dark:bg-zinc-900">Newest first</option>
                <option value="oldest" className="bg-white dark:bg-zinc-900">Oldest first</option>
              </select>
              <Link
                href="/jobs/post"
                className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 transition-colors hover:bg-indigo-500/30"
              >
                + Post Request
              </Link>
            </div>
            <div className="relative">
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search requests..."
                className="h-10 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-4 pr-10 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/40 outline-none transition-colors hover:bg-black/10 dark:hover:bg-white/10 focus:border-indigo-500/50 sm:w-64"
              />
              <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <div className="h-6 w-2/3 rounded bg-white/10 mb-3" />
                  <div className="h-4 w-full rounded bg-white/5 mb-2" />
                  <div className="h-4 w-4/5 rounded bg-white/5" />
                </div>
              ))}
            </div>
          ) : sortedAndFilteredRequests.length === 0 ? (
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <svg className="h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white/80">No requests found</p>
              <p className="mt-1 text-sm text-white/50">
                {filterText ? 'Try adjusting your search' : 'Be the first to post a request'}
              </p>
              <Link
                href="/jobs/post"
                className="mt-6 inline-flex rounded-xl bg-indigo-500/20 px-5 py-2.5 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30"
              >
                Post Request
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {sortedAndFilteredRequests.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Link
                    href={`/jobs/${job.id}`}
                    className="group block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {job.user?.image && (
                            <Image
                              src={job.user.image}
                              alt={job.user.name || 'User'}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="text-sm text-zinc-500 dark:text-white/60">{job.user?.name || 'Anonymous'}</span>
                            <span className="mx-2 text-zinc-300 dark:text-white/30">·</span>
                            <span className="text-sm text-zinc-400 dark:text-white/40">
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors truncate">
                          {job.title || `Request #${job.id.slice(0, 8)}`}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-white/60 line-clamp-2">
                          {job.descriptions[0] || 'No description provided'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {job.images.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/5 px-2 py-0.5 text-xs text-zinc-500 dark:text-white/50">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {job.images.length} image{job.images.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {job.links.filter(l => l).length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/5 px-2 py-0.5 text-xs text-zinc-500 dark:text-white/50">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              {job.links.filter(l => l).length} link{job.links.filter(l => l).length > 1 ? 's' : ''}
                            </span>
                          )}
                          {job.negotiable && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                              Negotiable
                            </span>
                          )}
                        </div>
                      </div>
                      {job.images[0] && (
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 sm:h-24 sm:w-24">
                          <Image
                            src={job.images[0]}
                            alt="Request preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
