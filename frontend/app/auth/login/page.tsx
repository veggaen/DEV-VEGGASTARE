'use client';
/** @fileOverview Accessible account entry with server-validated credentials and two-factor flow. @stability stable */
import * as z from 'zod';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyAuthLoginSchema } from '@/schemas';
import { useSearchParams } from 'next/navigation';
import { MyLoginAction } from '@/actions/login';
import { MySocialAuth } from '@/components/uicustom/auth/buttons/social';
import DemoLoginButton from '@/components/uicustom/auth/demo-login-button';
import { AuthPageShell } from '@/components/uicustom/auth/auth-page-shell';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { MyFormSuccess } from '@/components/uicustom/forms/form-sucess';
import { IS_WEB3_CONFIGURED } from '@/lib/web3-config';
import dynamic from 'next/dynamic';
const WalletConnectChooser = dynamic(() => import('@/components/crypto-related/WalletConnectChooser'), { ssr: false });
const AppKitSignInBridge = dynamic(() => import('@/components/crypto-related/AppKitSignInBridge'), { ssr: false });

import { useClientReady } from '@/hooks/use-client-ready';

export default function LoginPage() {
  const ready = useClientReady();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const urlError = searchParams.get('error') === 'OAuthAccountNotLinked'
    ? 'This email uses a different sign-in method. Sign in using the method you originally chose, then manage linked accounts in Settings.' : '';
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [error, setError] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof MyAuthLoginSchema>>({ resolver: zodResolver(MyAuthLoginSchema), defaultValues: { email: '', password: '', code: '' } });

  const onSubmit = (values: z.infer<typeof MyAuthLoginSchema>) => {
    setError(''); setSuccess('');
    startTransition(async () => {
      try {
        const data = await MyLoginAction(values, callbackUrl);
        if ('error' in data) setError(data.error);
        if ('success' in data) {
          setSuccess(data.success);
          if ('redirectUrl' in data) window.location.assign(data.redirectUrl);
        }
        if ('twoFactor' in data) setShowTwoFactor(true);
      } catch { setError('Sign-in is temporarily unavailable. Please try again.'); }
    });
  };

  return <AuthPageShell title="Sign in to Veggat" description={<>New here? <Link href="/auth/register" className="font-medium text-foreground underline underline-offset-4">Create an account</Link></>}>
    {IS_WEB3_CONFIGURED && <AppKitSignInBridge />}
    {!showTwoFactor && <><MySocialAuth /><div className="my-6 flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" /></div></>}
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" aria-busy={!ready || isPending}>
        {showTwoFactor ? <FormField control={form.control} name="code" render={({ field }) => <FormItem>
          <FormLabel>Two-Factor Code</FormLabel>
          <p className="text-sm text-muted-foreground">Enter the code sent to your email.</p>
          <FormControl><Input {...field} disabled={!ready || isPending} placeholder="123456" autoComplete="one-time-code" inputMode="numeric" autoFocus className="h-12 text-base" /></FormControl>
          <FormMessage />
        </FormItem>} /> : <>
          <FormField control={form.control} name="email" render={({ field }) => <FormItem>
            <FormLabel>Email</FormLabel><FormControl><Input {...field} disabled={!ready || isPending} placeholder="you@example.com" type="email" autoComplete="email" autoCapitalize="none" className="h-12 text-base" /></FormControl><FormMessage />
          </FormItem>} />
          <FormField control={form.control} name="password" render={({ field }) => <FormItem>
            <FormLabel>Password</FormLabel><FormControl><Input {...field} disabled={!ready || isPending} type="password" autoComplete="current-password" className="h-12 text-base" /></FormControl><FormMessage />
          </FormItem>} />
          <Link href="/auth/reset" className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">Forgot password?</Link>
        </>}
        <MyFormError message={error || urlError} /><MyFormSuccess message={success} />
        <div className="sticky bottom-0 z-10 bg-background py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button type="submit" disabled={!ready || isPending || Boolean(success)} className="h-12 w-full text-base" variant="vegaEmeraldBtn">
            {isPending ? (showTwoFactor ? 'Verifying…' : 'Signing in…') : (showTwoFactor ? 'Verify Code' : 'Sign in')}
          </Button>
        </div>
      </form>
    </Form>
    {!showTwoFactor && <div className="mt-6 space-y-4 border-t border-border pt-6">
      <DemoLoginButton />
      {IS_WEB3_CONFIGURED ? <WalletConnectChooser><Button type="button" variant="outline" className="min-h-11 w-full">Connect with Web3</Button></WalletConnectChooser> :
        <p className="text-center text-sm text-muted-foreground">Wallet sign-in is unavailable. Use email or a provider above.</p>}
    </div>}
  </AuthPageShell>;
}
