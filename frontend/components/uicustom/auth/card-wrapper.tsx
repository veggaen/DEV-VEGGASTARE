'use client'

import {
    Card,
    CardContent,
    CardFooter,
    CardHeader
} from '@/components/ui/card'
import { MyAuthHeader } from './header';
import { MySocialAuth } from './buttons/social';
import { MyAuthBackButton } from './buttons/back-button';

interface CardWrapperProps {
    children: React.ReactNode;
    headerLabel: string;
    backButtonLabel: string;
    backButtonHref: string;
    showSocial?: boolean;
};

const LOG_PREFIX = '[frontend/components/uicustom/auth/card-wrapper.tsx]'
export const CardWrapper = ({
    children,
    headerLabel,
    backButtonLabel,
    backButtonHref,
    showSocial
}: CardWrapperProps) => {
    return (
        <Card className='w-[400px] shadow-md'>
          <CardHeader>
            <MyAuthHeader label={headerLabel} />
          </CardHeader>
          <CardContent>
            {children}
          </CardContent>
          {showSocial && (
            <CardFooter>
              <MySocialAuth />
            </CardFooter>
          )}
          <CardFooter>
            <MyAuthBackButton label={backButtonLabel} href={backButtonHref}/>
          </CardFooter>
        </Card>
    )
}