'use client';

import * as z from 'zod';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyAuthLoginSchema } from '@/schemas';
import { useSearchParams } from 'next/navigation';
import { MyLoginAction } from '@/actions/login';
import { signIn } from 'next-auth/react';
import { MySocialAuth } from '@/components/uicustom/auth/buttons/social';
import { FiMail, FiLock, FiArrowRight, FiShield, FiZap, FiUsers, FiSun, FiMoon } from 'react-icons/fi';

const LOG_PREFIX = '[frontend/app/auth/login/page.tsx]';

export default function LoginPage() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const callbackUrl = searchParams.get('callbackUrl');
  const urlError = searchParams.get('error') === 'OAuthAccountNotLinked'
    ? 'This email is registered with a different sign-in method. Please use email/password to log in, then link your Google account in Settings.'
    : '';

  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [error, setError] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof MyAuthLoginSchema>>({
    resolver: zodResolver(MyAuthLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: z.infer<typeof MyAuthLoginSchema>) => {
    console.log(`${LOG_PREFIX} onSubmit`, values);
    setError('');
    setSuccess('');

    startTransition(() => {
      MyLoginAction(values)
        .then((data) => {
          if ('error' in data) {
            form.reset();
            setError(data.error);
          }
          if ('success' in data) {
            signIn('credentials', { redirectTo: callbackUrl || '/products' });
            setSuccess(data.success);
            form.reset();
          }
          if ('twoFactor' in data) {
            setShowTwoFactor(true);
          }
        })
        .catch(() => setError('Something went wrong!'));
    });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex bg-white dark:bg-black">
      {/* Theme Toggle - Fixed position */}
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label="Toggle theme"
      >
        {resolvedTheme === 'dark' ? (
          <FiSun className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        ) : (
          <FiMoon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        )}
      </button>

      {/* Left side - Hero/Brand */}
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, x: -20 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
      >
        {/* Clean solid background */}
        <div className="absolute inset-0 bg-zinc-900 dark:bg-zinc-950" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
              Welcome back —<br />
              <span className="text-zinc-300">
                the Vibe&apos;s still beating
              </span>
            </h1>
            <p className="text-zinc-400 text-lg mb-12 max-w-md">
              Sync with your community. Pulse your thoughts. Feel the ripple.
            </p>
          </motion.div>

          {/* Feature highlights */}
          <motion.div
            className="space-y-4"
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {[
              { icon: FiZap, text: 'Pulse out — let the world feel the beat' },
              { icon: FiUsers, text: 'Heartbeat what moves you. Vibe it wider.' },
              { icon: FiShield, text: 'Your rhythm. Your data. Your control.' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-zinc-300">{feature.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right side - Login Form */}
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, x: 20 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-12 py-12"
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              The Vibe&apos;s Still Beating
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">Sign in and sync back into the rhythm</p>
          </div>

          {/* Form Header */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Sign in</h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="text-zinc-900 dark:text-white hover:underline font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>

          {/* Social Auth */}
          <div className="mb-6">
            <MySocialAuth />
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-black text-zinc-400 dark:text-zinc-500">or continue with email</span>
            </div>
          </div>

          {/* Login Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {showTwoFactor ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 dark:text-zinc-200 text-sm font-medium">
                          Two-Factor Code
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="123456"
                              className="pl-10 h-12 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400/20 rounded-xl"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </motion.div>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 dark:text-zinc-200 text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="you@example.com"
                              type="email"
                              className="pl-10 h-12 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400/20 rounded-xl"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-zinc-700 dark:text-zinc-200 text-sm font-medium">Password</FormLabel>
                          <Link
                            href="/auth/reset"
                            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="••••••••"
                              type="password"
                              className="pl-10 h-12 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400/20 rounded-xl"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Error/Success Messages */}
              {(error || urlError) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm"
                >
                  {error || urlError}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm"
                >
                  {success}
                </motion.div>
              )}

              {/* Submit Button - Clean neutral style */}
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-12 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
              >
                {isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    {showTwoFactor ? 'Verifying...' : 'Signing in...'}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {showTwoFactor ? 'Verify Code' : 'Sign in'}
                    <FiArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </form>
          </Form>

          {/* Mobile Register Link */}
          <p className="lg:hidden text-center text-zinc-500 dark:text-zinc-400 text-sm mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-zinc-900 dark:text-white hover:underline font-medium">
              Sign up
            </Link>
          </p>

          {/* Terms */}
          <p className="text-center text-zinc-400 dark:text-zinc-500 text-xs mt-8">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline">Privacy Policy</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
