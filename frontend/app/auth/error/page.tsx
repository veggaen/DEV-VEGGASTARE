"use client";

import { MyAuthErrorCard } from "@/components/uicustom/auth/error-card";
import { useSearchParams } from "next/navigation";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    OAuthSignin: 'OAuth sign-in failed. If this happened during GitHub or Discord linking, verify callback URL settings and AUTH_URL/NEXTAUTH_URL.',
    OAuthCallbackError: 'OAuth callback failed. Check provider callback URL and client credentials in environment variables.',
    Configuration: 'Authentication is misconfigured. Verify provider IDs/secrets and AUTH_URL in your deployment environment.',
    AccessDenied: 'Access was denied by the OAuth provider.',
};

const MyAuthErrorPage = () => {
        const searchParams = useSearchParams();
        const errorCode = searchParams.get('error') || undefined;
        const description = errorCode
            ? OAUTH_ERROR_MESSAGES[errorCode] || `Authentication failed with error: ${errorCode}`
            : undefined;

    return (
                <MyAuthErrorCard description={description} />
    );
};
export default MyAuthErrorPage;