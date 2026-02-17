'use client'

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useRef } from 'react';
import { toast } from "sonner";
import { CardWrapper } from "../card-wrapper"
import { MyFormSuccess } from '../../forms/form-sucess';
import { MyFormError } from '../../forms/form-error';
import { MyNewVerificationAction } from '@/actions/new-verification';
import { emailLoginTokenAction } from '@/actions/email-login-token';

const LOG_PREFIX = '[[USE CLIENT] new-verification-form.tsx]'
const VERIFICATION_STORAGE_KEY = 'veggat_email_verified';

export const MyNewVerificationForm = () => {
    const router = useRouter();
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();
    const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
    const [canCloseTab, setCanCloseTab] = useState(false);
    const hasRun = useRef(false); // Prevent double execution in StrictMode

    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const onSubmit = useCallback(async () => {
      if (hasRun.current) return;
      if (success || error) return;
      if (!token) {
        setError('Missing token!');
        return;
      }

      hasRun.current = true;

      try {
        const data = await MyNewVerificationAction(token);

        if ('success' in data) {
          setSuccess(data.success);
          console.log(`${LOG_PREFIX} verification success`, data.success);
          
          // Auto-login if we received a login token
          if ('loginToken' in data && 'email' in data && data.loginToken && data.email) {
            setIsAutoLoggingIn(true);
            toast.success('Email verified! Logging you in...', { position: 'top-center' });
            
            try {
              const loginResult = await emailLoginTokenAction(data.email, data.loginToken);
              
              if (loginResult.success && loginResult.redirectUrl) {
                console.log(`${LOG_PREFIX} Auto-login successful, broadcasting to other tabs...`);
                
                // Broadcast to other tabs that verification is complete
                localStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify({
                  verified: true,
                  email: data.email,
                  timestamp: Date.now(),
                  redirectUrl: loginResult.redirectUrl
                }));
                
                // Try multiple methods to close this tab
                const tryCloseWindow = () => {
                  // Method 1: Standard close
                  window.close();
                  
                  // Method 2: Self-close trick
                  window.open('', '_self');
                  window.close();
                };
                
                // Try to close immediately
                setTimeout(() => {
                  tryCloseWindow();
                  
                  // If still open after 500ms, show the close message
                  setTimeout(() => {
                    setCanCloseTab(true);
                    setIsAutoLoggingIn(false);
                    
                    // Auto-redirect after 3 seconds if they don't close manually
                    setTimeout(() => {
                      router.push(loginResult.redirectUrl);
                    }, 3000);
                  }, 500);
                }, 300);
              } else if (loginResult.error) {
                console.error(`${LOG_PREFIX} Auto-login failed:`, loginResult.error);
                toast.error('Auto-login failed. Please login manually.', { position: 'top-center' });
                setIsAutoLoggingIn(false);
                
                // Still broadcast verification success even if auto-login failed
                localStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify({
                  verified: true,
                  email: data.email,
                  timestamp: Date.now(),
                  autoLoginFailed: true
                }));
              }
            } catch (err) {
              console.error(`${LOG_PREFIX} Auto-login error:`, err);
              toast.error('Auto-login failed. Please login manually.', { position: 'top-center' });
              setIsAutoLoggingIn(false);
            }
          }
        } else if ('error' in data) {
          setError(data.error);
          console.error(`${LOG_PREFIX} verification error`, data.error);
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} verification threw:`, err);
        setError('Something went wrong!');
      }
    }, [token, success, error, router]);

    useEffect(() => {
      const timeoutId = window.setTimeout(() => {
        if (token) {
            console.log(`${LOG_PREFIX} useEffect triggering verification`)
            onSubmit();
        } else {
            console.error('Token is missing.');
            setError('Missing token');
        }
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }, [onSubmit, token])

  // If verification succeeded and we're showing the close message
  if (canCloseTab) {
    return (
      <CardWrapper
        headerLabel="✅ Email Verified!"
        backButtonLabel=""
        backButtonHref="/auth/login"
      >
        <div className="flex flex-col w-full justify-center items-center gap-4">
          <div className="text-center space-y-2">
            <p className="text-emerald-600 dark:text-emerald-400 font-medium">You&apos;re all set!</p>
            <p className="text-sm text-muted-foreground">
              You can close this tab and return to your original browser window.
            </p>
            <p className="text-xs text-muted-foreground opacity-70">
              (Redirecting automatically in a few seconds...)
            </p>
          </div>
          <button 
            onClick={() => window.close()}
            className="text-sm text-primary hover:underline"
          >
            Close this tab
          </button>
        </div>
      </CardWrapper>
    )
  }

  return (
    <CardWrapper
      headerLabel={isAutoLoggingIn ? "Logging you in..." : "Confirm your verification"}
      backButtonLabel={isAutoLoggingIn ? "" : "Back to login"}
      backButtonHref="/auth/login"
    >
      <div className="flex flex-col w-full justify-center items-center">
        {isAutoLoggingIn && (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Signing you in automatically...</p>
          </div>
        )}
        {!isAutoLoggingIn && !success && !error && (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Verifying your email...</p>
          </div>
        )}
        {!isAutoLoggingIn && success && <MyFormSuccess message={success} />}
        {!isAutoLoggingIn && !success && error && <MyFormError message={error} />}
      </div>
    </CardWrapper>
  )
    
}