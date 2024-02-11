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
import { MyResetAction } from '@/actions/reset';
import { MyAuthResetSchema } from '@/schemas';

const MyLogPrefix = '[frontend/components/uicustom/auth/forms/reset-form.tsx]'
export const MyResetForm = () => {

  const [error, setError] = useState<string | undefined>('')
  const [success, setSuccess] = useState<string | undefined>('')
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof MyAuthResetSchema>>({
    resolver: zodResolver(MyAuthResetSchema),
    defaultValues: {
      email: '',
    }
  }
  );

  const onSubmit = (values: z.infer<typeof MyAuthResetSchema>) => {
    console.log(`${MyLogPrefix} onSubmit 1/2 (values)`, values)
      setError('');
      setSuccess('');
    startTransition(() => {
      MyResetAction(values)
      .then ((data) =>{
        if (data?.success) {
          setSuccess(data.success)
          console.log(`${MyLogPrefix} onSubmit 2/2 (success)`, data)
        }
        if (data?.error){
          setError(data.error)
          console.log(`${MyLogPrefix} onSubmit 2/2 (data.error)`, data)
        }
      })
    });
  };

  return (
    <CardWrapper
      headerLabel='Forgot your password?'
      backButtonLabel ='Back to Login'
      backButtonHref='/auth/login'
    >
      <Form {...form}>
        <form 
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
        >
          <div className='space-y-4'>
            <FormField control={form.control} name='email' render={({field}) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} placeholder='Storman@Gwagon.com' type='email'/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
          </div>
          <MyFormError message={error}/>
          <MyFormSuccess message={success}/>
          <Button type='submit' disabled={isPending} className='w-full' variant='vegaEmeraldBtn'>
            Send reset email
          </Button>
        </form>
      </Form>

    </CardWrapper>
  )
}