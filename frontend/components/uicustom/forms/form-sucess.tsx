import { CheckCircledIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";

interface FormSuccessProps {
    message?: string;
};

export const MyFormSuccess = ({ message }: FormSuccessProps) => {
    if (!message) return null;
    return (
    <div className="bg-emerald-500/15 text-emerald-500 flex items-center gap-x-2 text-sm p-3 text-destructive rounded-md">
      <CheckCircledIcon className="h-4 w-4" />
      <p>{message}</p>
    </div>
    )
}