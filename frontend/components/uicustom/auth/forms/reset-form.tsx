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

import { useClientReady } from '@/hooks/use-client-ready';

export const MyResetForm = () => {
  const ready = useClientReady();

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
      setError('');
      setSuccess('');
    startTransition(async () => {
      try {
        const data = await MyResetAction(values);
        if ('success' in data) {
          setSuccess(data.success)
        }
        if ('error' in data){
          setError(data.error)
        }
      } catch { setError('Password reset is temporarily unavailable. Please try again.'); }
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
          className='space-y-6' aria-busy={!ready || isPending}
        >
          <div className='space-y-4'>
            <FormField control={form.control} name='email' render={({field}) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!ready || isPending} placeholder='you@example.com' type='email' autoComplete='email' autoCapitalize='none' className='h-12 text-base'/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
          </div>
          <MyFormError message={error}/>
          <MyFormSuccess message={success}/>
          <Button type='submit' disabled={!ready || isPending || Boolean(success)} className='h-12 w-full text-base' variant='vegaEmeraldBtn'>
            {isPending ? 'Sending…' : 'Send reset email'}
          </Button>
        </form>
      </Form>

    </CardWrapper>
  )
}
