

const LOG_PREFIX = '[fronten/app/auth/layout.tsx]'
export default function DashboardLayout({ children } : { children: React.ReactNode }) {
    
    return (
      <section className="flex flex-1 w-full overflow-auto">
        {children}
      </section>
    )
}