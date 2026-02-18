"use client";

/**
 * @fileOverview WCAG accessibility statement page — Norwegian UU requirement.
 * @stability active
 * @keyInvariants Must declare conformance level, known gaps, and contact info
 *   per UU-tilsynet (Digdir) requirements.
 */

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

const BUSINESS = {
  name: "THORSEN SOFTWARE",
  orgNumber: "937 051 107",
  email: "kontakt@veggat.com",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/50 dark:bg-black/30 p-6 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function AccessibilityPage() {
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
              <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden />
              <span>Tilgjengelighet</span>
            </div>
            <h1 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
              Tilgjengelighetserklæring
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
              {BUSINESS.name} (org.nr. {BUSINESS.orgNumber}) arbeider for at veggat.com skal være tilgjengelig
              for alle brukere, i tråd med kravene i Likestillings- og diskrimineringsloven og
              WCAG 2.1 (Web Content Accessibility Guidelines).
            </p>
            <p className="text-xs text-muted-foreground/70">
              Sist oppdatert: {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </header>

          {/* 1. Samsvarsgrad */}
          <Section title="1. Samsvarsgrad">
            <p>
              Veggat.com er <strong className="text-amber-400">delvis i samsvar</strong> med WCAG 2.1 nivå AA.
              Vi bruker semantisk HTML, Radix UI-primitiver (som er tastatur-tilgjengelige som standard),
              og responsivt design. Noen områder krever fortsatt forbedring.
            </p>
          </Section>

          {/* 2. Hva fungerer */}
          <Section title="2. Det som fungerer godt">
            <ul className="space-y-1.5 pl-4">
              {[
                "Sidene fungerer med responsivt design på tvers av skjermstørrelser",
                "Interaktive UI-elementer (knapper, menyer, dialoger) er bygget med Radix UI og er tastatur-tilgjengelige",
                "Mørk og lys modus med god kontrast for primærinnhold",
                "Skjemavalidering med feilmeldinger presentert visuelt",
                "Animasjoner respekterer «prefers-reduced-motion» (redusert bevegelse) i nettleseren",
                "Tydelig visuell hierarki med overskriftsnivåer (h1–h6)",
                "Fokusindikatorer synlige på interaktive elementer",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 3. Kjente begrensninger */}
          <Section title="3. Kjente begrensninger">
            <p>
              Vi er klar over følgende tilgjengelighetsproblemer og jobber med å løse dem:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/80">
                    <th className="pb-2 pr-4 font-semibold">Område</th>
                    <th className="pb-2 pr-4 font-semibold">Begrensning</th>
                    <th className="pb-2 font-semibold">Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground/90">Alt-tekst på bilder</td>
                    <td className="py-2 pr-4">Noen produktbilder og brukergenererte bilder mangler beskrivende alt-tekst.</td>
                    <td className="py-2">Legger til påkrevd alt-tekst i opplastingsskjemaer.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground/90">Hopp-til-innhold-lenke</td>
                    <td className="py-2 pr-4">Mangler «hopp til hovedinnhold»-lenke i layout.</td>
                    <td className="py-2">Implementeres i root layout.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground/90">Krypto-handelsvindu</td>
                    <td className="py-2 pr-4">OSRS-stil inventar-grid og dra-og-slipp kan være vanskelig med kun tastatur.</td>
                    <td className="py-2">Utforsker tastaturalternativer for handel.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground/90">Fargekontrast</td>
                    <td className="py-2 pr-4">Enkelte muted/sekundære tekstelementer kan ha utilstrekkelig kontrast.</td>
                    <td className="py-2">Gjennomfører systematisk kontrastaudit.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground/90">Skjermleser i chat</td>
                    <td className="py-2 pr-4">Sanntidsmeldinger i samtaler annonseres ikke alltid korrekt til skjermlesere.</td>
                    <td className="py-2">Legger til ARIA live-regions for nye meldinger.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground/90">Avstemninger</td>
                    <td className="py-2 pr-4">Noen avanserte spørsmålstyper (shape-match, slider) kan mangle ARIA-merking.</td>
                    <td className="py-2">Forbedrer tilgjengelighet for interaktive spørsmålstyper.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* 4. Teknologi */}
          <Section title="4. Teknologi">
            <p>Tilgjengeligheten på veggat.com er avhengig av følgende teknologier:</p>
            <ul className="space-y-1 pl-4">
              {["HTML5", "CSS (Tailwind CSS)", "JavaScript / TypeScript", "React 19 + Next.js 16", "Radix UI (tilgjengelige primitiver)", "WAI-ARIA"].map((tech) => (
                <li key={tech} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal-500/60 shrink-0" />
                  <span>{tech}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 5. Tilbakemelding */}
          <Section title="5. Tilbakemelding og kontakt">
            <p>
              Vi setter pris på tilbakemeldinger om tilgjengeligheten til veggat.com. Dersom du opplever
              barrierer eller har forslag til forbedringer, kontakt oss:
            </p>
            <div className="rounded-lg bg-muted/30 p-4 text-xs space-y-1 mt-2">
              <p className="font-semibold text-foreground">{BUSINESS.name}</p>
              <p>
                E-post:{" "}
                <a href={`mailto:${BUSINESS.email}`} className="text-teal-500 hover:underline">{BUSINESS.email}</a>
              </p>
            </div>
            <p className="mt-3">Vi svarer normalt innen 14 dager.</p>
          </Section>

          {/* 6. Tilsyn */}
          <Section title="6. Tilsynsmyndighet">
            <p>
              Tilsynsmyndighet for universell utforming av IKT i Norge er{" "}
              <a
                href="https://www.uutilsynet.no"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-500 hover:underline"
              >
                UU-tilsynet (Digitaliseringsdirektoratet)
              </a>.
            </p>
            <p>
              Dersom du har klaget til oss og ikke er fornøyd med svaret, kan du sende en klage til UU-tilsynet
              via{" "}
              <a
                href="https://www.uutilsynet.no/webskjema/klage/248"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-500 hover:underline"
              >
                deres klageskjema
              </a>.
            </p>
          </Section>

          {/* Navigation */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              ← Personvernerklæring
            </Link>
            <Link href="/community-guidelines" className="text-muted-foreground hover:text-foreground transition-colors">
              Retningslinjer for fellesskapet →
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Salgsvilkår →
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
