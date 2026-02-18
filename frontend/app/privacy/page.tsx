"use client";

/**
 * @fileOverview Full GDPR Art. 13/14 compliant privacy policy for Veggat.
 * @stability active
 * @keyInvariants Must list all data categories, legal bases, retention periods,
 *   third-party recipients, and data subject rights per GDPR Art. 13/14.
 */

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

const BUSINESS = {
  name: "THORSEN SOFTWARE",
  orgNumber: "937 051 107",
  address: "Blåskjellveien 5B, 4310 Hommersåk, Norge",
  email: "kontakt@veggat.com",
  phone: "+47 984 207 21",
  dpa: "personvern@veggat.com",
};

/* -------------------------------------------------------------------------- */
/*  Reusable styled section                                                   */
/* -------------------------------------------------------------------------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/50 dark:bg-black/30 p-6 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export default function PrivacyPage() {
  const reduceMotion = useReducedMotion();

  /* ---- cookie / storage helpers ---- */
  const openCookieSettings = () => {
    try { window.dispatchEvent(new Event("veggat:cookie-consent-open")); } catch { /* noop */ }
  };
  const resetCookieConsent = () => {
    try { window.dispatchEvent(new Event("veggat:cookie-consent-reset")); } catch { /* noop */ }
  };
  const resetSiteData = async () => {
    if (!window.confirm("Dette sletter lokal lagring og cookies, og logger deg ut av tilgangsporten. Fortsette?")) return;
    try { await fetch("/api/access-gate", { method: "DELETE" }); } catch { /* noop */ }
    try {
      localStorage.clear();
      sessionStorage.clear();
      for (const c of document.cookie.split(";")) {
        const name = c.split("=")[0]?.trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
      resetCookieConsent();
    } catch { /* noop */ }
    window.location.href = "/gate?redirect=/";
  };

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      <div className="relative mx-auto w-full max-w-4xl px-6 py-16">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="space-y-8"
        >
          {/* ──────────── Header ──────────── */}
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
              <span>Personvernerklæring</span>
            </div>
            <h1 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
              Personvern og informasjonskapsler
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
              Denne personvernerklæringen beskriver hvordan {BUSINESS.name} (org.nr. {BUSINESS.orgNumber})
              samler inn, bruker og beskytter dine personopplysninger når du bruker veggat.com.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Sist oppdatert: {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </header>

          {/* ──────────── 1. Behandlingsansvarlig ──────────── */}
          <Section title="1. Behandlingsansvarlig">
            <p>
              Behandlingsansvarlig for personopplysningene vi behandler er:
            </p>
            <div className="rounded-lg bg-muted/30 p-4 text-xs space-y-1">
              <p className="font-semibold text-foreground">{BUSINESS.name}</p>
              <p>Org.nr: {BUSINESS.orgNumber}</p>
              <p>Adresse: {BUSINESS.address}</p>
              <p>
                E-post:{" "}
                <a href={`mailto:${BUSINESS.email}`} className="text-sky-500 hover:underline">{BUSINESS.email}</a>
              </p>
              <p>Telefon: {BUSINESS.phone}</p>
              <p>
                Personvernansvarlig:{" "}
                <a href={`mailto:${BUSINESS.dpa}`} className="text-sky-500 hover:underline">{BUSINESS.dpa}</a>
              </p>
            </div>
          </Section>

          {/* ──────────── 2. Kategorier av personopplysninger ──────────── */}
          <Section title="2. Hvilke personopplysninger vi behandler">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/80">
                    <th className="pb-2 pr-4 font-semibold">Kategori</th>
                    <th className="pb-2 pr-4 font-semibold">Eksempler</th>
                    <th className="pb-2 font-semibold">Kilde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Kontoinformasjon</td><td className="py-2 pr-4">Navn, e-postadresse, profilbilde, passord (hashet)</td><td className="py-2">Du / OAuth-tjeneste</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">OAuth-data</td><td className="py-2 pr-4">Google-, GitHub- eller Discord-bruker-ID</td><td className="py-2">OAuth-tilbyder</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Lommebok-adresser</td><td className="py-2 pr-4">EVM-, Solana- og Bitcoin-adresser du kobler til kontoen</td><td className="py-2">Du (via wallet-tilkobling)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Bestillings-/transaksjonsdata</td><td className="py-2 pr-4">Leveringsadresse, ordreinnhold, betalingsmetode, beløp</td><td className="py-2">Du (ved bestilling)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Brukergenerert innhold</td><td className="py-2 pr-4">Innlegg (Pulse), meldinger, produktannonser, avstemninger, bilder</td><td className="py-2">Du</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Tekniske data</td><td className="py-2 pr-4">IP-adresse, nettlesertype, operativsystem, sidevisninger</td><td className="py-2">Automatisk</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Verifikasjon</td><td className="py-2 pr-4">Verifiseringstier, score, telefonnummer (valgfritt)</td><td className="py-2">Du / plattformberegning</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ──────────── 3. Rettslig grunnlag ──────────── */}
          <Section title="3. Rettslig grunnlag for behandlingen">
            <p>Vi behandler personopplysninger basert på følgende rettslige grunnlag (GDPR Art. 6):</p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" /><span><strong className="text-foreground">Avtale (Art. 6(1)(b)):</strong> Nødvendig for å levere tjenestene du har bestilt — brukerregistrering, ordrebehandling, levering, kundekommunikasjon.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" /><span><strong className="text-foreground">Samtykke (Art. 6(1)(a)):</strong> Valgfrie informasjonskapsler (analytiske, markedsføring), nyhetsbrev, wallet-kobling.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" /><span><strong className="text-foreground">Berettiget interesse (Art. 6(1)(f)):</strong> Sikkerhet (inntrengingsdeteksjon, hastighetsbegrensning), svindelforebygging, systemovervåking, True Reach™-beregning.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" /><span><strong className="text-foreground">Rettslig forpliktelse (Art. 6(1)(c)):</strong> Bokføring og skattelovgivning, forbrukerrettigheter.</span></li>
            </ul>
          </Section>

          {/* ──────────── 4. Formål ──────────── */}
          <Section title="4. Formålene med behandlingen">
            <ul className="space-y-1.5 pl-4">
              {[
                "Opprette og administrere din brukerkonto",
                "Behandle og levere bestillinger (inkludert frakt via Bring)",
                "Muliggjøre sosiale funksjoner (Pulse-feed, samtaler, følg/synkroniser)",
                "Fasilitere peer-to-peer krypto-handel (wallet-signerte transaksjoner)",
                "Beregne og vise verifikasjonstier og True Reach™-poengsum",
                "Sende transaksjonelle e-poster (ordrebekreftelse, to-faktor, passordtilbakestilling)",
                "Oppfylle rettslige forpliktelser (bokføring, reklamasjon, angrerett)",
                "Forhindre svindel og sikre plattformen",
                "Forbedre tjenesten gjennom anonymisert analyse (kun med samtykke)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500/60 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* ──────────── 5. Oppbevaringstid ──────────── */}
          <Section title="5. Oppbevaringstid">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/80">
                    <th className="pb-2 pr-4 font-semibold">Datakategori</th>
                    <th className="pb-2 font-semibold">Oppbevaringstid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4">Kontoinformasjon</td><td className="py-2">Så lenge kontoen er aktiv, pluss 30 dager etter sletting</td></tr>
                  <tr><td className="py-2 pr-4">Ordredata</td><td className="py-2">5 år (bokføringsloven)</td></tr>
                  <tr><td className="py-2 pr-4">Brukergenerert innhold</td><td className="py-2">Til du sletter det, eller ved kontosletting</td></tr>
                  <tr><td className="py-2 pr-4">Tekniske logger</td><td className="py-2">90 dager (sikkerhet), deretter anonymisert</td></tr>
                  <tr><td className="py-2 pr-4">Samtykkedata (cookies)</td><td className="py-2">12 måneder fra samtykke ble gitt</td></tr>
                  <tr><td className="py-2 pr-4">Handelhistorikk (P2P)</td><td className="py-2">5 år (bokføring) / plattformens levetid for svindelforebygging</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ──────────── 6. Tredjeparter ──────────── */}
          <Section title="6. Deling med tredjeparter">
            <p>Vi deler personopplysninger med følgende kategorier av mottakere:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/80">
                    <th className="pb-2 pr-4 font-semibold">Mottaker</th>
                    <th className="pb-2 pr-4 font-semibold">Formål</th>
                    <th className="pb-2 font-semibold">Land / område</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Vercel</td><td className="py-2 pr-4">Hosting og edge-funksjonalitet</td><td className="py-2">USA (EU SCC)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Neon / Supabase</td><td className="py-2 pr-4">Databasehosting</td><td className="py-2">EU</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Pusher</td><td className="py-2 pr-4">Sanntidshendelser og varsler</td><td className="py-2">EU / USA</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Resend</td><td className="py-2 pr-4">E-postutsendelse</td><td className="py-2">USA (EU SCC)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">EdgeStore</td><td className="py-2 pr-4">Fillagring (bilder, opplastinger)</td><td className="py-2">USA (EU SCC)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Reown (WalletConnect)</td><td className="py-2 pr-4">Web3 wallet-tilkobling</td><td className="py-2">EU / USA</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Google / GitHub / Discord</td><td className="py-2 pr-4">OAuth-autentisering</td><td className="py-2">USA (EU SCC)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Bring / Posten</td><td className="py-2 pr-4">Frakttjenester og sporing</td><td className="py-2">Norge</td></tr>
                  <tr><td className="py-2 pr-4 font-medium text-foreground/90">Railway</td><td className="py-2 pr-4">Backend-hosting</td><td className="py-2">USA (EU SCC)</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-2">
              Overføring til land utenfor EØS er sikret gjennom EU Standard Contractual Clauses (SCC)
              eller tilstrekkelighetsbeslutninger der disse foreligger.
            </p>
          </Section>

          {/* ──────────── 7. Dine rettigheter ──────────── */}
          <Section title="7. Dine rettigheter">
            <p>Du har følgende rettigheter i henhold til GDPR:</p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span><strong className="text-foreground">Rett til innsyn (Art. 15):</strong> Du kan be om en kopi av alle personopplysninger vi har om deg. Bruk «Eksporter mine data» i innstillingene.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span><strong className="text-foreground">Rett til retting (Art. 16):</strong> Du kan rette feil i din profil via innstillingene.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span><strong className="text-foreground">Rett til sletting (Art. 17):</strong> Du kan be om at vi sletter kontoen din og tilhørende data. Bruk «Slett min konto» i innstillingene.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span><strong className="text-foreground">Rett til dataportabilitet (Art. 20):</strong> Du kan laste ned dine data i maskinlesbart format (JSON).</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span><strong className="text-foreground">Rett til å begrense behandlingen (Art. 18):</strong> Du kan be om at vi midlertidig stopper bruken av dine opplysninger.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span><strong className="text-foreground">Rett til å protestere (Art. 21):</strong> Du kan protestere mot behandling basert på berettiget interesse.</span></li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span><strong className="text-foreground">Rett til å trekke samtykke (Art. 7(3)):</strong> Du kan når som helst trekke tilbake samtykke til valgfrie cookies eller andre samtykkebaserte behandlinger.</span></li>
            </ul>
            <p className="mt-2">
              For å utøve dine rettigheter, kontakt oss på{" "}
              <a href={`mailto:${BUSINESS.dpa}`} className="text-sky-500 hover:underline">{BUSINESS.dpa}</a>.
              Vi svarer innen 30 dager.
            </p>
          </Section>

          {/* ──────────── 8. Automatiske avgjørelser ──────────── */}
          <Section title="8. Automatiserte avgjørelser og profilering">
            <p>
              Vi bruker automatisert behandling i følgende tilfeller:
            </p>
            <ul className="space-y-1.5 pl-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <span><strong className="text-foreground">True Reach™:</strong> En algoritme beregner en engasjementscore basert på 7 pilarer (synlighet, dybde, konvertering, lojalitet, vekst, gjenkalling, momentum). Scoren påvirker hvordan innholdet ditt rangeres i feeden, men blokkerer aldri tilgang til funksjoner.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <span><strong className="text-foreground">Verifikasjonstier:</strong> Et 12-trinns system som tildeles basert på identitetshandlinger (e-post, OAuth, wallet, telefon). Høyere tier gir økt vekting i avstemninger. Du kan alltid se din tier i profilen.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <span><strong className="text-foreground">Anti-svindel:</strong> Automatisk deteksjon av uvanlig aktivitet (burst-deteksjon, IP-hashing, minstekrav til lesestid). Ingen konsekvenser utover midlertidig hastighetsbegrensning.</span>
              </li>
            </ul>
            <p className="mt-2">
              Ingen av disse systemene tar rettslig bindende avgjørelser utelukkende basert på automatisert behandling.
              Du har rett til å kontakte oss for menneskelig gjennomgang.
            </p>
          </Section>

          {/* ──────────── 9. Barn ──────────── */}
          <Section title="9. Barn">
            <p>
              Veggat retter seg ikke mot barn under 16 år. Vi samler ikke bevisst inn personopplysninger
              fra brukere under 16 år. Dersom vi oppdager at vi har samlet inn data fra en mindreårig,
              vil vi slette denne informasjonen umiddelbart.
            </p>
            <p>
              Dersom du er mellom 13 og 16 år, krever vi samtykke fra foresatte for bruk av plattformen
              i henhold til GDPR Art. 8 og norsk personopplysningslov.
            </p>
          </Section>

          {/* ──────────── 10. Informasjonskapsler ──────────── */}
          <Section title="10. Informasjonskapsler (cookies)">
            <p>Vi bruker følgende kategorier av informasjonskapsler:</p>
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-foreground/85">Nødvendige (alltid aktive)</div>
                <div>Autentisering, CSRF-beskyttelse, øktdata, tilgangsport. Nødvendig for at nettstedet skal fungere.</div>
              </div>
              <div>
                <div className="font-semibold text-foreground/85">Preferansekapsler</div>
                <div>Tema (lys/mørk), brettkollapser, UI-tilstander. Lagres i localStorage i nettleseren din.</div>
              </div>
              <div>
                <div className="font-semibold text-foreground/85">Analytiske (kun med samtykke)</div>
                <div>Hjelper oss å forstå hvilke sider som er trege eller forvirrende. Ingen personidentifisering.</div>
              </div>
              <div>
                <div className="font-semibold text-foreground/85">Markedsføring (ikke i bruk)</div>
                <div>Vi bruker for øyeblikket ingen markedsføringscookies.</div>
              </div>
            </div>
            <p className="mt-3">
              Du kan endre dine valg når som helst:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCookieSettings}
                className="rounded-xl bg-primary/10 dark:bg-white/10 px-4 py-2 text-sm font-semibold text-primary dark:text-white/90 transition-colors hover:bg-primary/15 dark:hover:bg-white/15"
              >
                Cookie-innstillinger
              </button>
              <button
                type="button"
                onClick={resetCookieConsent}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Tilbakestill samtykke
              </button>
              <button
                type="button"
                onClick={resetSiteData}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Slett all sidedata
              </button>
            </div>
          </Section>

          {/* ──────────── 11. Sikkerhet ──────────── */}
          <Section title="11. Sikkerhet">
            <p>
              Vi tar datasikkerhet på alvor og bruker bransjestandarder for å beskytte dine data:
            </p>
            <ul className="space-y-1.5 pl-4">
              {[
                "All kommunikasjon krypteres med HTTPS/TLS",
                "Passord lagres med bcrypt-hashing (aldri i klartekst)",
                "OAuth-autentisering med CSRF-beskyttelse",
                "Web3-transaksjoner krever wallet-signatur",
                "Hastighetsbegrensning på alle API-endepunkter",
                "Regelmessige sikkerhetsoppdateringer av avhengigheter",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500/60 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Finner du en sårbarhet? Meld den ansvarlig til{" "}
              <a href={`mailto:${BUSINESS.email}`} className="text-sky-500 hover:underline">{BUSINESS.email}</a>.
            </p>
          </Section>

          {/* ──────────── 12. Klagerett ──────────── */}
          <Section title="12. Klagerett">
            <p>
              Dersom du mener at vi behandler personopplysningene dine i strid med personvernlovgivningen,
              har du rett til å klage til:
            </p>
            <div className="rounded-lg bg-muted/30 p-4 text-xs space-y-1 mt-2">
              <p className="font-semibold text-foreground">Datatilsynet</p>
              <p>Postboks 458, Sentrum</p>
              <p>0105 Oslo</p>
              <p>
                Nettside:{" "}
                <a href="https://www.datatilsynet.no" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">
                  datatilsynet.no
                </a>
              </p>
            </div>
            <p className="mt-3">
              Vi oppfordrer deg til å kontakte oss først på{" "}
              <a href={`mailto:${BUSINESS.dpa}`} className="text-sky-500 hover:underline">{BUSINESS.dpa}</a>{" "}
              slik at vi kan forsøke å løse saken direkte.
            </p>
          </Section>

          {/* ──────────── 13. Endringer ──────────── */}
          <Section title="13. Endringer i personvernerklæringen">
            <p>
              Vi kan oppdatere denne erklæringen ved behov. Vesentlige endringer vil bli varslet
              via e-post eller en melding på plattformen. Vi anbefaler at du regelmessig leser
              gjennom denne siden.
            </p>
          </Section>

          {/* ──────────── Navigation ──────────── */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              ← Salgsvilkår
            </Link>
            <Link href="/community-guidelines" className="text-muted-foreground hover:text-foreground transition-colors">
              Retningslinjer for fellesskapet →
            </Link>
            <Link href="/accessibility" className="text-muted-foreground hover:text-foreground transition-colors">
              Tilgjengelighetserklæring →
            </Link>
            <Link href="/info" className="text-muted-foreground hover:text-foreground transition-colors">
              Om oss →
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
