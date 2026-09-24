/** @fileOverview Server-rendered sales terms with a retainable copy and optional withdrawal form. @stability stable */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_INFO, SALES_TERMS_SECTIONS, SALES_TERMS_LINKS, WITHDRAWAL_FORM } from '@/lib/legal/sales-terms';
import { SALES_TERMS_DATE, SALES_TERMS_VERSION, SALES_TERMS_DOWNLOAD } from '@/lib/legal/sales-terms-version';

export const metadata: Metadata = { title: 'Salgsvilkår', description: 'Salgsvilkår, angrerett og kontaktinformasjon for kjøp på Veggat.', alternates: { canonical: '/terms' } };
const linkStyle = 'rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';
const inlineLinks = [{ label: BUSINESS_INFO.email, href: `mailto:${BUSINESS_INFO.email}` },
  ...SALES_TERMS_LINKS.map(link => ({ ...link, label: link.label === 'Retningslinjer for fellesskapet' ? 'retningslinjer for fellesskapet' : link.label }))];

function LinkedText({ text }: { text: string }) {
  const match = inlineLinks.map(link => ({ ...link, index: text.indexOf(link.label) }))
    .filter(link => link.index >= 0).sort((a, b) => a.index - b.index)[0];
  if (!match) return text;
  return <>{text.slice(0, match.index)}<a href={match.href} className={linkStyle}>{match.label}</a>
    <LinkedText text={text.slice(match.index + match.label.length)} /></>;
}

export default function TermsPage() {
  return <article lang="nb" aria-labelledby="terms-heading" className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <header className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Juridisk</p>
      <h1 id="terms-heading" className="mt-3 text-balance text-3xl font-semibold sm:text-4xl">Salgsvilkår</h1>
      <p className="mt-3 text-sm text-muted-foreground">Oppdatert {SALES_TERMS_DATE} · Versjon {SALES_TERMS_VERSION}</p>
      <p className="mt-4 max-w-prose leading-relaxed text-muted-foreground">Les vilkårene før du bestiller. Du kan lagre en tekstkopi med alle vilkårene og et valgfritt angreskjema. Nedlasting sender ingen melding og utsteder ingen tilbakebetaling.</p>
      <a href={SALES_TERMS_DOWNLOAD} download className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Last ned vilkår og angreskjema (.txt)</a>
    </header>
    <div className="mt-10 grid min-w-0 gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
      <nav aria-label="Innhold i salgsvilkårene" className="min-w-0 self-start rounded-xl border border-border bg-card p-4">
        <h2 className="px-2 text-sm font-semibold">Innhold</h2>
        <ol className="mt-2 grid sm:grid-cols-2 lg:grid-cols-1">{SALES_TERMS_SECTIONS.map(section => <li key={section.id}>
          <a href={`#${section.id}`} className="flex min-h-11 items-center rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2">{section.title}</a>
        </li>)}<li><a href="#withdrawal-form" className="flex min-h-11 items-center rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2">Angreskjema og kontakt</a></li></ol>
      </nav>
      <div className="min-w-0 max-w-prose space-y-10 [overflow-wrap:anywhere]">
        {SALES_TERMS_SECTIONS.map(section => <section key={section.id} aria-labelledby={section.id}>
          <h2 id={section.id} className="scroll-mt-28 border-b border-border pb-3 text-balance text-xl font-semibold">{section.title}</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">{section.blocks.map((block, index) => block.kind === 'bullet'
            ? <ul key={index} className="list-disc pl-5 marker:text-primary"><li><LinkedText text={block.text} /></li></ul>
            : <p key={index}><LinkedText text={block.text} /></p>)}</div>
        </section>)}
        <section aria-labelledby="withdrawal-form" className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 id="withdrawal-form" className="scroll-mt-28 text-xl font-semibold">Angreskjema og kontakt</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">Skjemaet er valgfritt. Du kan sende en annen tydelig melding om at du vil gå fra avtalen. For en bestilling du har gjort, finner du også handlingen «Withdraw from this purchase» på kvitteringen i <Link href="/my-orders" className={linkStyle}>Mine ordre</Link>.</p>
          <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Vis angreskjema</summary>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{WITHDRAWAL_FORM}</p>
          </details>
          <a href={SALES_TERMS_DOWNLOAD} download className={`mt-2 inline-flex min-h-11 items-center text-sm ${linkStyle}`}>Lagre vilkår og angreskjema (.txt)</a>
          <address className="mt-5 space-y-1 border-t border-border pt-4 text-sm not-italic leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">{BUSINESS_INFO.name} · org.nr. {BUSINESS_INFO.orgNumber}</p>
            <p>{BUSINESS_INFO.address}, {BUSINESS_INFO.country}</p>
            <a href={`mailto:${BUSINESS_INFO.email}`} className={`inline-flex min-h-11 items-center ${linkStyle}`}>{BUSINESS_INFO.email}</a>
            <p>Telefon: {BUSINESS_INFO.phone}</p>
          </address>
        </section>
        <nav aria-label="Andre juridiske sider" className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
          {[['/privacy', 'Personvern og cookies'], ['/community-guidelines', 'Retningslinjer for fellesskapet'], ['/accessibility', 'Tilgjengelighetserklæring'], ['/info', 'Om oss']].map(([href, label]) => <Link key={href} href={href} className={`inline-flex min-h-11 items-center ${linkStyle}`}>{label}</Link>)}
        </nav>
      </div>
    </div>
  </article>;
}
