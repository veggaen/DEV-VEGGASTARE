import { connection } from 'next/server';
import { Atmosphere } from '@/components/uicustom/chrome/atmosphere';

export default async function AuthLayout({ children } : { children: React.ReactNode }) {
    // Auth needs request-specific callback/token search params. Render their
    // initial UI on the server instead of bailing out to the root JS skeleton.
    await connection();

    return (
      <section className="relative w-full min-w-0">
        {/* Same star field as the landing page, at a whisper — the shared shell
            (header + rail) already frames the page; the form stays the focus. */}
        <Atmosphere variant="quiet" />
        <div className="relative z-10">{children}</div>
      </section>
    )
}
