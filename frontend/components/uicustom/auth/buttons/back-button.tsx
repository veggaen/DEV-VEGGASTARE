import { Button } from "@/components/ui/button"
import Link from "next/link";

interface BackButtonProps {
    href?: string;
    label: string;
}
export const MyAuthBackButton = ({href,label}: BackButtonProps) => {
    return (
        <Button variant='link' className="min-h-11 font-normal w-full" asChild>
            <Link href={href as string}>{label}</Link>
        </Button>
    )
}
