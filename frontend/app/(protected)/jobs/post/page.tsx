'use client'

import React, { useState, useEffect, useCallback, ChangeEvent, FC } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import Link from 'next/link';
import { FaFileUpload } from "react-icons/fa";
import { FiXCircle, FiPlus, FiTrash2, FiLink, FiFileText, FiTruck, FiMessageSquare, FiDollarSign, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useCurrentUser } from '@/hooks/use-current-user';
import { useEdgeStore } from '@/lib/edgestore';
import { ImageHandlerJobAsk } from '@/components/uicustom/company/img-handler-job-ask';
import { Company } from '@prisma/client';

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

const LOG_PREFIX = '[frontend/app/(protected)/jobs/post/page.tsx]';

export default function PostJobPage() {
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[][]>([[]]);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, email: user.email ?? '', userId: user.id ?? '' }));
    }
  }, [user]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies');
        if (!response.ok) throw new Error('Failed to fetch companies');
        const result = await response.json();
        setCompanies(result);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };
    fetchCompanies();
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

  const handleCompanySelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const { options } = e.target;
    const selectedCompanies = Array.from(options).filter(option => option.selected).map(option => option.value);
    setFormData((prevData) => ({
      ...prevData,
      companyIds: selectedCompanies.filter((id): id is string => id !== undefined),
    }));
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    console.log(LOG_PREFIX, 'User:', user);
    console.log(LOG_PREFIX, 'FormData:', formData);
  
    try {
      const updatedImages = await Promise.all(
        formData.images.flat().map((image) => ImageHandlerJobAsk(image, edgestore))
      );
      console.log(LOG_PREFIX, 'Updated images:', updatedImages);
  
      if (!user) throw new Error('User not logged in');
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
      console.log(LOG_PREFIX, 'Job request submitted:', result);
  
      if (result.success) {
        router.push('/jobs');
      } else {
        console.error(LOG_PREFIX, 'Error in job request submission:', result.error);
        alert('Error submitting job request: ' + result.error);
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Error submitting job request:', error);
      alert('Error submitting job request: ' + (error as Error).message);
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
        <div className="animate-pulse text-white/60">Loading...</div>
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
            background: "radial-gradient(closest-side, rgba(16,185,129,0.15), rgba(56,189,248,0.08), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
        <motion.div
          className="absolute -left-24 bottom-20 h-[520px] w-[520px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, 12, 0], y: [0, -10, 0], opacity: [0.08, 0.16, 0.08] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "radial-gradient(closest-side, rgba(99,102,241,0.12), rgba(236,72,153,0.08), transparent 72%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-6 py-10 lg:py-12">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header */}
          <header className="space-y-3 mb-10">
            <Link 
              href="/jobs" 
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Job Board
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
              <motion.span
                className="h-2 w-2 rounded-full bg-emerald-400"
                aria-hidden
                animate={reduceMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <span>New Request</span>
            </div>
            <h1 className="text-balance text-3xl font-semibold text-white sm:text-4xl">
              Post a Request
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-white/70 sm:text-base">
              Describe what you&apos;re looking for and companies will reach out with offers.
              Add images and details to help them understand your needs.
            </p>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Title Section */}
            <section className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-white/90 mb-2 block">Request Title</span>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g., Seeking Specialty Motor Parts for Repair Project..."
                  value={formData.title}
                  onChange={(e) => handleChange(e, undefined, 'title')}
                  required
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50 focus:bg-white/[0.07]"
                />
              </label>
            </section>

            {/* Description Sections */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Images & Descriptions</span>
                <span className="text-xs text-white/40">{formData.descriptions.length} item{formData.descriptions.length > 1 ? 's' : ''}</span>
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] py-3 text-sm text-white/60 transition-colors hover:border-white/30 hover:bg-white/[0.04] hover:text-white/80"
              >
                <FiPlus className="h-4 w-4" />
                Add another image & description
              </button>
            </section>

            {/* Optional Section Toggle */}
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/[0.04]"
            >
              <span className="font-medium">Optional Details</span>
              {showOptional ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
            </button>

            {/* Optional Fields */}
            {showOptional && (
              <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                animate={reduceMotion ? undefined : { opacity: 1, height: 'auto' }}
                className="space-y-6 rounded-xl border border-white/10 bg-white/[0.02] p-5"
              >
                {/* Links */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80">
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
                        className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFields(index, 'links')}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddFields('links')}
                    className="text-sm text-emerald-400/80 hover:text-emerald-400 transition-colors"
                  >
                    + Add another link
                  </button>
                </div>

                {/* Documents */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                    <FiFileText className="h-4 w-4" />
                    Documents
                  </label>
                  <input
                    type="file"
                    name="docs"
                    onChange={(e) => handleChange(e, undefined, 'docs')}
                    multiple
                    className="w-full text-sm text-white/60 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-white/80 hover:file:bg-white/20"
                  />
                  {formData.docs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.docs.map((doc, index) => (
                        <span key={index} className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/60">
                          {doc.name}
                          <button type="button" onClick={() => handleRemoveFields(index, 'docs')} className="text-white/40 hover:text-red-400">
                            <FiXCircle className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delivery */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                    <FiTruck className="h-4 w-4" />
                    Delivery Method
                  </label>
                  <input
                    type="text"
                    name="delivery"
                    placeholder="e.g., Pickup, Shipping, Digital delivery"
                    value={formData.delivery}
                    onChange={(e) => handleChange(e, undefined, 'delivery')}
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50"
                  />
                </div>

                {/* Additional Notes */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                    <FiMessageSquare className="h-4 w-4" />
                    Additional Notes
                  </label>
                  <textarea
                    name="additionalNotes"
                    placeholder="Any other details that might help..."
                    value={formData.additionalNotes}
                    onChange={(e) => handleChange(e, undefined, 'additionalNotes')}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50 resize-none"
                  />
                </div>

                {/* Company Selection */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="sendToAll"
                      checked={formData.sendToAll}
                      onChange={(e) => handleChange(e, undefined, 'sendToAll')}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-sm text-white/80">Send to all companies</span>
                  </label>
                  
                  {!formData.sendToAll && (
                    <div className="space-y-3 pl-7">
                      <input
                        type="text"
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50"
                      />
                      <select
                        multiple
                        onChange={handleCompanySelect}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50"
                        size={Math.min(filteredCompanies.length, 5)}
                      >
                        {filteredCompanies.map(company => (
                          <option key={company.id} value={company.id} className="bg-slate-900 py-1">
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Admin-only fields */}
                {user?.role === 'ADMIN' && (
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Admin Options</span>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                          <FiDollarSign className="h-4 w-4" />
                          Price
                        </label>
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={(e) => handleChange(e, undefined, 'price')}
                          className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Payment Method</label>
                        <input
                          type="text"
                          name="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={(e) => handleChange(e, undefined, 'paymentMethod')}
                          className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="negotiable"
                        checked={formData.negotiable}
                        onChange={(e) => handleChange(e, undefined, 'negotiable')}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
                      />
                      <span className="text-sm text-white/80">Price is negotiable</span>
                    </label>
                  </div>
                )}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 text-base font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Image Dropzone */}
        <div className="w-full lg:w-1/3">
          <div
            {...getRootProps()}
            className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
              isDragActive 
                ? 'border-emerald-400 bg-emerald-500/10' 
                : 'border-white/20 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
            }`}
          >
            <input {...getInputProps()} />
            {imagePreviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <FaFileUpload className="mb-2 h-8 w-8 text-white/30" />
                <p className="text-sm text-white/50">
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
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white/80 transition-colors hover:bg-red-500"
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
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors hover:bg-white/[0.07] focus:border-emerald-500/50 resize-none"
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
