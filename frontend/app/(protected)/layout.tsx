import { MyNavbarProtected } from "./_components/navbar";

interface ProtectedLayoutProps {
    children: React.ReactNode
}

const MyProtectedLayout = ({children}: ProtectedLayoutProps) => {
  return (
    <div className="h-full w-full flex flex-col gap-y-10 justify-start items-center">
        <MyNavbarProtected />
        {children}
      </div>
  )
}
export default MyProtectedLayout; // protected router component