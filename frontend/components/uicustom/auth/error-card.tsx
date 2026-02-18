import { CardWrapper } from "@/components/uicustom/auth/card-wrapper"
import { ExclamationTriangleIcon } from "@radix-ui/react-icons"

export const MyAuthErrorCard = ({ description }: { description?: string }) => {
    return (
        <CardWrapper
          headerLabel="Oops! Something went wrong"
          backButtonHref="/auth/login"
          backButtonLabel="Back to login"
        >
          <div className="space-y-3">
            <ExclamationTriangleIcon className="h-10 w-full text-red-500" />
            {description && (
              <p className="text-center text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </CardWrapper>
    )
}