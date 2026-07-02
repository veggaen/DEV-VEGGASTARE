import { Poppins } from 'next/font/google'

import { cn } from '@/lib/utils';

const font = Poppins({
    subsets: ['latin'],
    weight: ['600']
})

interface HeaderProps {
    label: string;
}
const LOG_PREFIX = '[frontend/components/uicustom/auth/header.tsx]'
/**
 * The page's headerLabel IS the title now (the old version rendered a literal
 * "Auth" heading with the label demoted to a caption — meaningless to users).
 */
export const MyAuthHeader = ({ label }: HeaderProps) => {
    return (
        <div className='flex w-full flex-col items-center justify-center gap-y-3'>
            {/* Brand accent tick — small, confident, theme-aware */}
            <span aria-hidden className='h-1 w-10 rounded-full bg-brand-accent/80' />
            <h1 className={cn('text-center text-2xl font-semibold tracking-tight text-foreground', font.className)}>
                {label}
            </h1>
        </div>
    )
};
