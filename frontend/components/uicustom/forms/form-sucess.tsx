import { CheckCircledIcon } from "@radix-ui/react-icons";

interface FormSuccessProps {
    message?: string;
};

export const MyFormSuccess = ({ message }: FormSuccessProps) => {
    if (!message) return null;
    return (
    <div
      role="status"
      aria-live="polite"
      className="message-bubble-enter flex items-start gap-x-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
    >
      <CheckCircledIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
    )
}
