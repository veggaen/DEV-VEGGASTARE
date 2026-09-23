'use client'

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CardWrapper } from "../card-wrapper";
import { MyFormSuccess } from "../../forms/form-sucess";
import { MyFormError } from "../../forms/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MyConfirmSecurityAction } from "@/actions/security-action";


export const MySecurityActionForm = () => {
	const [error, setError] = useState<string | undefined>();
	const [success, setSuccess] = useState<string | undefined>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showTwoFactor, setShowTwoFactor] = useState(false);
	const [code, setCode] = useState("");

	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const confirm = useCallback(
		(providedCode?: string) => {
			let isMounted = true;
			if (success) return;
			if (!token) {
				setError("Missing token!");
				return;
			}

			setIsSubmitting(true);
			setError(undefined);

			MyConfirmSecurityAction(token, providedCode)
				.then((data) => {
					if (!isMounted) return;
					if (data?.twoFactor) {
						setShowTwoFactor(true);
						return;
					}
					if (data?.success) {
						setSuccess(data.success);
						toast.success(data.success, { position: "top-center" });
						return;
					}
					if (data?.error) {
						setError(data.error);
					}
				})
				.catch(() => {
					if (!isMounted) return;
					setError("Something went wrong!");
				})
				.finally(() => {
					if (!isMounted) return;
					setIsSubmitting(false);
				});

			return () => {
				isMounted = false;
			};
		},
		[token, success]
	);

	useEffect(() => {
		// Attempt to confirm automatically first (email-only users).
		const timeoutId = window.setTimeout(() => {
			confirm();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [confirm]);

	return (
		<CardWrapper
			headerLabel="Confirm security action"
			backButtonLabel="Back to home"
			backButtonHref="/"
		>
			<div className="flex flex-col w-full justify-center items-center gap-3">
				<MyFormSuccess message={success} />
				{!success ? <MyFormError message={error} /> : null}

				{!success && showTwoFactor ? (
					<div className="w-full space-y-3">
						<div className="text-sm text-zinc-600 dark:text-zinc-300">
							Two-factor is enabled. Enter the code we emailed you.
						</div>
						<label htmlFor="security-code" className="block text-sm font-medium">Two-factor code</label>
						<Input
							id="security-code"
							autoComplete="one-time-code"
							className="h-12 text-base"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							disabled={isSubmitting}
							placeholder="123456"
							inputMode="numeric"
						/>
						<Button
							disabled={isSubmitting || !code}
							className="min-h-12 w-full"
							onClick={() => confirm(code)}
						>
							Confirm
						</Button>
					</div>
				) : null}
			</div>
		</CardWrapper>
	);
};
