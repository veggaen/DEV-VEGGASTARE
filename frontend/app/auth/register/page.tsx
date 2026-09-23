/** @fileOverview Server-rendered signup entry aligned with the marketplace story. @stability stable */
import Link from "next/link";
import { AuthPageShell } from "@/components/uicustom/auth/auth-page-shell";
import { MyRegisterform } from "@/components/uicustom/auth/forms/register-form";

export default function RegisterPage() {
  return <AuthPageShell title="Create your account" description={<>Already have an account? <Link href="/auth/login" className="font-medium text-foreground underline underline-offset-4">Sign in</Link></>}>
    <MyRegisterform />
  </AuthPageShell>;
}
