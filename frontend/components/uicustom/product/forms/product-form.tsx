'use client'

import * as z from 'zod'
import { useState, useTransition } from 'react';
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
import { UploadCloudIcon, User, XIcon } from 'lucide-react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { AspectRatio } from '@radix-ui/react-aspect-ratio';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useEdgeStore } from '@/lib/edgestore';
import { EdgeStoreApiClientError } from '@edgestore/react/shared';
import { Textarea } from '@/components/ui/textarea';
import { getUserById } from '@/data/user';

interface Specification {
  key: string;
  value: string;
  placeholder?: string;
}

const MyLogPrefix = '[frontend/components/uicustom/forms/product-form.tsx]'
export const MyProductCreationForm = () => {
    // General States
    const user = useCurrentUser();
    const { edgestore } = useEdgeStore();
    const [uId, setUId] = useState<string | undefined>(user?.id) // role admin to modify input value
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [specifications, setSpecifications] = useState<Specification[]>([{ key: 'Weight', value: '1g' }]);
    const examplePlaceholders = ['Weight', 'Height', 'Length', 'Width', 'Material', 'Color', 'Size', 'Brand', 'Model', 'Country of Origin', 'Warranty', 'Certification'];

    // UI States
    const [counter, setCounter] = useState(0);
    const [error, setError] = useState<string | undefined>('')
    const [success, setSuccess] = useState<string | undefined>('')
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isPendingSpecifications, startTransitionSpecifications] = useTransition();
    const form = useForm<z.infer<typeof MyProductCreateSchema>>({
      resolver: zodResolver(MyProductCreateSchema),
      defaultValues: {
        title: '',
        description: '',
        category: '',
        price: 0.0,
        stock: 0,
        userId: user?.id,
        image: [''],
        
      }
    }
    );

    // newest validateIsAdmin something reason...
    const validateIsAdmin = async (values: z.infer<typeof MyProductCreateSchema>) => {
      if (values.userId){
        console.log('Checking user role')
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
      if (counter <= 3){
        setCounter(counter >= 4 ? 4 : counter + 1);
        console.log(counter);
      }
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

    // Handle image removal
    const handleSpecificationChange = (index: number, field: 'key' | 'value', value: string) => {
      const updatedSpecifications = specifications.map((spec, specIndex) => (
        index === specIndex ? { ...spec, [field]: value } : spec
      ));
      setSpecifications(updatedSpecifications);
    };
    
    const removeSpecification = (index: number) => {
      const updatedSpecifications = specifications.filter((_, specIndex) => index !== specIndex);
      setSpecifications(updatedSpecifications);
    };
  
    const addSpecification = () => {
      setSpecifications([...specifications, { key: '', value: '' }]);
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

      if (specifications) {
        values.specifications = specifications.map((spec, i) => {
          return {
            key: spec.key,
            value: spec.value,
          };
        }
        )
      }
        
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
        setSpecifications([{ key: 'Weight', value: '1g' }]);
        form.reset();
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
  };

  const customStyles = {
      item: `group flex flex-col w-full items-start`,
      itemRole: `${ user?.role === UserRole.ADMIN ? 'group items-start hidden flex-col' : 'hidden' }`,
      label: `text-sm font-medium text-black/80 dark:text-white/80 group-focus-within:text-black dark:group-focus-within:text-white group-focus-within:scale-110 transition transform duration-300 ease-in-out`,
      input: `w-full border disabled:bg-white/60 bg-white dark:disabled:bg-black/50 dark:bg-black/70 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out`
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
                  <FormItem className={`${customStyles.item} items-end`}>
                    <FormLabel className={`${customStyles.label}`}>Price</FormLabel>
                    <FormControl>
                    <div className={'relative'} >
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
                      <Input {...field} disabled={user?.role === UserRole.ADMIN ? isPending : true} value={user?.role === UserRole.ADMIN ? uId : user?.id} onChange={e => (setUId(e.target.value))} placeholder='Your Id' type='text' className={`${customStyles.input}`} spellCheck='false'/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )}
              />
              <FormField control={form.control} name='specifications' render={({field}) => (
                <FormItem className={`${customStyles.item}`}>
                  <FormLabel className={`${customStyles.label}`}>Specifications</FormLabel>
                  <FormControl>
                    <div>
                    <div className={`hover:cursor-pointer py-2 px-4 rounded bg-black/30 my-2`} onClick={addSpecification}>Add Specification</div>
                      {
                        specifications.map((spec, index) => (
                          <div key={index}>
                              <div className={`flex gap-2 items-center`}>
                                  {/* <Input
                                    value={spec.key}
                                    onChange={(e) => handleSpecificationChange(index, 'key', e.target.value)}
                                    placeholder={spec.placeholder}
                                    type='text'
                                    spellCheck='false'
                                    /> */}
                                    <select
                                   /*  {...field} */
                                    name='specification'
                                    value={spec.key}
                                    onChange={(e) => handleSpecificationChange(index, 'key', e.target.value)}
                                    className="border p-2 rounded"
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
                <div {...getRootProps()} className={`disabled:bg-white/60 bg-white dark:disabled:bg-black/50 dark:bg-black/70 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded focus:outline-none transition dropzone flex flex-col h-full w-full justify-center items-center border border-dashed ${imagePreviews ? ' border-gray-600/60 dark:border-gray-600/60' : 'border-gray-400 dark:border-gray-400'} rounded-md cursor-pointer`}>
                  {imagePreviews.length < 1 && (
                    <div className="text-center flex flex-col min-h-48 justify-center items-center h-[420px] max-h-[420px]">
                      <UploadCloudIcon className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-200" />
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">
                      Drag n drop an IMAGE here, or click to select an IMAGE
                      </p>
                    </div>
                  )}
                  <div className={`grid grid-cols-${counter}`}>
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative m-1">
                          <Image src={preview} alt={`preview-${index}`} height={600} width={450} className="h-full w-full rounded-md object-cover hover:scale-95" /> {/* height={600} width={450} */}
                      </div>
                    ))}
                  </div>
                </div>
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
    </div>
  )
}