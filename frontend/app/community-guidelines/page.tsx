"use client";

/**
 * @fileOverview Community guidelines page — DSA compliance requirement.
 * @stability active
 * @keyInvariants Must explain prohibited content, moderation process,
 *   appeal mechanism, and consequences per DSA obligations.
 */

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

const BUSINESS_EMAIL = "kontakt@veggat.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/50 dark:bg-black/30 p-6 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function CommunityGuidelinesPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      <div className="relative mx-auto w-full max-w-4xl px-6 py-16">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="space-y-8"
        >
          {/* Header */}
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-violet-400" aria-hidden />
              <span>Retningslinjer</span>
            </div>
            <h1 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
              Retningslinjer for fellesskapet
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
              Veggat er et fellesskap bygget på tillit og respekt. Disse retningslinjene gjelder for alt
              brukergenerert innhold på plattformen — innlegg (Pulse), meldinger, produktannonser,
              bilder, avstemninger og kommentarer.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Sist oppdatert: {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </header>

          {/* 1. Forbudt innhold */}
          <Section title="1. Forbudt innhold">
            <p>Følgende innhold er ikke tillatt på Veggat:</p>
            <ul className="space-y-2 pl-4">
              {[
                { label: "Ulovlig innhold", desc: "Alt innhold som bryter norsk lov, inkludert oppfordring til straffbare handlinger." },
                { label: "Hatefulle ytringer", desc: "Trusler, trakassering eller diskriminering basert på etnisitet, kjønn, religion, seksuell orientering, funksjonsnedsettelse eller andre beskyttede egenskaper." },
                { label: "Vold og trusler", desc: "Trusler om vold, grafisk voldelig innhold, eller glorifisering av vold." },
                { label: "Seksuelt innhold", desc: "Pornografisk materiale, seksuell trakassering, eller uønsket seksuelt innhold." },
                { label: "Overgrep mot barn", desc: "Alt materiale som utnytter eller seksualiserer mindreårige rapporteres umiddelbart til Kripos/NCMEC." },
                { label: "Spam og svindel", desc: "Masseutsendelser, phishing, pyramidespill, falske produktannonser, hacking-verktøy." },
                { label: "Etterligning/identitetstyveri", desc: "Å utgi seg for å være andre brukere, bedrifter eller offentlige myndigheter." },
                { label: "Opphavsrettskrenkelser", desc: "Innhold du ikke eier eller har rett til å dele (bilder, tekst, musikk, video)." },
                { label: "Feilinformasjon", desc: "Bevisst spredning av uriktig informasjon som kan forårsake skade, særlig relatert til helse eller sikkerhet." },
                { label: "Manipulasjon av plattformen", desc: "Falske kontoer, kunstig engasjement, omgåelse av hastighetsbegrensning eller anti-svindeltiltak." },
              ].map(({ label, desc }) => (
                <li key={label} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  <span><strong className="text-foreground">{label}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 2. Rapportering */}
          <Section title="2. Slik rapporterer du innhold">
            <p>
              Dersom du ser innhold som bryter disse retningslinjene, kan du rapportere det direkte fra plattformen:
            </p>
            <ol className="space-y-2 pl-4 list-decimal list-inside">
              <li>Klikk på <strong className="text-foreground">⋯</strong> (mer-menyen) på innlegget, meldingen eller produktet.</li>
              <li>Velg <strong className="text-foreground">«Rapporter»</strong>.</li>
              <li>Velg årsak fra listen og legg eventuelt til en beskrivelse.</li>
              <li>Rapporten sendes til vårt moderatørteam for gjennomgang.</li>
            </ol>
            <p className="mt-2">
              Du kan også sende rapporter direkte til{" "}
              <a href={`mailto:${BUSINESS_EMAIL}`} className="text-violet-500 hover:underline">{BUSINESS_EMAIL}</a>{" "}
              med detaljer om det aktuelle innholdet.
            </p>
          </Section>

          {/* 3. Gjennomgangsprosess */}
          <Section title="3. Gjennomgangsprosess">
            <p>Når vi mottar en rapport, følger vi denne prosessen:</p>
            <div className="space-y-3 mt-2">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">1</div>
                <div><strong className="text-foreground">Mottak:</strong> Rapporten registreres og du får en bekreftelse.</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">2</div>
                <div><strong className="text-foreground">Vurdering:</strong> En moderatør gjennomgår innholdet mot disse retningslinjene og norsk lov.</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">3</div>
                <div><strong className="text-foreground">Tiltak:</strong> Innholdet kan bli fjernet, brukeren varslet, eller rapporten avvist med begrunnelse.</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">4</div>
                <div><strong className="text-foreground">Varsel:</strong> Både rapportør og innholdseier mottar en begrunnelse for avgjørelsen (jf. DSA Art. 17).</div>
              </div>
            </div>
            <p className="mt-3">
              Vi tilstreber å behandle rapporter innen <strong className="text-foreground">48 timer</strong>.
              Rapporter om ulovlig innhold prioriteres.
            </p>
          </Section>

          {/* 4. Ankerett */}
          <Section title="4. Anke av modereringsbeslutninger">
            <p>
              Dersom ditt innhold er fjernet eller kontoen din er begrenset, har du rett til å anke avgjørelsen
              i henhold til DSA Art. 20:
            </p>
            <ul className="space-y-1.5 pl-4">
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" /><span>Du mottar en e-post med begrunnelsen for avgjørelsen.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" /><span>Du kan sende en anke innen <strong className="text-foreground">6 måneder</strong> etter avgjørelsen.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" /><span>Anken vurderes av en person som ikke var involvert i den opprinnelige avgjørelsen.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" /><span>Du mottar svar på anken innen 14 dager.</span></li>
            </ul>
            <p className="mt-2">
              Send anker til{" "}
              <a href={`mailto:${BUSINESS_EMAIL}`} className="text-violet-500 hover:underline">{BUSINESS_EMAIL}</a>{" "}
              med referansenummeret fra varselet du mottok.
            </p>
          </Section>

          {/* 5. Konsekvenser */}
          <Section title="5. Konsekvenser ved brudd">
            <p>Avhengig av alvorlighetsgrad og hyppighet av brudd, kan følgende tiltak iverksettes:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/80">
                    <th className="pb-2 pr-4 font-semibold">Nivå</th>
                    <th className="pb-2 pr-4 font-semibold">Tiltak</th>
                    <th className="pb-2 font-semibold">Detaljer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4 text-amber-400 font-medium">Advarsel</td><td className="py-2 pr-4">Varsel sendt</td><td className="py-2">Første brudd på mildere regler. Innholdet kan bli fjernet.</td></tr>
                  <tr><td className="py-2 pr-4 text-orange-400 font-medium">Midlertidig blokkering</td><td className="py-2 pr-4">7–30 dagers suspensjon</td><td className="py-2">Gjentatte brudd eller alvorlige enkelthendelser.</td></tr>
                  <tr><td className="py-2 pr-4 text-red-400 font-medium">Permanent utestengelse</td><td className="py-2 pr-4">Konto deaktivert</td><td className="py-2">Grove brudd, ulovlig innhold, gjentatt trakassering.</td></tr>
                  <tr><td className="py-2 pr-4 text-red-500 font-medium">Politianmeldelse</td><td className="py-2 pr-4">Rapport til myndigheter</td><td className="py-2">Overgrep mot barn, trusler om vold, terrorinnhold.</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* 6. Opphavsrett */}
          <Section title="6. Opphavsrett og innhold">
            <p>
              Når du laster opp innhold til Veggat, beholder du alle eiendomsrettigheter. Du gir oss en
              ikke-eksklusiv, verdensomspennende, gebyrfri lisens til å vise, distribuere og lagre innholdet
              ditt på plattformen. Denne lisensen opphører når du sletter innholdet.
            </p>
            <p>
              Du garanterer at du eier eller har nødvendige rettigheter til alt innhold du laster opp.
              Dersom du oppdager krenkelse av opphavsrett, send en varsling til{" "}
              <a href={`mailto:${BUSINESS_EMAIL}`} className="text-violet-500 hover:underline">{BUSINESS_EMAIL}</a>{" "}
              med informasjon om det aktuelle verket og den antatte krenkelsen.
            </p>
          </Section>

          {/* 7. Kontakt */}
          <Section title="7. Kontakt og tilsyn">
            <p>
              Spørsmål om disse retningslinjene kan rettes til:
            </p>
            <div className="rounded-lg bg-muted/30 p-4 text-xs space-y-1 mt-2">
              <p className="font-semibold text-foreground">THORSEN SOFTWARE</p>
              <p>
                E-post:{" "}
                <a href={`mailto:${BUSINESS_EMAIL}`} className="text-violet-500 hover:underline">{BUSINESS_EMAIL}</a>
              </p>
            </div>
            <p className="mt-3">
              Nasjonal tilsynsmyndighet for digitale tjenester (DSA) i Norge er{" "}
              <a href="https://nkom.no" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">
                Nasjonal kommunikasjonsmyndighet (Nkom)
              </a>.
            </p>
          </Section>

          {/* Navigation */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              ← Personvernerklæring
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Salgsvilkår →
            </Link>
            <Link href="/accessibility" className="text-muted-foreground hover:text-foreground transition-colors">
              Tilgjengelighetserklæring →
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
