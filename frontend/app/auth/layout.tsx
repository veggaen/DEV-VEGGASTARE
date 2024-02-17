

const LOG_PREFIX = '[fronten/app/auth/layout.tsx]'
export default function DashboardLayout({ children } : { children: React.ReactNode }) {
    
    return (
      <section className="flex justify-between gap-y-4 h-screen w-full">
        {/* Include shared UI here e.g. a header or sidebar */}
        <nav className="LeftSideNavBar m-0 p-0 grow w-fit max-w-[360px] bg-white text-black dark:bg-black dark:text-white">
        </nav>
        <div className="flex flex-col w-full">
          {children}
        </div>
        
      </section>
    )
}