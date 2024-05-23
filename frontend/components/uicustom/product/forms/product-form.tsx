'use client'

import * as z from 'zod'
import { useState, useEffect, useTransition } from 'react';
import  { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyProductCreateSchema } from '@/schemas';
import { MyFormError } from '../../forms/form-error';
import { MyFormSuccess } from '../../forms/form-sucess';
import { MyCreateProductAction } from '@/actions/products';
import { useCurrentUser } from '@/hooks/use-current-user';
import { UserRole } from '@prisma/client';
import { UploadCloudIcon, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { Textarea } from '@/components/ui/textarea';
import { getUserById } from '@/data/user';
import { debounce } from 'lodash';
import UserCompanyPermission, { UserCompanyProductManagement } from '../../user-company-permission';
import UserPermissionCheck from '../../UserPermissionCheck';
import { useCurrentUserEmployeeCheckPermission } from '@/hooks/use-current-user-employee-permissions';

interface PostalCodeDetails {
  postal_code: string;
  city: string;
  municipalityId: string;
  municipality: string;
  county: string;
  po_box: boolean;
  latitude: string;
  longitude: string;
}

interface PostalCodesResponse {
  postal_codes: PostalCodeDetails[];
}

interface Specification {
  key: string;
  value: string | number;
  placeholder?: string;
}


const MyLogPrefix = '[frontend/components/uicustom/forms/product-form.tsx]'
export const MyProductCreationForm = () => {
    // General States
    const clientUser = useCurrentUser();
    const { edgestore } = useEdgeStore();
    const [uId, setUId] = useState<string | undefined>(clientUser?.id) // role admin to modify input value
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isPhysicalProduct, setIsPhysicalProduct] = useState<boolean >(false);
    const [specifications, setSpecifications] = useState<Specification[]>([]);
    const examplePlaceholders = ['Weight', 'Height', 'Length', 'Width', 'Material', 'Color', 'Size', 'Brand', 'Model', 'Country of Origin', 'Warranty', 'Certification'];
    const [postalCodeInput, setPostalCodeInput] = useState('');
    const [suggestions, setSuggestions] = useState<PostalCodeDetails[]>([]);
    const [postalCode, setPostalCode] = useState('');
    const [postalCodeDetails, setPostalCodeDetails] = useState<PostalCodesResponse | null>(null);
    const [selectedPostalCodeDetail, setSelectedPostalCodeDetail] = useState<PostalCodeDetails | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    //newest
    const [ companyId, setCompanyId] = useState();
    const [company, setCompany] = useState('');
    const [ permissionTag, setPermissionTag] = useState('CAN_POST_PRODUCT_POSITION_PERMISSION');
    const { permissions, isPermissionAvailable, isLoading: isPermissionsLoading, error: isPermissionError } = useCurrentUserEmployeeCheckPermission(clientUser, companyId, permissionTag);

    // UI States
    const [counter, setCounter] = useState(0);
    var counterVar = 1
    const [error, setError] = useState<string | undefined>('')
    const [success, setSuccess] = useState<string | undefined>('')
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isPendingSpecifications, startTransitionSpecifications] = useTransition();
    const [isLoading, setIsLoading] = useState(false);
    const form = useForm<z.infer<typeof MyProductCreateSchema>>({
      resolver: zodResolver(MyProductCreateSchema),
      defaultValues: {
        title: '',
        description: '',
        category: '',
        price: 0.0,
        stock: 0,
        userId: clientUser?.id,
        image: [''],
        
      }
    }
    );

    // Assuming you've set the country code statically as 'no' for Norway
    const countryCode = 'no';

    // Fetch postal code details with debounce
    const fetchPostalCodeDetails = async (postalCode: string) => {
      if (!postalCode) {
        setSuggestions([]);
        return;
      }
    
      setIsLoading(true);
      try {
        // Prepare fetch requests for the first two pages
        const pageRequests = [1, 2].map(page =>
          fetch(`/api/bring-shipping-suggest-postcode?postalCode=${postalCode}&page=${page}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }).then(response => {
            if (!response.ok) throw new Error(`Failed to fetch page ${page}`);
            return response.json() as Promise<PostalCodesResponse>;
          })
        );
    
        // Wait for all fetch requests to complete
        const pagesData = await Promise.all(pageRequests);
    
        // Combine postal codes from all fetched pages
        const combinedPostalCodes = pagesData.flatMap(data => data.postal_codes);
    
        setSuggestions(combinedPostalCodes);
        // Optionally, handle pagination based on the response
      } catch (error) {
        console.error('Error fetching postal code suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    useEffect(() => {
      if (postalCodeInput) {
        fetchPostalCodeDetails(postalCodeInput);
      }
    }, [postalCodeInput]);

    // newest validateIsAdmin something reason...
    const validateIsAdmin = async (values: z.infer<typeof MyProductCreateSchema>) => {
      if (values.userId){
        console.log('Checking clientUser role')
        console.log('Validation is admin 1/2');
        startTransitionSpecifications(async () => {
        await getUserById(values.userId)
        .then((data) =>{
        console.log(`${MyLogPrefix} validateIsAdmin(data)`, data)
        console.log(`${MyLogPrefix} validateIsAdmin(data.role)`, data?.role)
        if (data?.role === UserRole.ADMIN){
          console.log(`${MyLogPrefix} validateIsAdmin(data.role) 2/2`, data?.role)
          // return true;
        } else {
          console.log(`${MyLogPrefix} validateIsAdmin(data.role) 2/2`, data?.role.toString())
          // return false;
        }
        })
      });
      }
    };

    // Function to handle image field changes
    const onDrop = (acceptedFiles: File[]) => {
      setImages([...images, ...acceptedFiles]);
      const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
      setImagePreviews([...imagePreviews, ...newPreviews]);
      if (counter === 0){
        setCounter(1);
      } else {
        setCounter(counter + 1);
      }
      console.log(counter);
    };

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: true,
    });
    
    // Update the image upload handler to manage multiple images
    const imageHandeler = async () => {
      let uploadedUrls = [];
      for (let image of images) {
          try {
              const uploadResult = await edgestore.myPublicImages.upload({ file: image });
              uploadedUrls.push(uploadResult.url);
          } catch (error) {
              console.error('Upload error', error);
          }
      }
      return uploadedUrls;
    };

    // Function to handle image removal
    const removeImage = (e: any, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      // Update images state by filtering out the image at the specified index
      const newImages = images.filter((_, i) => i !== index);
      setImages(newImages);
      if (counter > 0){
        setCounter(counter - 1);
      }
      // Update imagePreviews state similarly
      const newImagePreviews = imagePreviews.filter((_, i) => i !== index);
      setImagePreviews(newImagePreviews);
    };
    
    // Function to handle changes in specifications
    const handleSpecificationChange = (
      index: number,
      field: 'key' | 'value',
      value: string
    ) => {
      const updatedSpecifications = specifications.map((spec, specIndex) =>
        index === specIndex
          ? {
              ...spec,
              [field]:
                spec.key === 'Weight' || spec.key === 'Height' || spec.key === 'Length' || spec.key === 'Width' && field === 'value'
                  ? parseFloat(value) || 0 // Convert string to number for specific keys like 'Weight'
                  : value,
            }
          : spec
      );
      setSpecifications(updatedSpecifications);
    };
    
    const removeSpecification = (index: number) => {
      const updatedSpecifications = specifications.filter((_, specIndex) => index !== specIndex);
      setSpecifications(updatedSpecifications);
    };
  
    const addSpecification = () => {
      // Define the keys to exclude when isPhysicalProduct is false
      const excludeKeys = ['Weight', 'Height', 'Length', 'Width'];
    
      const filteredPlaceholders = isPhysicalProduct
        ? examplePlaceholders
        : examplePlaceholders.filter(placeholder => !excludeKeys.includes(placeholder));
    
      const nextPlaceholder = filteredPlaceholders.find(placeholder => 
        !specifications.some(spec => spec.key === placeholder)
      );
    
      const newSpec = {
        key: nextPlaceholder || '',
        value: ''
      };
    
      setSpecifications([...specifications, newSpec]);
    };

    const onSubmit = async (values: z.infer<typeof MyProductCreateSchema>) => {
      setError('');
      setSuccess('');

      if (images){
        const resUploadedImageUrls = await imageHandeler()
        if (resUploadedImageUrls.length > 0){
          values.image = resUploadedImageUrls;
        } else {
          setError('Error image not found? Please try again!');
          return;
        }
      }

      // Ensure specifications are correctly formatted
      const formattedSpecifications = specifications.map((spec) => {
        return {
          key: spec.key,
          value:
            typeof spec.value === 'number'
              ? spec.value
              : spec.key === 'Weight'
              ? parseFloat(spec.value.toString()) || 0
              : spec.value, // Only convert 'Weight' or other specified keys to numbers
        };
      });

      // Check if there are specifications before formatting and assigning them
      if (specifications && specifications.length > 0) {
        const formattedSpecifications = specifications.map((spec) => {
          // Ensure numeric values are converted to numbers for specific keys like 'Weight'
          return {
            key: spec.key,
            value: spec.key === 'Weight' ? parseFloat(spec.value.toString()) || 0 : spec.value,
          };
        });

        // Assign formatted specifications to the values object for submission
        values.specifications = formattedSpecifications;
      }

      values.shipFromPostalId =  postalCode;

      console.log(`${MyLogPrefix} onSubmit 1/2 (values)`, values)
      startTransition(() => {
        validateIsAdmin(values)
        MyCreateProductAction(values)
        .then ((data) =>{
            console.log(`${MyLogPrefix} onSubmit(data)`, data)
            if (data.error){
              setError(data.error)
            }
            if (data.success) {
              setSuccess(data.success)
              handleReset()
              
              console.log(`${MyLogPrefix} onSubmit 2/2 (success)`, data)
            } else {
              console.log(`${MyLogPrefix} onSubmit 2/2 (error. Failed)`, data)
            }
        })
      });
    };

  const handleStartEdit = () => {
    console.log('clicked edit')
    setIsEditing(!isEditing);
    handleReset()
  };
  const handleCancelEdit = () => {
    form.reset();
    setIsEditing(false);
    // setShowInput(false);
    setCounter(0);
    setImagePreviews([]);
    handleReset();
  };

  const handleReset = () => {
      if (error !== '' || success !== undefined) {
        // Clear any existing values when starting to edit
        setCounter(0);
        setError('');
        setImages([]);
        setImagePreviews([]);
        setSpecifications([]);
        setIsPhysicalProduct(false);
        form.reset();
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
  };

  const handlePhysicalProduct = () => {
    setIsPhysicalProduct(!isPhysicalProduct)
  }
  
  useEffect(() => {
    console.log(isPhysicalProduct)
    if (isPhysicalProduct == true){
      // Define the specifications to add if they don't already exist
      const physicalSpecsToAdd = [
        { key: 'Weight', value: '1' },
        { key: 'Height', value: '10' },
        { key: 'Length', value: '10' },
        { key: 'Width', value: '10' }
      ];

      // Filter out the physical specs to ensure we're not adding duplicates
      const existingPhysicalSpecs = specifications.filter(spec => 
        ['Weight', 'Height', 'Length', 'Width'].includes(spec.key)
      );

      // Create a set of keys for the existing specifications for quick lookup
      const existingKeys = new Set(existingPhysicalSpecs.map(spec => spec.key));

      // Add each physical spec to the array only if it doesn't already exist
      physicalSpecsToAdd.forEach(specToAdd => {
        if (!existingKeys.has(specToAdd.key)) {
          specifications.push(specToAdd);
        }
      });

      // Since we directly modified the specifications array, we call setSpecifications
      // with a new array to trigger a state update
      setSpecifications([...specifications]);
    } else {
      // Remove 'Weight', 'Height', 'Length', and 'Width' specifications
      const filteredSpecifications = specifications.filter(spec => 
        !['Weight', 'Height', 'Length', 'Width'].includes(spec.key)
      );
      setSpecifications(filteredSpecifications);
    }
  }, [isPhysicalProduct])

  const handleSelectChange = (e: any) => {
    const selectedValue = e.target.value;
    const selectedPostalCodeData = suggestions.find(suggestion => suggestion.postal_code === selectedValue);
    console.log('selectedPostalCodeDetail', selectedPostalCodeData);
    setSelectedPostalCodeDetail(selectedPostalCodeData ?? null); // Update the selected detail state
    setPostalCode(selectedValue); // Also update the postalCode state to reflect this change in the postal code input
  };

  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const handleCompanySelect = (companyId) => {
    console.log(`Selected company ID: ${companyId}`);
    setSelectedCompanyId(companyId);
    // Perform additional actions with the selected company ID, such as:
    // - Fetching and displaying company details
    // - Updating application state or context
    // - Triggering side effects related to the company selection
  };

  const customStyles = {
      item: `group flex flex-col w-full items-start`,
      itemRole: `${ clientUser?.role === UserRole.ADMIN ? 'group items-start hidden flex-col' : 'hidden' }`,
      label: `text-sm font-medium text-black/80 dark:text-white/80 group-focus-within:text-black dark:group-focus-within:text-white group-focus-within:scale-110 transition transform duration-300 ease-in-out`,
      input: `w-full border disabled:bg-white/60 bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out`
  }

  return (
    <div className='w-full h-full'>
      <Form {...form}>
        <form 
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex justify-center w-full'
        >
          <div className='flex flex-col justify-center items-start lg:flex-row w-full h-full  bg-neutral-300 dark:bg-slate-700 max-w-[1440px] rounded-xl overflow-hidden shadow-lg'>
            <div className='gap-y-2 flex flex-col justify-start items-start w-full h-full py-2 pb-4 px-4 lg:w-4/6'>
              <FormField control={form.control} name='title' render={({field}) => (
                  <FormItem className={`${customStyles.item}`}>
                    <FormLabel className={`${customStyles.label} text-lg font-bold`}>Title</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} placeholder='Choose a title' type='text' className={`${customStyles.input}`} spellCheck='false' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )}
              />
              <FormField control={form.control} name='category' render={({field}) => (
                  <FormItem className={`${customStyles.item}`}>
                    <FormLabel className={`${customStyles.label}`}>Category</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} placeholder='Choose a category' type='text' className={`${customStyles.input} spellCheck='false'`}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )}
              />
              <FormField control={form.control} name='description' render={({field}) => (
                  <FormItem className={`${customStyles.item}`}>
                    <FormLabel className={`${customStyles.label}`}>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isPending} placeholder='This product is great because I made it myself' className={`${customStyles.input} h-40 text-wrap no-underline`} spellCheck='false'/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )}
              />
              <FormField control={form.control} name='price' render={({field}) => (
                  <FormItem className={`${customStyles.item}`}>
                    <FormLabel className={`${customStyles.label}`}>Price</FormLabel>
                    <FormControl>
                    <div className={'relative w-full items-end'} >
                      <div className={`pointer-events-none absolute inset-y-0 right-2 flex items-center pl-3 `}>
                        <span className=' sm:text-sm z-10 group-focus-within:scale-110 transition transform duration-300 ease-in-out '>$</span>
                      </div>
                      <Input
                        {...field}
                        disabled={isPending}
                        placeholder='Set a price'
                        type='text'
                        step='1' // Assuming you want to allow decimal values
                        className={`${customStyles.input} text-end appearance-none pr-6`}
                        spellCheck='false'
                        onChange={e => {
                            // Parse the input value as a float and update the form field
                            const value = e.target.value;
                            form.setValue('price', value ? parseFloat(value) : 0, { shouldValidate: true });
                          }} 
                      />
                    </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )}
              />
              <FormField control={form.control} name='userId' render={({field}) => (
                  <FormItem className={`${customStyles.itemRole}`}>
                    <FormLabel className={`${customStyles.label}`}>UserID</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={clientUser?.role === UserRole.ADMIN ? isPending : true} value={clientUser?.role === UserRole.ADMIN ? uId : clientUser?.id} onChange={e => (setUId(e.target.value))} placeholder='Your Id' type='text' className={`${customStyles.input}`} spellCheck='false'/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )}
              />
              <div className={`flex flex-col gap-4 justify-center items-start w-full`}>
                <FormLabel htmlFor='checkbox-isPhysicalProduct' className={`${customStyles.label} text-md`}>
                  Is this a physical product?
                </FormLabel>
                <label
                htmlFor='checkbox-isPhysicalProduct'
                className='hover:cursor-pointer group flex gap-4 justify-start items-center py-2 px-4 w-full border disabled:bg-white/60 bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/50 dark:hover:bg-black/40 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out'
                title={
                  isPhysicalProduct 
                    ? "Yes, this is a tangible product. Please provide detailed specifications including weight and dimensions, as these are necessary for accurate shipping calculations." 
                    : "No, this is a digital product. No shipping details are required. However, you may still provide relevant specifications that describe your product to potential buyers."
                }
                >
                  <div className={'flex gap-4 justify-start items-center '} >
                    <input
                      className={`${customStyles.input} group-hover:bg-slate-200 `}
                      type="checkbox"
                      id={`checkbox-isPhysicalProduct`} // Ensure unique ID

                      onChange={() => handlePhysicalProduct()}
                    />
                    <p className={``}>
                      {isPhysicalProduct === true ? 'Yes' : 'No'}
                    </p>
                  </div>
                </label>
                {isPhysicalProduct === true && 
                <div>
                  <FormField control={form.control} name='shipFromPostalId' render={({field}) => (
                    <FormItem className={`${customStyles.item}`}>
                      <FormLabel className={`${customStyles.label}`}>Warehouse postal code</FormLabel>
                      <FormControl>
                        <Input {...field} id='postalCode' 
                        disabled={isPending} 
                        placeholder='postal ID' 
                        type='text' 
                        value={postalCode}
                        onChange={(e) => {
                          const newPostalCode = e.target.value;
                          setPostalCode(newPostalCode);
                          fetchPostalCodeDetails(newPostalCode);
                        }}
                        className={`${customStyles.input} postal-code-input`}
                        spellCheck='false'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    )}
                  />
                  {suggestions.length > 0 && (
                    <>
                      <select
                        onChange={handleSelectChange}
                        className={`${customStyles.input}`}
                      >
                        {suggestions
                          .filter((suggestion) => suggestion.postal_code.startsWith(postalCodeInput) || suggestion.city.toLowerCase().includes(postalCodeInput.toLowerCase()))
                          .map((filteredSuggestion, index) => (
                            <option key={index} value={filteredSuggestion.postal_code}>
                              {filteredSuggestion.postal_code} - {filteredSuggestion.city}
                            </option>
                          ))}
                      </select>
                    </>
                  )}
                </div>
                }
              </div>
              <FormField control={form.control} name='specifications' render={({field}) => (
                <FormItem className={`${customStyles.item}`}>
                  <FormLabel className={`${customStyles.label}`}>Specifications</FormLabel>
                  <FormControl>
                    <div>
                    <div
                      className={`hover:cursor-pointer py-2 px-4 my-2 w-fit bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/60 dark:hover:bg-black/50 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded`}
                      onClick={addSpecification}
                      title="Ads a specification to the product."
                    >
                      Add Specification
                    </div>
                      {
                        specifications.map((spec, index) => (
                          <div key={index}>
                              <div className={`flex gap-2 items-center `}>
                                  {/* <Input
                                    value={spec.key}
                                    onChange={(e) => handleSpecificationChange(index, 'key', e.target.value)}
                                    placeholder={spec.placeholder}
                                    type='text'
                                    spellCheck='false'
                                    /> */}
                                  <select
                                    name="specification"
                                    value={spec.key}
                                    onChange={(e) => handleSpecificationChange(index, 'key', e.target.value)}
                                    title="Select the specification type"
                                    className="border p-2 bg-white dark:disabled:bg-black/50 dark:bg-black/70 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded"
                                  >
                                    {examplePlaceholders.map((placeholder, i) => (
                                      <option key={i} value={placeholder}>{placeholder}</option>
                                    ))}
                                  </select>
                                  <Input
                                    value={spec.value}
                                    onChange={(e) => handleSpecificationChange(index, 'value', e.target.value)}
                                    placeholder="Value"
                                    type='text'
                                    spellCheck='false'
                                    title={
                                      spec.key === 'Weight' ? "Enter weight in grams" :
                                      ['Height', 'Length', 'Width'].includes(spec.key) ? "Enter measurements in centimeters" :
                                      ""
                                    }
                                    />
                                  <div className={`hover:cursor-pointer py-2 px-4 rounded bg-black/30 m-2`} onClick={(event) => removeSpecification(index)}>Remove</div>
                                </div>
                            </div>
                        ))
                      }
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              />
            </div>
            
            <div className='w-full h-full'>
              <div className="w-full h-full py-2 pt-4 px-4 flex flex-col items-start">
                <FormField control={form.control} name='image' render={({field}) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} disabled={isPending} name='image' spellCheck='false' {...getInputProps()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <div {...getRootProps()} className={`disabled:bg-white/60 bg-white dark:disabled:bg-black/50 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded focus:outline-none transition dropzone flex flex-col h-full w-full justify-center items-center border border-dashed ${imagePreviews ? ' border-gray-600/60 dark:border-gray-600/60' : 'border-gray-400 dark:border-gray-400'} rounded-md cursor-pointer`}>
                  {imagePreviews.length < 1 && (
                    <div className="text-center flex flex-col min-h-48 justify-center items-center h-[420px] max-h-[420px]">
                      <UploadCloudIcon className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-200" />
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">
                      Drag n drop an IMAGE here, or click to select an IMAGE
                      </p>
                    </div>
                  )}
                  <div className={`grid ${counter == 2 ? 'grid-cols-2' : counter == 3 ? 'grid-cols-3' : counter >= 4 ? 'grid-cols-4' : 'grid-cols-1'}`}>
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative m-1">
                        <Image src={preview} alt={`preview-${index}`} height={600} width={450} className="h-full w-full rounded-md object-cover" />
                        <div onClick={(e) => removeImage(e, index)} className="absolute top-1 right-1 hover:scale-110 transform duration-300 bg-gray-800/30 hover:bg-red-600/40 text-white p-1 rounded-full">
                          <XCircle className="h-4 w-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* <UserCompanyProductManagement /> */}
                <div className='w-full py-2'>
                  <MyFormError message={error}/>
                  <MyFormSuccess message={success}/>
                  <Button type='submit' disabled={isPending} className='w-full' variant='vegaEmeraldBtn'>
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>
      <UserCompanyPermission permissionTag="CAN_POST_PRODUCT_POSITION_PERMISSION" onCompanySelect={handleCompanySelect} />
      <UserPermissionCheck companyId={'clu34rawz0002xik69hsmz0fx'} clientUser={clientUser} permissionTag='CAN_POST_PRODUCT_POSITION_PERMISSION' />
    </div>
  )
}