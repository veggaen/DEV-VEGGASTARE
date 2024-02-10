import { ThemeProvider } from "@/components/providers/themeprovider"
import { MyMenuSide } from "@/components/uicustom/sidemenumainauth"
import { MyThemeBtn } from "@/components/uicustom/themebtn"
import MyTopBar from "@/components/uicustom/topbar"

export default function DashboardLayout({ children } : { children: React.ReactNode }) {
    return (
      <section className="flex justify-start max-w-screen p-0 m-0">
        {/* Include shared UI here e.g. a header or sidebar */}
        <nav className="LeftSideNavBar m-0 p-0 grow w-fit max-w-[360px] bg-white text-black dark:bg-black dark:text-white">
        <MyMenuSide />
        </nav>
        <div className="flex flex-col w-full">
          <MyTopBar />
          {children}
        </div>
      </section>
    )
}