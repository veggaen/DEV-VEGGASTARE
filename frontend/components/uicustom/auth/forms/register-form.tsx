'use client';
/** @fileOverview Focused signup; avatar uploads belong to authenticated profile settings. @stability stable */
import * as z from 'zod';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MySocialAuth } from '../buttons/social';
import { MyRegisterAction } from '@/actions/register';
import { MyAuthRegisterSchema } from '@/schemas';
import Link from 'next/link';

import { useClientReady } from '@/hooks/use-client-ready';

export const MyRegisterform = () => {
  const ready = useClientReady();
  const [error, setError] = useState<string | undefined>('');
  const [isPending, startTransition] = useTransition();
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const form = useForm<z.infer<typeof MyAuthRegisterSchema>>({ resolver: zodResolver(MyAuthRegisterSchema), defaultValues: { email: '', password: '', name: '', referredBy: '', image: '' } });
  const onSubmit = (values: z.infer<typeof MyAuthRegisterSchema>) => {
    setError('');
    startTransition(async () => {
      try {
        const data = await MyRegisterAction(values);
        if ('error' in data) setError(data.error);
        if ('success' in data) setAwaitingVerification(true);
      } catch { setError('Registration is temporarily unavailable. Please try again.'); }
    });
  };
  if (awaitingVerification) return <div className="space-y-5">
    <div role="status" className="rounded-xl border border-brand-accent/30 bg-brand-accent/10 p-5 text-sm leading-relaxed">
      <h2 className="font-semibold">Check your email to verify!</h2>
      <p className="mt-2">Open the verification link to finish creating your account. Check your spam folder if it has not arrived.</p>
    </div>
    <Button asChild variant="outline" className="min-h-12 w-full"><Link href="/auth/login">Back to sign in</Link></Button>
  </div>;
  return <div>
    <MySocialAuth />
    <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />or sign up with email<span className="h-px flex-1 bg-border" /></div>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" aria-busy={!ready || isPending}>
        <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} disabled={!ready || isPending} placeholder="Choose a name" autoComplete="name" className="h-12 text-base" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} disabled={!ready || isPending} placeholder="you@example.com" type="email" autoComplete="email" autoCapitalize="none" className="h-12 text-base" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} disabled={!ready || isPending} placeholder="At least 8 characters" type="password" autoComplete="new-password" className="h-12 text-base" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="referredBy" render={({ field }) => <FormItem><FormLabel>Referral <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input {...field} disabled={!ready || isPending} placeholder="Referrer's name or email" className="h-12 text-base" /></FormControl><FormMessage /></FormItem>} />
        <p className="text-sm text-muted-foreground">You can add a profile photo in Settings after signing in.</p>
        <MyFormError message={error} />
        <div className="sticky bottom-0 z-10 bg-background py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button type="submit" disabled={!ready || isPending} className="h-12 w-full text-base" variant="vegaEmeraldBtn">{isPending ? 'Creating account…' : 'Register'}</Button>
        </div>
      </form>
    </Form>
  </div>;
}
