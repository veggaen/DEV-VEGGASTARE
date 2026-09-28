/**
 * @fileOverview  Auth error card — the calm version of "something went wrong".
 *                One clear headline, the public-safe reason, and two ways out:
 *                back to sign-in (primary) or the free demo (secondary), so a
 *                failed provider never dead-ends a visitor.
 * @stability     stable
 */
import Link from "next/link";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { CardWrapper } from "@/components/uicustom/auth/card-wrapper";
import { Button } from "@/components/ui/button";

export const MyAuthErrorCard = ({ description }: { description?: string }) => {
  return (
    <CardWrapper
      headerLabel="That sign-in didn't go through"
      backButtonHref="/auth/login"
      backButtonLabel="Back to sign in"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20"
        >
          <ExclamationTriangleIcon className="size-7" />
        </span>
        <p role="alert" className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description ?? "Something interrupted the sign-in. Nothing was changed on your account."}
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="vegaEmeraldBtn" className="min-h-11 rounded-full px-5">
            <Link href="/auth/login">Try another method</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-full px-5">
            <Link href="/">Explore the free demo</Link>
          </Button>
        </div>
      </div>
    </CardWrapper>
  );
};
