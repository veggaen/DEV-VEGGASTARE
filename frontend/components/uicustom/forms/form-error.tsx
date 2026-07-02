import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

interface FormErrorProps {
    message?: string;
};

export const MyFormError = ({ message }: FormErrorProps) => {
    if (!message) return null;
    return (
    <div
      role="alert"
      aria-live="polite"
      className="message-bubble-enter flex items-start gap-x-2.5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-red-600 dark:text-red-400"
    >
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
    )
}
