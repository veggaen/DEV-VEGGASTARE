import { CardWrapper } from "@/components/uicustom/auth/card-wrapper"
import { ExclamationTriangleIcon } from "@radix-ui/react-icons"

export const MyAuthErrorCard = () => {
    return (
        <CardWrapper
          headerLabel="Oops! Something went wrong"
          backButtonHref="/auth/login"
          backButtonLabel="Back to login"
        >
          <div>
            <ExclamationTriangleIcon className="h-10 w-full text-red-500" />
          </div>
        </CardWrapper>
    )
}