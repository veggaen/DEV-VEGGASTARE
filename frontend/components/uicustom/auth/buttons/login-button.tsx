'use client'

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { MyLoginForm2 } from "../forms/login-form2";

interface LoginButtonProps {
    children: React.ReactNode;
    mode?: 'modal' | 'redirect';
    asChild?: boolean;
    classNamedProps?: string
}

const LOG_PREFIX = '[frontend/components/uicustom/auth/buttons/login-button.tsx]'
export const MyLoginButton = ({
    children,
    mode =  'modal' || 'redirect',
    asChild,
    classNamedProps
  }: LoginButtonProps) => {
    const navigationRouter = useRouter()
    const onClick = () => {
        console.log(`${LOG_PREFIX} LoginButton(CLICKED)`);
            navigationRouter.push('/auth/login');
    };

    if (mode === 'modal') {
        return (
            <Dialog>
                <DialogTrigger  asChild={asChild}>
                    {children}
                </DialogTrigger>
                <DialogContent className='p-0 w-auto bg-transparent border-none'>
                    <MyLoginForm2 />
                </DialogContent>
            </Dialog>
        );
    };

    return (
        <div onClick={onClick} className={`${classNamedProps}`}>
            {children}
        </div>
    );
};