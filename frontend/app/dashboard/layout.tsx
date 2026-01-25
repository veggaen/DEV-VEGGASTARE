import { MyMenuSide } from "@/components/uicustom/sidemenumainauth"

export default function DashboardLayout({ children } : { children: React.ReactNode }) {
    return (
      <section className="flex w-full min-h-[calc(100dvh-var(--app-header))] justify-start p-0 m-0">
        {/* Include shared UI here e.g. a header or sidebar */}
        <nav className="LeftSideNavBar m-0 p-0 shrink-0">
        <MyMenuSide />
        </nav>
        <div className="flex flex-col w-full">
          {children}
        </div>
      </section>
    )
}