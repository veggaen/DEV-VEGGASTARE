/** @fileOverview Server-gated development preview. @stability experimental */
import { notFound } from 'next/navigation';
import ChatPreviewClient from './ChatPreviewClient';

export default function ChatPreviewPage() {
  // Reject before rendering the client boundary; throwing from the client
  // preview during SSR caused a recoverable Suspense error in production.
  if (process.env.NODE_ENV === 'production') notFound();
  return <ChatPreviewClient />;
}
