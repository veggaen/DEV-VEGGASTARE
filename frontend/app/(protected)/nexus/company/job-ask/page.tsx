import { redirect } from 'next/navigation';

// Redirect old job-ask route to new /jobs/post route
export default function JobAskRedirect() {
  redirect('/jobs/post');
}
