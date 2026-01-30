'use client';

import * as z from 'zod';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyAuthLoginSchema } from '@/schemas';
import { useSearchParams } from 'next/navigation';
import { MyLoginAction } from '@/actions/login';
import { signIn } from 'next-auth/react';
import { MySocialAuth } from '@/components/uicustom/auth/buttons/social';
import { FiMail, FiLock, FiArrowRight, FiShield, FiZap, FiUsers } from 'react-icons/fi';

const LOG_PREFIX = '[frontend/app/auth/login/page.tsx]';

export default function LoginPage() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const urlError = searchParams.get('error') === 'OAuthAccountNotLinked' 
    ? 'Email already in use with different provider!' 
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
    <div className="min-h-[calc(100vh-80px)] flex">
      {/* Left side - Hero/Brand */}
      <motion.div 
        initial={reduceMotion ? undefined : { opacity: 0, x: -20 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
      >
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500" />
        
        {/* Animated Blobs */}
        <motion.div
          className="absolute top-20 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { 
            x: [0, 50, 0], 
            y: [0, 30, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { 
            x: [0, -30, 0], 
            y: [0, -50, 0],
            scale: [1.1, 1, 1.1]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
              Welcome back to<br />
              <span className="bg-gradient-to-r from-white via-pink-100 to-white bg-clip-text text-transparent">
                the Vibe
              </span>
            </h1>
            <p className="text-white/80 text-lg mb-12 max-w-md">
              Connect with your community, share your pulse, and discover what&apos;s trending.
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
              { icon: FiZap, text: 'Share your pulse with the world' },
              { icon: FiUsers, text: 'Build your vibe community' },
              { icon: FiShield, text: 'Your data, your control' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-white/90">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{feature.text}</span>
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-white/60 mt-2">Sign in to continue to the vibe</p>
          </div>

          {/* Form Header */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-semibold text-white mb-2">Sign in</h2>
            <p className="text-white/60">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
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
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-950 text-white/40">or continue with email</span>
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
                        <FormLabel className="text-white/80 text-sm font-medium">
                          Two-Factor Code
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="123456"
                              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
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
                        <FormLabel className="text-white/80 text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="you@example.com"
                              type="email"
                              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-white/80 text-sm font-medium">Password</FormLabel>
                          <Link 
                            href="/auth/reset" 
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                            <Input
                              {...field}
                              disabled={isPending}
                              placeholder="••••••••"
                              type="password"
                              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400" />
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
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  {error || urlError}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
                >
                  {success}
                </motion.div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50"
              >
                {isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          <p className="lg:hidden text-center text-white/60 text-sm mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign up
            </Link>
          </p>

          {/* Terms */}
          <p className="text-center text-white/40 text-xs mt-8">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-white/60 hover:text-white/80 underline">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-white/60 hover:text-white/80 underline">Privacy Policy</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
