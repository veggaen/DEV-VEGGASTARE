'use client';

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function MyHeroImage() {
    const { resolvedTheme } = useTheme();
    const [imageSrc, setImageSrc] = useState("");

    useEffect(() => {
        let src;
        switch (resolvedTheme) {
            case 'light':
                src = '/source/bg_main_light_03.webp';
                break;
            case 'dark':
                src = '/source/bg_main_dark_04.webp';
                break;
            default:
                src = 'https://images.unsplash.com/photo-1609480222756-28f49d1beeda?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
                break;
        }
        setImageSrc(src);
    }, [resolvedTheme]);

    if (!imageSrc) {
        return <div>Loading...</div>;
    }

    return (
        <div className="absolute inset-0 w-full h-full z-0">
            <Image
                className='object-cover w-full h-full'
                src={imageSrc}
                alt={`Homehero`}
                layout="fill"
                priority
            />
        </div>
    );
}