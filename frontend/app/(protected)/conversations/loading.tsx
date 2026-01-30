import Spinner from '@/components/uicustom/spinner';

export default function ConversationsLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
