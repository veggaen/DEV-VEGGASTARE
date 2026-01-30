import { MyNavbarProtected } from "./_components/navbar";

interface ProtectedLayoutProps {
    children: React.ReactNode
}

const MyProtectedLayout = ({children}: ProtectedLayoutProps) => {
  return (
    <div className="flex flex-1 flex-col w-full min-h-0">
        {children}
      </div>
  )
}
export default MyProtectedLayout; // protected router component