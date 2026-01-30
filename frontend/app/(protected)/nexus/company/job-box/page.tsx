import { redirect } from 'next/navigation';

// Redirect old job-box route to new /jobs route
export default function JobBoxRedirect() {
  redirect('/jobs');
}
