'use client'

import React, { useState, useEffect, useCallback, ChangeEvent, FC } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import Link from 'next/link';
import { FaFileUpload } from "react-icons/fa";
import { FiXCircle, FiPlus, FiTrash2, FiLink, FiFileText, FiTruck, FiMessageSquare, FiDollarSign, FiChevronDown, FiChevronUp, FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import { useCurrentUser, useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';
import { Button } from '@/components/ui/button';
import { useEdgeStore } from '@/lib/edgestore';
import { ImageHandlerJobAsk } from '@/components/uicustom/company/img-handler-job-ask';
import { PageHeader } from "@/components/uicustom/chrome/page-header";

interface CompanyListItem {
  id: string;
  name: string;
  description?: string | null;
}

interface FormData {
  title: string;
  email: string;
  descriptions: string[];
  images: File[][];
  links: string[];
  docs: File[];
  price?: string;
  negotiable?: boolean;
  paymentMethod?: string;
  delivery?: string;
  additionalNotes?: string;
  companyIds?: string[];
  sendToAll: boolean;
  userId: string;
  [key: string]: any;
}

export default function PostJobPage() {
  const { user, isLoading } = useCurrentUserWithStatus();
  if (isLoading) return <p role="status" className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">Loading your session…</p>;
  if (!user || isDemoUserId(user.id)) return (
    <section className="mx-auto w-full max-w-3xl space-y-5 px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Experimental · Job board</p>
      <h1 className="text-balance text-3xl font-semibold">{user ? 'Request publishing preview' : 'Sign in to post a request'}</h1>
      <p className="text-muted-foreground">{user
        ? 'The demo is read-only here. Browse requests freely; use your own account to publish a request or upload files. Nothing will be posted from this demo.'
        : 'Use your own account to publish a request. The request board does not process project payments.'}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="min-h-11"><Link href="/jobs">Back to requests</Link></Button>
        {!user && <Button asChild className="min-h-11"><Link href="/auth/login?callbackUrl=%2Fjobs%2Fpost">Sign in</Link></Button>}
      </div>
    </section>
  );
  return <PostJobForm />;
}

function PostJobForm() {
  const reduceMotion = useReducedMotion();
  const user = useCurrentUser();
  const router = useRouter();
  const { edgestore } = useEdgeStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    email: user?.email ?? '',
    descriptions: [''],
    images: [[]],
    links: [''],
    docs: [],
    price: '',
    negotiable: false,
    paymentMethod: '',
    delivery: '',
    additionalNotes: '',
    companyIds: [],
    sendToAll: true,
    userId: user?.id ?? '',
  });
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[][]>([[]]);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, email: user.email ?? '', userId: user.id ?? '' }));
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const fetchCompanies = async () => {
      try {
        // The public directory: every member can address any company. (/api/companies is admin-only.)
        const response = await fetch('/api/companies/public', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch companies');
        const result: unknown = await response.json();
        if (!active) return;
        setCompanies(Array.isArray(result) ? result.map((c: { id: string; name: string; description?: string | null }) => ({ id: c.id, name: c.name, description: c.description ?? null })) : []);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };
    fetchCompanies();
    return () => { active = false; };
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index?: number,
    field?: keyof FormData
  ) => {
    const { name, value, type, checked, files } = e.target as HTMLInputElement;
    setFormData((prevData) => {
      const updatedData: FormData = { ...prevData };
      if (type === 'checkbox') {
        updatedData[name as keyof FormData] = checked as any;
      } else if (type === 'file') {
        if (files && field === 'docs') {
          if (formData.docs.length < 3) {
            updatedData.docs = Array.from(files);
          }
        } else if (files && index !== undefined) {
          updatedData.images[index] = Array.from(files);
          const newPreviews = Array.from(files).map(file => URL.createObjectURL(file));
          setImagePreviews((prevPreviews) => {
            const updatedPreviews = [...prevPreviews];
            updatedPreviews[index] = newPreviews;
            return updatedPreviews;
          });
        }
      } else {
        if (field === 'descriptions' && index !== undefined) {
          updatedData.descriptions[index] = value;
        } else if (field === 'links' && index !== undefined) {
          updatedData.links[index] = value;
        } else {
          updatedData[name as keyof FormData] = value as any;
        }
      }
      return updatedData;
    });
  };

  const toggleCompany = (id: string) => {
    setFormData((prevData) => {
      const current = prevData.companyIds ?? [];
      return { ...prevData, companyIds: current.includes(id) ? current.filter(c => c !== id) : [...current, id] };
    });
  };

  const handleAddFields = (field: 'descriptions' | 'links') => {
    setFormData((prevData) => ({
      ...prevData,
      [field]: [...prevData[field], ''],
      ...(field === 'descriptions' && { images: [...prevData.images, []] }),
    }));
    if (field === 'descriptions') {
      setImagePreviews((prevPreviews) => [...prevPreviews, []]);
    }
  };

  const handleRemoveFields = (index: number, field: 'descriptions' | 'links' | 'docs') => {
    if (formData[field].length > 1) {
      setFormData((prevData) => {
        const updatedField = prevData[field].filter((_, i) => i !== index);
        const updatedImages = field === 'descriptions' ? prevData.images.filter((_, i) => i !== index) : prevData.images;
        return {
          ...prevData,
          [field]: updatedField,
          images: updatedImages,
        };
      });
      if (field === 'descriptions') {
        setImagePreviews((prevPreviews) => prevPreviews.filter((_, i) => i !== index));
      }
    }
  };

  const handleDrop = useCallback((acceptedFiles: File[], index: number) => {
    setFormData((prevData) => {
      const updatedData = { ...prevData };
      updatedData.images[index] = acceptedFiles;
      const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
      setImagePreviews((prevPreviews) => {
        const updatedPreviews = [...prevPreviews];
        updatedPreviews[index] = newPreviews;
        return updatedPreviews;
      });
      return updatedData;
    });
  }, []);

  const handleRemoveImage = (index: number, imgIndex: number) => {
    setFormData((prevData) => {
      const updatedImages = [...prevData.images];
      updatedImages[index] = updatedImages[index].filter((_, i) => i !== imgIndex);
      return { ...prevData, images: updatedImages };
    });
    setImagePreviews((prevPreviews) => {
      const updatedPreviews = [...prevPreviews];
      updatedPreviews[index] = updatedPreviews[index].filter((_, i) => i !== imgIndex);
      return updatedPreviews;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !user || isDemoUserId(user.id)) return;
    setIsSubmitting(true);
  
    try {
      const updatedImages = await Promise.all(
        formData.images.flat().map((image) => ImageHandlerJobAsk(image, edgestore))
      );
  
      const response = await fetch('/api/job-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          images: updatedImages.filter((url): url is string => url !== undefined),
          docs: formData.docs.map(doc => URL.createObjectURL(doc)),
          companyIds: formData.sendToAll ? [] : formData.companyIds,
        }),
      });
  
      const result = await response.json();
  
      if (result.success) {
        toast.success('Job request submitted');
        router.push('/jobs');
      } else {
        toast.error('Could not publish your request. Review the fields and try again.');
      }
    } catch {
      toast.error('Could not publish your request. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.description && company.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse text-foreground/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-20 top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -10, 0], y: [0, 8, 0], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(closest-side, hsl(var(--brand-accent) / 0.14), hsl(var(--brand-accent) / 0.05), transparent 70%)" }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <PageHeader
            eyebrow="Job board · Experimental"
            title="Post a request"
            description="Describe what you need and let companies come to you with offers. Photos and details help them quote precisely."
            back={<Link href="/jobs" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FiArrowLeft aria-hidden="true" className="size-4" />Back to requests</Link>}
            className="mb-8"
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Section */}
            <section className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground mb-2 block">Request Title</span>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g., Seeking Specialty Motor Parts for Repair Project..."
                  value={formData.title}
                  onChange={(e) => handleChange(e, undefined, 'title')}
                  required
                  className="h-12 w-full rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50 focus:bg-foreground/[0.05]"
                />
              </label>
            </section>

            {/* Description Sections */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Images & Descriptions</span>
                <span className="text-xs text-muted-foreground">{formData.descriptions.length} item{formData.descriptions.length > 1 ? 's' : ''}</span>
              </div>
              
              <div className="space-y-4">
                {formData.descriptions.map((description, index) => (
                  <JobDescriptionField
                    key={index}
                    index={index}
                    description={description}
                    images={formData.images[index]}
                    imagePreviews={imagePreviews[index]}
                    handleChange={handleChange}
                    handleRemoveFields={handleRemoveFields}
                    handleDrop={handleDrop}
                    handleRemoveImage={handleRemoveImage}
                    canRemove={index > 0}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleAddFields('descriptions')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-background/40 py-3 text-sm text-foreground/60 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.05] hover:text-foreground/80"
              >
                <FiPlus className="h-4 w-4" />
                Add another image & description
              </button>
            </section>

            {/* Optional Section Toggle */}
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 py-3 text-sm text-foreground/70 transition-colors hover:bg-foreground/[0.05]"
            >
              <span className="font-medium">Optional Details</span>
              {showOptional ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
            </button>

            {/* Optional Fields */}
            {showOptional && (
              <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                animate={reduceMotion ? undefined : { opacity: 1, height: 'auto' }}
                className="space-y-6 rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] p-5"
              >
                {/* Links */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FiLink className="h-4 w-4" />
                    Reference Links
                  </label>
                  {formData.links.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/reference"
                        value={link}
                        onChange={(e) => handleChange(e, index, 'links')}
                        className="h-10 flex-1 rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFields(index, 'links')}
                        className="rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-3 text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddFields('links')}
                    className="text-sm text-brand-accent hover:text-brand-accent-hover hover:dark:text-brand-accent-light transition-colors"
                  >
                    + Add another link
                  </button>
                </div>

                {/* Documents */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FiFileText className="h-4 w-4" />
                    Documents
                  </label>
                  <input
                    type="file"
                    name="docs"
                    onChange={(e) => handleChange(e, undefined, 'docs')}
                    multiple
                    className="w-full text-sm text-muted-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:text-foreground hover:file:bg-muted"
                  />
                  {formData.docs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.docs.map((doc, index) => (
                        <span key={index} className="inline-flex items-center gap-2 rounded-lg bg-foreground/[0.05] px-3 py-1.5 text-xs text-muted-foreground">
                          {doc.name}
                          <button type="button" onClick={() => handleRemoveFields(index, 'docs')} className="text-muted-foreground hover:text-red-400">
                            <FiXCircle className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delivery */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FiTruck className="h-4 w-4" />
                    Delivery Method
                  </label>
                  <input
                    type="text"
                    name="delivery"
                    placeholder="e.g., Pickup, Shipping, Digital delivery"
                    value={formData.delivery}
                    onChange={(e) => handleChange(e, undefined, 'delivery')}
                    className="h-10 w-full rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50"
                  />
                </div>

                {/* Additional Notes */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FiMessageSquare className="h-4 w-4" />
                    Additional Notes
                  </label>
                  <textarea
                    name="additionalNotes"
                    placeholder="Any other details that might help..."
                    value={formData.additionalNotes}
                    onChange={(e) => handleChange(e, undefined, 'additionalNotes')}
                    rows={3}
                    className="w-full rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50 resize-none"
                  />
                </div>

                {/* Company Selection */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="sendToAll"
                      checked={formData.sendToAll}
                      onChange={(e) => handleChange(e, undefined, 'sendToAll')}
                      className="h-4 w-4 rounded border-border bg-surface-1 text-brand-accent focus:ring-brand-accent/50"
                    />
                    <span className="text-sm text-foreground">Send to all companies</span>
                  </label>

                  {!formData.sendToAll && (
                    <div className="space-y-3 pl-7">
                      <input
                        type="text"
                        aria-label="Search companies"
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50"
                      />
                      <div role="group" aria-label="Companies to send to" className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1">
                        {filteredCompanies.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{companies.length === 0 ? 'No companies to choose from yet.' : 'No company matches that search.'}</p>}
                        {filteredCompanies.map(company => {
                          const checked = (formData.companyIds ?? []).includes(company.id);
                          return (
                            <label key={company.id} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${checked ? 'bg-brand-accent/10 text-foreground' : 'text-foreground/85 hover:bg-foreground/[0.04]'}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleCompany(company.id)} className="size-4 rounded border-border accent-[hsl(var(--brand-accent))]" />
                              <span className="min-w-0 flex-1 truncate">{company.name}</span>
                              {company.description && <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:inline">{company.description}</span>}
                            </label>
                          );
                        })}
                      </div>
                      {(formData.companyIds?.length ?? 0) > 0 && <p className="text-xs text-muted-foreground">{formData.companyIds?.length} selected</p>}
                    </div>
                  )}
                </div>

                {/* Admin-only fields */}
                {user?.role === 'ADMIN' && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Options</span>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <FiDollarSign className="h-4 w-4" />
                          Price
                        </label>
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={(e) => handleChange(e, undefined, 'price')}
                          className="h-10 w-full rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Payment Method</label>
                        <input
                          type="text"
                          name="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={(e) => handleChange(e, undefined, 'paymentMethod')}
                          className="h-10 w-full rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="negotiable"
                        checked={formData.negotiable}
                        onChange={(e) => handleChange(e, undefined, 'negotiable')}
                        className="h-4 w-4 rounded border-border bg-surface-1 text-brand-accent focus:ring-brand-accent/50"
                      />
                      <span className="text-sm text-foreground">Price is negotiable</span>
                    </label>
                  </div>
                )}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-accent px-8 text-base font-semibold text-brand-accent-foreground shadow-e1 transition-[background-color,transform,box-shadow] duration-200 hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Post Request'
              )}
            </button>
          </form>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-e1 backdrop-blur-xl">
                <h3 className="mb-3 text-sm font-semibold text-foreground">What happens next</h3>
                <ol className="space-y-3 text-sm text-muted-foreground [counter-reset:step]">
                  {['Your request is visible to every company, or only the ones you pick.', 'Companies reply with offers and questions in Messages.', 'You choose an offer and agree terms directly. The board never charges you.'].map((text, i) => (
                    <li key={text} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-accent/10 text-xs font-semibold text-brand-accent">{i + 1}</span><span>{text}</span></li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-e1 backdrop-blur-xl">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Good requests</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2"><FiCheckCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-accent" />Name the outcome, not just the part.</li>
                  <li className="flex gap-2"><FiCheckCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-accent" />Add measurements, materials and a photo.</li>
                  <li className="flex gap-2"><FiCheckCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-accent" />Say when you need it and how it should arrive.</li>
                </ul>
              </div>
            </div>
          </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

interface JobDescriptionFieldProps {
  index: number;
  description: string;
  images: File[];
  imagePreviews: string[];
  canRemove: boolean;
  handleChange: (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number,
    field: keyof FormData
  ) => void;
  handleRemoveFields: (index: number, field: 'descriptions' | 'links') => void;
  handleDrop: (acceptedFiles: File[], index: number) => void;
  handleRemoveImage: (index: number, imgIndex: number) => void;
}

const JobDescriptionField: FC<JobDescriptionFieldProps> = ({
  index,
  description,
  imagePreviews,
  canRemove,
  handleChange,
  handleRemoveFields,
  handleDrop,
  handleRemoveImage,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: true,
    onDrop: (acceptedFiles) => handleDrop(acceptedFiles, index),
  });

  return (
    <div className="rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] p-4 transition-colors hover:bg-foreground/[0.05]">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Image Dropzone */}
        <div className="w-full lg:w-1/3">
          <div
            {...getRootProps()}
            className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
              isDragActive 
                ? 'border-brand-accent bg-brand-accent/10' 
                : 'border-border bg-foreground/[0.05] hover:border-foreground/20 hover:bg-foreground/[0.05]'
            }`}
          >
            <input {...getInputProps()} />
            {imagePreviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <FaFileUpload className="mb-2 h-8 w-8 text-foreground/30" />
                <p className="text-sm text-foreground/50">
                  {isDragActive ? 'Drop image here' : 'Drag & drop or click'}
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 grid grid-cols-2 gap-1 p-1">
                {imagePreviews.slice(0, 4).map((preview, imgIndex) => (
                  <div key={imgIndex} className="relative overflow-hidden rounded-lg">
                    <Image
                      src={preview}
                      alt={`preview-${index}-${imgIndex}`}
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(index, imgIndex); }}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-foreground/80 transition-colors hover:bg-red-500"
                    >
                      <FiXCircle className="h-3 w-3" />
                    </button>
                    {imgIndex === 3 && imagePreviews.length > 4 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium text-white">
                        +{imagePreviews.length - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-1 flex-col">
          <textarea
            name="description"
            value={description}
            placeholder="Describe what you're looking for... Include dimensions, materials, specifications, or any other relevant details."
            onChange={(e) => handleChange(e, index, 'descriptions')}
            required
            rows={6}
            className="flex-1 rounded-xl border border-border/70 bg-background/60 dark:bg-foreground/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.05] focus:border-brand-accent/50 resize-none"
          />
          {canRemove && (
            <button
              type="button"
              onClick={() => handleRemoveFields(index, 'descriptions')}
              className="mt-2 self-end rounded-lg px-3 py-1.5 text-xs text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              Remove this section
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
