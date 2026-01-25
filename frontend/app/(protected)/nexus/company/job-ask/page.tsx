'use client'

import React, { useState, useEffect, useCallback, ChangeEvent, FC } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { FaFileUpload } from "react-icons/fa";
import { FiXCircle } from "react-icons/fi";
import { useCurrentUser } from '@/hooks/use-current-user';
import { AspectRatio } from '@/components/ui/aspect-ratio';
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

const LOG_PREFIX = '[frontend/app/(protected)/nexus/company/job-ask/page.tsx]';

const MyJobAsk: FC = () => {
  const user = useCurrentUser();
  const router = useRouter();
  const { edgestore } = useEdgeStore();
  const [formData, setFormData] = useState<FormData>({
    title: '',
    email: user?.email!!,
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
    userId: user?.id !!,
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[][]>([[]]);
  const [showOptional, setShowOptional] = useState(false);
  const bannerImageUrl = '/banners/busy-streets_01.webp'

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

  const handleOptionalClick = () => {
    setShowOptional(!showOptional);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(LOG_PREFIX, 'User:', user); // Log user details
    console.log(LOG_PREFIX, 'FormData:', formData); // Log formData
  
    const updatedImages = await Promise.all(
      formData.images.flat().map((image) => ImageHandlerJobAsk(image, edgestore))
    );
  
    console.log(LOG_PREFIX, 'Updated images:', updatedImages);
  
    try {
      if (!user) throw new Error('User not logged in');
      const response = await fetch('/api/job-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        router.push('/nexus/company/job-box'); // Redirect to job listing page
      } else {
        console.error(LOG_PREFIX, 'Error in job request submission:', result.error);
        alert('Error submitting job request: ' + result.error);
      }
    } catch (error) {
      console.error(LOG_PREFIX, 'Error submitting job request:', error);
      alert('Error submitting job request: ' + (error as Error).message);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.description && company.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const style = {
    baseRoot: 'flex flex-col justify-center items-start w-full max-w-7xl px-4 py-2',
    baseItem: 'flex flex-col md:flex-row justify-between items-center w-full px-4 py-4 hover:bg-white/30 dark:hover:bg-black/30 transition-colors duration-300 rounded',
    txtArea: 'p-2 w-full border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    input: 'p-2 w-full border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    inputCheckbox: 'border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    dropzone: 'border border-dashed border-gray-400 dark:border-gray-400 rounded-md p-2 text-center',
  };

  if (!user) {
    return <p>Loading client user...</p>;
  }

  return (
    <div className="flex flex-col justify-start items-center w-full">
      <div className="relative w-full">
        <div className='relative BackgroundImageBanner w-full'>
          <div className="relative w-full sm:hidden">
            <AspectRatio ratio={1 / 2} className=''>
              <Image 
                src={bannerImageUrl} 
                fill sizes="100%"
                objectFit="cover" 
                alt="Job Ask Banner" 
                className="object-cover"
                priority
              />
            </AspectRatio>
          </div>
          <div className="hidden sm:block xl:hidden">
            <AspectRatio ratio={1 / 1} className=''>
              <Image 
                src={bannerImageUrl} 
                fill sizes="100%"
                objectFit="cover" 
                alt="Job Ask Banner" 
                className="object-cover"
                priority
              />
            </AspectRatio>
          </div>
          <div className="hidden xl:block 2xl:hidden">
            <AspectRatio ratio={2 / 1} className=''>
              <Image 
                src={bannerImageUrl} 
                fill sizes="100%"
                objectFit="cover" 
                alt="Job Ask Banner" 
                className="object-cover"
                priority
              />
            </AspectRatio>
          </div>
          <div className="hidden 2xl:block">
            <AspectRatio ratio={3 / 1} className=''>
              <Image 
                src={bannerImageUrl} 
                fill sizes="100%"
                alt="Job Ask Banner" 
                className="object-cover" 
                priority
              />
            </AspectRatio>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black bg-opacity-80 z-10 p-6 lg:p-10">
            <h1 className="text-3xl lg:text-5xl font-bold tracking-wide mb-4 text-white drop-shadow-lg">
              Job Ask
            </h1>
            <p className="text-sm lg:text-lg text-gray-200 dark:text-gray-300 mt-4 lg:mt-6 xs:font-semibold lg:font-semibold leading-relaxed max-w-4xl">
              Welcome to the Job Ask form! <br /> Here, you can easily submit a detailed job request to companies. Start by giving your request a clear and descriptive title.
              <br /><br />
	              You&apos;ll find space to add an image along with a corresponding description. This is where you can highlight exactly what you&apos;re looking for. If you have more images to include, you can always add them using the &quot;Add Image with description&quot; button, but it&apos;s totally optional.
              <br /><br />
	              There are also some optional fields for adding links, documents, delivery details, and additional notes. These aren&apos;t required, but adding them can give companies a better idea of your needs.
              <br /><br />
              By default, your request will be sent to all companies registered on this platform. This means your job ask will be visible to a wide audience, allowing any potential job takers to express interest in completing your request.
              <br /><br />
	              However, if you prefer to target specific companies, you can easily adjust this in the optional details section. Just click &quot;Show Optional details&quot; to customize your selection.
            </p>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className={`${style.baseRoot} my-12`}>
        <div className='w-full'>
          <div className={`flex flex-col justify-between items-center w-full p-4 hover:bg-white/30 dark:hover:bg-black/30 transition-colors duration-300 rounded`}>
            <label><h1 className='text-xl font-bold tracking-widest mb-4'>Set Your Title</h1></label>
            <input
              className={style.input}
              type="text"
              name="title"
              placeholder='Seeking Specialty Motor Parts for Repair Project...'
              value={formData.title}
              onChange={(e) => handleChange(e, undefined, 'title')}
              required
            />
          </div>
        </div>
        <div className="flex flex-col justify-start items-center w-full gap-4 p-4 hover:bg-white/30 dark:hover:bg-black/30 transition-colors duration-300 rounded">
          <label><h1 className='text-xl font-bold tracking-widest mb-4'>Add a Image with Description</h1></label>
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
          <Button variant="vegaNormalBtn" className="w-full" type="button" onClick={() => handleAddFields('descriptions')}>
            Add Image with description
          </Button>
          <Button variant="vegaNormalBtn" type="button" className='w-full' onClick={() => handleOptionalClick()}>
            {`${showOptional === true ? 'Hide Optional details' : 'Show Optional details'}`}
          </Button>
        </div>
        <div className={`${showOptional === true ? 'hover:bg-white/30 dark:hover:bg-black/30 transition-colors duration-300' : ''} group w-full mb-2`}>
          <div className={`${showOptional === false ? 'hidden' : 'w-full flex flex-col gap-2 p-2'}`}>
            <div className={`flex flex-col justify-center items-start w-full max-w-7xl gap-1 group `}>
              {formData.links.map((link, index) => (
                <div key={index} className={`${style.baseItem} `}>
                  <label>Reference linking</label>
                  <div className="flex flex-col justify-end w-full md:w-1/2  gap-2">
                    <input
                      className={style.input}
                      type="text"
                      name="link"
                      value={link}
                      placeholder='https://en.wikipedia.org/wiki/Help:External_links_and_references'
                      onChange={(e) => handleChange(e, index, 'links')}
                    />
                    <div className="flex justify-between w-full gap-2">
                      <Button variant="vegaNormalBtn" type="button" className='w-full' onClick={() => handleRemoveFields(index, 'links')}>
                        Remove
                      </Button>
                      <Button variant="vegaNormalBtn" type="button" className='w-full' onClick={() => handleAddFields('links')}>
                        Add Link
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={`${style.baseItem}`}>
              <label>Documents</label>
              <div className='flex justify-end w-full md:w-1/2'>
              <input className={style.input} type="file" name="docs" onChange={(e) => handleChange(e, undefined, 'docs')} multiple />
                {formData.docs.length > 0 && (
                  <div className="mt-2">
                    {formData.docs.map((doc, index) => (
                      <div key={index} className="flex items-center">
                        <span className="text-sm">{doc.name}</span>
                        <Button variant="vegaNormalBtn" type="button" onClick={() => handleRemoveFields(index, 'docs')}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className={style.baseItem}>
              <label>Delivery method</label>
              <div className='flex justify-end w-full md:w-1/2'>
                <input className={style.input} type="text" name="delivery" value={formData.delivery} onChange={(e) => handleChange(e, undefined, 'delivery')} />
              </div>
            </div>
            <div className={style.baseItem}>
              <label>Additional Notes</label>
              <div className='flex justify-end w-full md:w-1/2'>
                <textarea className={style.txtArea} name="additionalNotes" value={formData.additionalNotes} onChange={(e) => handleChange(e, undefined, 'additionalNotes')} />
              </div>
            </div>
            <div className={`${user ? 'w-full' : 'hidden'}`}>
              <div className={style.baseItem}>
                <label>Send to All Companies</label>
                <div className='flex justify-end w-full md:w-1/2'>
                  <input className={style.inputCheckbox} type="checkbox" name="sendToAll" checked={formData.sendToAll} onChange={(e) => handleChange(e, undefined, 'sendToAll')} />
                </div>
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
            </div>
            <div className={`${user.role === 'ADMIN' ? 'w-full' : 'hidden'}`}>
              <div className={style.baseItem}>
                <label>Price</label>
                <div className='flex justify-end w-full md:w-1/2'>
                  <input className={style.input} type="number" name="price" value={formData.price} onChange={(e) => handleChange(e, undefined, 'price')} />
                </div>
              </div>
              <div className={style.baseItem}>
                <label>Negotiable</label>
                <div className='flex justify-end w-full md:w-1/2'>
                  <input className={style.inputCheckbox} type="checkbox" name="negotiable" checked={formData.negotiable} onChange={(e) => handleChange(e, undefined, 'negotiable')} />
                </div>
              </div>
              <div className={style.baseItem}>
                <label>Payment Method</label>
                <div className='flex justify-end w-full md:w-1/2'>
                  <input className={style.input} type="text" name="paymentMethod" value={formData.paymentMethod} onChange={(e) => handleChange(e, undefined, 'paymentMethod')} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button variant="vegaEmeraldBtn" type="submit" className='w-full mb-12 h-14 text-xl font-bold'>Submit Job Request</Button>
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
    baseItem: 'flex flex-col md:flex-row justify-between items-center w-full hover:bg-white/20 dark:hover:bg-black/20 rounded',
    txtArea: 'border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out resize-none',
    dropzone: 'border border-dashed border-gray-200 dark:border-gray-700 rounded-md p-4 text-center',
  };

  return (
     <div className="flex flex-col md:flex-row justify-between items-start w-full gap-4 group">
      <div className="flex-1 h-full w-full">
        <div {...getRootProps()} className={`${style.dropzone} bg-black/10 dark:bg-white/20`} style={{ height: '100%' }}>
          <input {...getInputProps()} />
          {imagePreviews.length === 0 ? (
            <div className="w-full h-full">
              <AspectRatio ratio={1 / 1}>
                <div className="text-center flex flex-col justify-center items-center h-full w-full">
                  <FaFileUpload className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-200 group-hover:animate-bounce" />
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
                    <Image src={preview} alt={`preview-${index}-${imgIndex}`} fill className="rounded-md object-cover" sizes="100vw" />
                  </AspectRatio>
                  <div
                    onClick={() => handleRemoveImage(index, imgIndex)}
                    className="absolute top-1 right-1 hover:scale-110 transform duration-300 bg-gray-800/30 hover:bg-red-600/40 text-white p-1 rounded-full cursor-pointer"
                  >
                    <FiXCircle className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 h-full w-full">
        <AspectRatio ratio={1 / 1}>
          <textarea
            className={`${style.txtArea} w-full h-full p-4`}
            name="description"
            value={description}
            placeholder="The image shows a part with dimensions of 10mm (W), 25mm (H), and 5mm (D), made from stainless steel. I need a replacement part manufactured. Please contact me promptly...."
            onChange={(e) => handleChange(e, index, 'descriptions')}
            required
          />
        </AspectRatio>
        <Button variant="vegaNormalBtn" type="button" className={`${index === 0 ? 'hidden' : ''} w-full mt-2`} onClick={() => handleRemoveFields(index, 'descriptions')}>
          Remove
        </Button>
      </div>
    </div>
  );
};

export default MyJobAsk;