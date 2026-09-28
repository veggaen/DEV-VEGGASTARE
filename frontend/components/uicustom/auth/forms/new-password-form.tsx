'use client'

import * as z from 'zod'
import { useState, useTransition } from 'react';
import  { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form'

import { MyFormSuccess } from '@/components//uicustom/forms/form-sucess';
import { MyFormError } from '@/components//uicustom/forms/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyNewPasswordAction } from '@/actions/new-password';
import { MyAuthNewPasswordSchema } from '@/schemas';
import { useSearchParams } from 'next/navigation';
import { CardWrapper } from '@/components/uicustom/auth/card-wrapper';

import { useClientReady } from '@/hooks/use-client-ready';

export const MyNewPasswordForm = () => {
  const ready = useClientReady();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [error, setError] = useState<string | undefined>('')
  const [success, setSuccess] = useState<string | undefined>('')
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof MyAuthNewPasswordSchema>>({
    resolver: zodResolver(MyAuthNewPasswordSchema),
    defaultValues: {
      password: '',
    }
  }
  );

  const onSubmit = (values: z.infer<typeof MyAuthNewPasswordSchema>) => {
      setError('');
      setSuccess('');
    startTransition(async () => {
      try {
        const data = await MyNewPasswordAction(values, token);
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
      headerLabel='Enter a new password'
      backButtonLabel ='Back to Login'
      backButtonHref='/auth/login'
    >
      <Form {...form}>
        <form 
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6' aria-busy={!ready || isPending}
        >
          <div className='space-y-4'>
            <FormField control={form.control} name='password' render={({field}) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!ready || isPending} placeholder='At least 8 characters' type='password' autoComplete='new-password' className='h-12 text-base'/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
          </div>
          <MyFormError message={error}/>
          <MyFormSuccess message={success}/>
          <Button type='submit' disabled={!ready || isPending || Boolean(success)} className='w-full min-h-12' variant='vegaEmeraldBtn'>
            {isPending ? 'Updating…' : 'Reset Password'}
          </Button>
        </form>
      </Form>

    </CardWrapper>
  )
}
