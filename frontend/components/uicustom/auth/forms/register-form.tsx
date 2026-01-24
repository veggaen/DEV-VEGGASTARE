'use client';

import * as z from 'zod';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CardWrapper } from '../card-wrapper';
import { MyFormSuccess } from '@/components/uicustom/forms/form-sucess';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyRegisterAction } from '@/actions/register';
import { MyAuthRegisterSchema } from '@/schemas';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload } from "react-icons/fa";
import { useEdgeStore } from '@/lib/edgestore';
import { uploadImageToEdgeStore } from '@/lib/edgestore-hook';
import { AspectRatio } from '@/components/ui/aspect-ratio';

const MyLogPrefix = '[frontend/components/uicustom/auth/forms/register-form.tsx]';

export const MyRegisterform = () => {
    const [error, setError] = useState<string | undefined>('');
    const [success, setSuccess] = useState<string | undefined>('');
    const [isPending, startTransition] = useTransition();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const { edgestore } = useEdgeStore();

    const form = useForm<z.infer<typeof MyAuthRegisterSchema>>({
        resolver: zodResolver(MyAuthRegisterSchema),
        defaultValues: {
            email: '',
            password: '',
            name: '',
            referredBy: '',
            image: '', // Image URL will be stored here after upload
        },
    });

    // Handle file drop and preview generation
    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });

    const uploadImage = async (file: File) => {
        try {
            const imageUrl = await uploadImageToEdgeStore(file, edgestore);
            return imageUrl;
        } catch (error) {
            console.error('Error uploading image:', error.message);
            throw error; // Let this error propagate to the onSubmit or wherever it is used
        }
    };

    const confirmImage = async (url: string) => {
        try {
            await edgestore.myPublicImages.confirmUpload({
                url: url,
            });
            console.log('Image confirmed:', url);
        } catch (error) {
            console.error('Error deleting image:', error);
        }
    };

    const onSubmit = async (values: z.infer<typeof MyAuthRegisterSchema>) => {
        setError('');
        setSuccess('');
        let uploadedImageUrl = '';

        startTransition(async () => {
            try {
                if (imageFile) {
                    uploadedImageUrl = await uploadImage(imageFile);
                    if (uploadedImageUrl) {
                        values.image = uploadedImageUrl;
                    } else {
                        setError('Failed to upload image. Please try again.');
                        return;  // Exit early if image upload fails
                    }
                }

                const data = await MyRegisterAction(values);
                
                if (data.error) {
                    setError(data.error);
                }
                if (data.success) {
                    setSuccess(data.success);
                    // Optional: Redirect user or perform other actions on success
                    if (uploadedImageUrl) {
                        console.log('Confirm Image')
                        await confirmImage(uploadedImageUrl);
                    }
                }
            } catch (error) {
                setError('Registration failed. Please try again.');
                console.error('Registration error:', error);
            }
        });
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    return (
        <CardWrapper
            headerLabel='Create an account'
            backButtonLabel='Already have an account? Login'
            backButtonHref='/auth/login'
            showSocial
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
                    <div className='space-y-4'>
                        <FormField control={form.control} name='name' render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input {...field} disabled={isPending} placeholder='Choose a name' type='text' />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name='email' render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input {...field} disabled={isPending} placeholder='Storman@Gwagon.com' type='email' />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name='password' render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <Input {...field} disabled={isPending} placeholder='Choose a password' type='password' />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name='referredBy' render={({ field }) => (
                            <FormItem>
                                <FormLabel className='text-nowrap'>
                                    <span className='flex flex-col text-[10px]'><span>{`(optional)`}</span></span>Referral
                                </FormLabel>
                                <FormControl>
                                    <Input {...field} disabled={isPending} placeholder='Referred by name or mail' type='text' />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name='image' render={({ field }) => (
                            <FormItem>
                                <FormLabel>Profile Image</FormLabel>
                                <FormControl>
                                    <input {...field} {...getInputProps()} type='file' hidden />
                                </FormControl>
                                <div {...getRootProps()} className='border border-dashed p-4 cursor-pointer'>
                                    {imagePreview ? (
                                        <div className='relative w-full h-full'>
                                            <div className='min-w-0 shrink-0 grow-0 basis-full flex justify-center'>
                                              <AspectRatio ratio={1 / 1}>
                                                <Image src={imagePreview} alt={`preview-image`} fill sizes="100%" priority className="object-fill rounded" />
                                              </AspectRatio>
                                            </div>
                                            <button type='button' onClick={removeImage} className='absolute top-1 right-1 bg-gray-800 p-1 rounded-full'>
                                                <RxCrossCircled className='h-5 w-5 text-white' />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className='text-center'>
                                            <FaFileUpload className='h-8 w-8 text-gray-600' />
                                            <p>Drag & drop or click to select an image</p>
                                        </div>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <MyFormError message={error} />
                    <MyFormSuccess message={success} />
                    <Button type='submit' disabled={isPending} className='w-full' variant='vegaEmeraldBtn'>
                        Register
                    </Button>
                </form>
            </Form>
        </CardWrapper>
    );
};