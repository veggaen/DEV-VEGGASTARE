/** @fileOverview Resolve the signed-in profile on the server, without a client spinner/redirect hop. @stability stable */
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function ProfileRedirect() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login?callbackUrl=%2Fprofile');
  redirect('/profile/' + encodeURIComponent(session.user.id));
}
