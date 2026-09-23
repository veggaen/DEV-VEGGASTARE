

import { connection } from 'next/server';

export default async function AuthLayout({ children } : { children: React.ReactNode }) {
    // Auth needs request-specific callback/token search params. Render their
    // initial UI on the server instead of bailing out to the root JS skeleton.
    await connection();
    
    return (
      <section className="w-full min-w-0">
        {children}
      </section>
    )
}
