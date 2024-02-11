'use client'

import * as z from 'zod'
import { useState, useTransition } from 'react';
import  { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form'
import { CardWrapper } from '../card-wrapper';
import { MyFormSuccess } from '@/components//uicustom/forms/form-sucess';
import { MyFormError } from '@/components//uicustom/forms/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyRegisterAction } from '@/actions/register';
import { MyAuthRegisterSchema } from '@/schemas';

const MyLogPrefix = '[frontend/components/uicustom/auth/forms/register-form.tsx]'
export const MyRegisterform = () => {
    const [error, setError] = useState<string | undefined>('')
    const [success, setSuccess] = useState<string | undefined>('')
    const [isPending, startTransition] = useTransition();
    const form = useForm<z.infer<typeof MyAuthRegisterSchema>>({
      resolver: zodResolver(MyAuthRegisterSchema),
      defaultValues: {
        email: '',
        password: '',
        name: '',
        referredby: '',
      }
    }
    );

    const onSubmit = (values: z.infer<typeof MyAuthRegisterSchema>) => {
      console.log(`${MyLogPrefix} onSubmit 1/2 (values)`, values)
        setError('');
        setSuccess('');

      startTransition(() => {
        MyRegisterAction(values)
        .then ((data) =>{
            setError(data.error)
            setSuccess(data.success)
            if (data.success) {
              console.log(`${MyLogPrefix} onSubmit 2/2 (success)`, data)
            } else {
              console.log(`${MyLogPrefix} onSubmit 2/2 (error)`, data)
            }
        })
      });
    };
    return (
        <CardWrapper
        headerLabel='Create an account'
        backButtonLabel ='Already have an account? Login'
        backButtonHref='/auth/login'
        showSocial
        >
        <Form {...form}>
            <form 
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-6'
            >
              <div className='space-y-4'>
                <FormField control={form.control} name='name' render={({field}) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} placeholder='Choose a name' type='text'/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name='email' render={({field}) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} placeholder='Storman@Gwagon.com' type='email'/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name='password' render={({field}) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} placeholder='Choose a password' type='password'/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name='referredby' render={({field}) => (
                    <FormItem>
                      <FormLabel className='text-nowrap'><span className='flex flex-col text-[10px]'><span>{`(optional)`}</span></span>Referral</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isPending} placeholder='Referred by name or mail' type='text'/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
              </div>
              <MyFormError message={error}/>
              <MyFormSuccess message={success}/>
              <Button type='submit' disabled={isPending} className='w-full' variant='vegaEmeraldBtn'>
                Register
              </Button>
            </form>
        </Form>
        </CardWrapper>
    )
}