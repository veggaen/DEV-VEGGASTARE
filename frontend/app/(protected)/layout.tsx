import { MyNavbarProtected } from "./_components/navbar";

interface ProtectedLayoutProps {
    children: React.ReactNode
}

const MyProtectedLayout = ({children}: ProtectedLayoutProps) => {
  return (
    <div className="min-h-full h-fit w-full flex flex-col justify-start items-center">
        
        {children}
      </div>
  )
}
export default MyProtectedLayout; // protected router component