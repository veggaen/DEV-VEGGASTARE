import { Button } from "@/components/ui/button";
import { MyLoginButton } from "@/components/uicustom/auth/buttons/login-button";
import { LockKeyhole } from "lucide-react";
import Image from "next/image";

const LOG_PREFIX = '[page.tsx]'
export default function Home() {
  return (
    <main className="flex h-full flex-col items-center justify-center p-24 bg-[radial-gradient(elipse_at_top,var(--tw-gradient-stops))] from-sky-400 to-blue-500">
      <div className="space-y-6">
      <h1 className="text-6xl font-semibold text-white drop-shadow-md mb-2">The Future awaits!</h1>
      <MyLoginButton mode="modal" asChild ><Button size="lg" variant='vegaEmeraldBtn' className="group"><LockKeyhole size={21} className="mr-2 group-hover:animate-bounce"/>Auth</Button></MyLoginButton>
      <p>Buildt with Authentication service</p>
      <div>
      </div>
      </div>
    </main>
  );
}
