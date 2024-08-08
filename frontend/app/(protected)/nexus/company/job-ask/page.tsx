'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, FC } from 'react';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { UploadCloudIcon, XCircle } from 'lucide-react';

import { useCurrentUser } from '@/hooks/use-current-user';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useEdgeStore } from '@/lib/edgestore';
import { ImageHandlerJobAsk } from '@/components/uicustom/company/img-handler-job-ask';
import { useRouter } from 'next/navigation';

interface FormData {
  descriptions: string[];
  images: File[][];
  links: string[];
  docs: File[];
  price: string;
  negotiable: boolean;
  paymentMethod: string;
  delivery: string;
  additionalNotes: string;
  companyIds: string[];
  sendToAll: boolean;
  userId: string;
  [key: string]: any;
}

interface Company {
  id: string;
  name: string;
  description?: string;
}

const LOG_PREFIX = '[frontend/app/(protected)/nexus/company/job-ask/page.tsx]';

const MyJobAsk: FC = () => {
  const router = useRouter();
  const user = useCurrentUser();
  const { edgestore } = useEdgeStore();
  const [formData, setFormData] = useState<FormData>({
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

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies');
        if (!response.ok) {
          throw new Error('Failed to fetch companies');
        }
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
      setImagePreviews((prevPreviews) => [...prevPreviews, []]);handleRemoveFields
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
    const updatedImages = await Promise.all(
      formData.images.flat().map((image) => ImageHandlerJobAsk(image, edgestore))
    );
    console.log(LOG_PREFIX, 'Updated images:', updatedImages);
    try {
      if (!user) throw new Error('User not logged in');
      console.log(LOG_PREFIX, 'try createJobRequest with:', {
        ...formData,
        images: updatedImages.filter((url): url is string => url !== undefined), // Filter out undefined values
        docs: formData.docs.map(doc => URL.createObjectURL(doc)), // Convert File to string URL
        companyIds: formData.sendToAll ? [] : formData.companyIds
      });
      const response = await fetch('/api/job-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          images: updatedImages.filter((url): url is string => url !== undefined), // Filter out undefined values
          docs: formData.docs.map(doc => URL.createObjectURL(doc)), // Convert File to string URL
          companyIds: formData.sendToAll ? [] : formData.companyIds,
        }),
      });
      const result = await response.json();
      console.log(LOG_PREFIX, 'Job request submitted:', result);
      router.push('/nexus/company/job-box'); // Redirect to Job Box page on success
    } catch (error) {
      console.error('Error submitting job request:', error);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.description && company.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const style = {
    baseRoot: 'flex flex-col justify-center items-start w-full max-w-7xl px-4 py-2 gap-4',
    baseItem: 'flex flex-col md:flex-row justify-between items-center w-full px-2 py-4 hover:bg-white/10 dark:hover:bg-black/10 rounded',
    txtArea: 'p-2 border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    input: 'p-2 border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    inputCheckbox: 'border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    dropzone: 'border border-dashed border-gray-400 dark:border-gray-400 rounded-md p-2 text-center',
  };

  return (
    <div className='flex flex-col justify-start items-center w-full'>
      <h1>Job Ask</h1>
      <form onSubmit={handleSubmit} className={style.baseRoot}>
        <div className='flex flex-col justify-start items-center w-full px-2 py-4 hover:bg-white/10 dark:hover:bg-black/10 rounded'>
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
            />
          ))}
          <Button variant='vegaNormalBtn' className='w-full' type="button" onClick={() => handleAddFields('descriptions')}>
            Add Description
          </Button>
        </div>
        <div className={`${style.baseRoot} group hover:bg-white/30`}>
          {formData.links.map((link, index) => (
            <div key={index} className={style.baseItem}>
              <label>Link {index + 1}</label>
              <div className='space-x-2'>
                <input
                  className={style.input}
                  type="text"
                  name="link"
                  value={link}
                  onChange={(e) => handleChange(e, index, 'links')}
                />
                <Button variant='vegaNormalBtn' type="button" onClick={() => handleRemoveFields(index, 'links')}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <Button variant='vegaNormalBtn' type="button" onClick={() => handleAddFields('links')}>
            Add Link
          </Button>
        </div>
        <div className={style.baseItem}>
          <label>Documents</label>
          <input className={style.input} type="file" name="docs" onChange={(e) => handleChange(e, undefined, 'docs')} multiple />
          {formData.docs.length > 0 && (
            <div className="mt-2">
              {formData.docs.map((doc, index) => (
                <div key={index} className="flex items-center">
                  <span className="text-sm">{doc.name}</span>
                  <Button variant='vegaNormalBtn' type="button" onClick={() => handleRemoveFields(index, 'docs')}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={style.baseItem}>
          <label>Price</label>
          <input className={style.input} type="number" name="price" value={formData.price} onChange={(e) => handleChange(e, undefined, 'price')} />
        </div>
        <div className={style.baseItem}>
          <label>Negotiable</label>
          <input className={style.inputCheckbox} type="checkbox" name="negotiable" checked={formData.negotiable} onChange={(e) => handleChange(e, undefined, 'negotiable')} />
        </div>
        <div className={style.baseItem}>
          <label>Payment Method</label>
          <input className={style.input} type="text" name="paymentMethod" value={formData.paymentMethod} onChange={(e) => handleChange(e, undefined, 'paymentMethod')} />
        </div>
        <div className={style.baseItem}>
          <label>Delivery</label>
          <input className={style.input} type="text" name="delivery" value={formData.delivery} onChange={(e) => handleChange(e, undefined, 'delivery')} />
        </div>
        <div className={style.baseItem}>
          <label>Additional Notes</label>
          <textarea className={style.txtArea} name="additionalNotes" value={formData.additionalNotes} onChange={(e) => handleChange(e, undefined, 'additionalNotes')} />
        </div>
        <div className={style.baseItem}>
          <label>Send to All Companies</label>
          <input className={style.inputCheckbox} type="checkbox" name="sendToAll" checked={formData.sendToAll} onChange={(e) => handleChange(e, undefined, 'sendToAll')} />
        </div>
        {!formData.sendToAll && (
          <>
            <div className={style.baseItem}>
              <label>Search Companies</label>
              <input
                className={style.input}
                type="text"
                placeholder="Search by name or description"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className={style.baseItem}>
              <label>Select Companies</label>
              <select className={style.input} multiple onChange={handleCompanySelect}>
                {filteredCompanies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <Button variant='vegaNormalBtn' type="submit">Submit Job Request</Button>
      </form>
    </div>
  );
};

interface JobDescriptionFieldProps {
  index: number;
  description: string;
  images: File[];
  imagePreviews: string[];
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
  images,
  imagePreviews,
  handleChange,
  handleRemoveFields,
  handleDrop,
  handleRemoveImage,
}) => {
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    multiple: true,
    onDrop: (acceptedFiles) => handleDrop(acceptedFiles, index),
  });

  const style = {
    baseRoot: 'flex flex-col justify-center items-start w-full max-w-7xl px-4 py-2 gap-4',
    baseItem: 'flex flex-col sm:flex-row justify-between items-center w-full hover:bg-white/20 dark:hover:bg-black/20 rounded',
    txtArea: 'border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out w-full',
    dropzone: 'border border-dashed border-gray-400 dark:border-gray-400 rounded-md p-4 text-center w-full',
  };

  return (
    <div className={`${style.baseRoot}`}>
      <div className={`${style.baseItem} space-y-4 md:space-y-0 md:space-x-4`}>
        <div {...getRootProps()} className={style.dropzone}>
          <input {...getInputProps()} />
          {imagePreviews.length === 0 ? (
            <div className='w-full'>
              <AspectRatio ratio={1 / 1}>
                <div className="text-center flex flex-col justify-center items-center h-full w-full">
                  <UploadCloudIcon className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-200" />
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">
                    Drag n drop an IMAGE here, or click to select an IMAGE
                  </p>
                </div>
              </AspectRatio>
            </div>
          ) : (
            <div className="flex flex-col w-full">
              {imagePreviews.map((preview, imgIndex) => (
                <div key={imgIndex} className="relative">
                  <AspectRatio ratio={1 / 1}>
                    <Image src={preview} alt={`preview-${index}-${imgIndex}`} layout="fill" className="rounded-md object-cover" />
                  </AspectRatio>
                  <div
                    onClick={() => handleRemoveImage(index, imgIndex)}
                    className="absolute top-1 right-1 hover:scale-110 transform duration-300 bg-gray-800/30 hover:bg-red-600/40 text-white p-1 rounded-full cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className='text-center w-full h-full flex flex-col gap-2'>
          <AspectRatio ratio={1 / 1}>
            <div className='w-full h-full'>
              <textarea
                className={`${style.txtArea} h-full w-full resize-none px-4 py-2`}
                name="description"
                value={description}
                placeholder='This section is intended for a detailed description of the image that will be displayed alongside this description. When describing the image.'
                onChange={(e) => handleChange(e, index, 'descriptions')}
                required
              />
            </div>
          </AspectRatio>
          <Button variant='vegaNormalBtn' type="button" className={`${index === 0 ? 'hidden' : ''} w-full`} onClick={() => handleRemoveFields(index, 'descriptions')}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MyJobAsk;