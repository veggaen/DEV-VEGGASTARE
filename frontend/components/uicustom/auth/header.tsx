interface HeaderProps {
    label: string;
}
/**
 * The page's headerLabel IS the title now (the old version rendered a literal
 * "Auth" heading with the label demoted to a caption — meaningless to users).
 */
export const MyAuthHeader = ({ label }: HeaderProps) => {
    return (
        <div className='flex w-full flex-col items-center justify-center gap-y-3'>
            {/* Brand accent tick — small, confident, theme-aware */}
            <span aria-hidden className='h-1 w-10 rounded-full bg-brand-accent/80' />
            <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
                {label}
            </h1>
        </div>
    )
};
