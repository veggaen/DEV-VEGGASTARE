'use client'

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BeatLoader } from 'react-spinners'
import { CardWrapper } from "../card-wrapper"
import { MyFormSucess } from '../../forms/form-sucess';
import { MyFormError } from '../../forms/form-error';
import { MyNewVerificationAction } from '@/actions/new-verification';

const LOG_PREFIX = '[[USE CLIENT] new-verification-form.tsx]'
export const MyNewVerificationForm = () => {
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();

    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const onSubmit = useCallback(() => {
      let isMounted = true; // Flag to track component's mounted status

      if (success || error) return;
      if (!token) {
        setError('Missing token!');
        return;
      }

      MyNewVerificationAction(token)
      .then((data) => {
        if (!isMounted) return; // Exit early if component has been unmounted

        if (data?.success) {
          setSuccess(data.success);
          console.log(`${LOG_PREFIX} onSubmit 1/2 (success)`, data.success);
        } else if (data?.error) {
          setError(data.error);
          console.error(`${LOG_PREFIX} onSubmit 1/2 (data.error)`, data.error);
        }
      })
      .catch(() => {
        if (!isMounted) return; // Exit early if component has been unmounted

        setError('Something went wrong!');
      })
      .finally(() => {
        console.log(`${LOG_PREFIX} onSubmit 2/2 (finally) ${success ? 'success' : 'error'}`);
      });

      return () => {
        isMounted = false; // Set flag to false when the component unmounts
      };
    }, [token, success, error]);

    useEffect(() => {
        if (token) { // Check if the token exists
            console.log(`${LOG_PREFIX} useEffect(onSubmit)`)
            onSubmit();
        } else {
            console.error('Token is missing.');
            setError('Missing is token');
        }
    }, [onSubmit, token])

  return (
    <CardWrapper
      headerLabel="Confirm your verification"
      backButtonLabel="Back to login"
      backButtonHref="/auth/login"
    >
      <div className="flex flex-col w-full justify-center items-center">
        {!success && !error && (
          <BeatLoader color="white" />
        )}
        <MyFormSucess message={success} />
        {!success && (
          <MyFormError message={error} />
        )}
      </div>
    </CardWrapper>
  )
    
}