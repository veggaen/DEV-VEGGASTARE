'use client'

/**
 * Auth shell — every CardWrapper-based auth page (reset, new-password,
 * verification, security-action, 2FA) inherits this premium treatment:
 *  • full-height centered stage with a soft brand-accent glow backdrop
 *  • frosted, elevated card (token surfaces — correct in both themes)
 *  • gentle slide-up entrance (CSS keyframe, reduced-motion safe)
 */
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
        <div className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden px-4 py-12">
          {/* Ambient brand glow — anchors the card, fades into the page bg */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(closest-side, hsl(var(--brand-accent) / 0.35), transparent)' }}
          />

          <Card className="auth-card-enter relative w-full max-w-md rounded-2xl border-border/70 bg-card/85 shadow-e3 backdrop-blur-xl">
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
        </div>
    )
}
