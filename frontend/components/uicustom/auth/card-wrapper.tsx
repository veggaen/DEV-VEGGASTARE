'use client';
/** @fileOverview Readable, centered recovery cards using the same auth navigation. @stability stable */
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MyAuthHeader } from './header';
import { MySocialAuth } from './buttons/social';
import { MyAuthBackButton } from './buttons/back-button';

interface CardWrapperProps {
  children: React.ReactNode;
  headerLabel: string;
  backButtonLabel: string;
  backButtonHref: string;
  showSocial?: boolean;
}

export const CardWrapper = ({ children, headerLabel, backButtonLabel, backButtonHref, showSocial }: CardWrapperProps) => (
  <div className="w-full min-w-0">
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-12 lg:px-8">
      <Card data-auth-card className="auth-card-enter mx-auto w-full min-w-0 max-w-md rounded-2xl border-border/70 bg-surface-1/85 shadow-e2 backdrop-blur-xl">
        <CardHeader><MyAuthHeader label={headerLabel} /></CardHeader>
        <CardContent>{children}</CardContent>
        {showSocial && <CardFooter className="block"><MySocialAuth /></CardFooter>}
        <CardFooter><MyAuthBackButton label={backButtonLabel} href={backButtonHref} /></CardFooter>
      </Card>
    </div>
  </div>
);
