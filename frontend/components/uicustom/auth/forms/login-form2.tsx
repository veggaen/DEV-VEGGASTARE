'use client'

import * as z from 'zod'
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { CardWrapper } from '@/components/uicustom/auth/card-wrapper';
import { MyFormSuccess } from '@/components//uicustom/forms/form-sucess';
import { MyFormError } from '@/components//uicustom/forms/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyAuthLoginSchema } from '@/schemas';
import { useSearchParams, useRouter } from 'next/navigation';
import { MyLoginAction } from '@/actions/login';
import { signIn } from "next-auth/react"

const LOG_PREFIX = '[frontend/components/uicustom/auth/forms/login-form2.tsx]'
export const MyLoginForm2 = () => {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const urlError = searchParams.get("error") === "OAuthAccountNotLinked" ? "Email already in use with different provider!" : "";

  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [error, setError] = useState<string | undefined>('')
  const [success, setSuccess] = useState<string | undefined>('')
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof MyAuthLoginSchema>>({
    resolver: zodResolver(MyAuthLoginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  }
  );

  const onSubmit = (values: z.infer<typeof MyAuthLoginSchema>) => {
    console.log(`${LOG_PREFIX} onSubmit 1/2 (values)`, values)
      setError('');
      setSuccess('');
    startTransition(() => {
      MyLoginAction(values)
      .then ((data) =>{
        if ('error' in data){
          form.reset();
          setError(data.error)
          console.log(`${LOG_PREFIX} onSubmit 2/2 (data.error)`, data)
        }
        if ('success' in data) {
          console.log(`${LOG_PREFIX} onSubmit 2/2 (success)`, data)
          signIn('credentials', { redirectTo: callbackUrl ? callbackUrl : "/products" })
          setSuccess(data.success)
          form.reset();
        }

        if ('twoFactor' in data) {
          setShowTwoFactor(true);
          console.log(`${LOG_PREFIX} onSubmit 2/2 (twoFactor)`, data)
        }
      })
      .catch (() => setError('Something went wrong!'));
    });
  };

  return (
    <CardWrapper
      headerLabel='Embark on Discovery'
      backButtonLabel ='Dont have an account yet? Register'
      backButtonHref='/auth/register'
      showSocial
    >
      <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-6'
          >
            <div className='space-y-4'>
              {showTwoFactor && (
              <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Two Factor Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isPending}
                        placeholder="123456"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
              {!showTwoFactor && (
              <>
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
                    <Button size='sm' variant='link' asChild className='px-0 font-normal'>
                      <Link href='/auth/reset'>
                        Forgot Password?
                      </Link>
                    </Button>
                    <FormMessage />
                  </FormItem>
                )}/>
              </>
            )}
            </div>
            <MyFormError message={error || urlError}/>
            <MyFormSuccess message={success}/>
            <Button type='submit' disabled={isPending} className='w-full' variant='vegaEmeraldBtn'>
              {showTwoFactor ? 'Confirm' : 'Login'}
            </Button>
          </form>
      </Form>

    </CardWrapper>
  )
}