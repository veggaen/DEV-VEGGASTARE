import { MySecurityActionForm } from "@/components/uicustom/auth/forms/security-action-form";
import type { Metadata } from 'next';
export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false, follow: false } };

const MyPageSecurityAction = () => {
	return <MySecurityActionForm />;
};

export default MyPageSecurityAction;
