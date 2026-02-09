/**
 * Pulse Layout — Parallel Routes
 *
 * Uses Next.js parallel routes to render the feed ({children}) and a
 * pulse detail modal ({modal}) simultaneously.
 *
 * In-app navigation:  /pulse → click pulse → /pulse/[id]
 *   → children keeps feed (soft nav) + @modal slot shows intercepted modal overlay
 *
 * Direct / shared link:  /pulse/[id] (hard nav)
 *   → children renders [id]/page.tsx (full standalone page) + @modal = null
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes
 */
export default function PulseLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
