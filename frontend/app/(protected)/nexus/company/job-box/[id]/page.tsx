import { redirect } from 'next/navigation';

// Redirect old job-box/[id] route to new /jobs/[id] route
export default async function JobBoxDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/jobs/${id}`);
}
