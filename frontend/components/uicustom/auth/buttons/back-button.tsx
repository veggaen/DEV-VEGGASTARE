import { Button } from "@/components/ui/button"
import Link from "next/link";

interface BackButtonProps {
    href?: string;
    label: string;
}
const LOG_PREFIX = '[frontend/components/uicustom/auth/back-button.tsx]'
export const MyAuthBackButton = ({href,label}: BackButtonProps) => {
    return (
        <Button variant='link' className="font-normal w-full" size='sm' asChild>
            <Link href={href as string}>{label}</Link>
        </Button>
    )
}