import { redirect } from 'next/navigation';
import { MyLibUserAuth } from '@/lib/user-auth';
import { MediaStudio } from './studio-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI Studio', robots: { index: false, follow: false } };
export default async function StudioPage() {
  const user = await MyLibUserAuth();
  if (!user?.id) redirect('/auth/login?callbackUrl=%2Fai%2Fstudio');
  return <MediaStudio />;
}
