/**
 * @fileOverview Dashboard uses the persistent app navigation, not a second floating dock.
 * @stability stable
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-full min-w-0 w-full">{children}</section>
  );
}
