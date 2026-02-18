"use client";

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

const BUSINESS_INFO = {
  name: "THORSEN SOFTWARE",
  orgNumber: "937 051 107",
  address: "Blåskjellveien 5B, 4310 Hommersåk",
  email: "kontakt@veggat.com",
  phone: "+47 984 207 21",
  country: "Norge",
};

export default function TermsPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Clean background - no gradient orbs */}

      <div className="relative mx-auto w-full max-w-4xl px-6 py-16">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* Header */}
          <header className="mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground mb-4">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
              <span>Juridisk</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Salgsvilkår
            </h1>
            <p className="mt-3 text-muted-foreground">
              Sist oppdatert: {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </header>

          {/* Content */}
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10">
            
            {/* 1. Parter (Parties) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                1. Parter
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Selger er <strong className="text-foreground">{BUSINESS_INFO.name}</strong>, 
                org.nr. {BUSINESS_INFO.orgNumber}, {BUSINESS_INFO.address}, 
                e-post: <a href={`mailto:${BUSINESS_INFO.email}`} className="text-emerald-500 hover:underline">{BUSINESS_INFO.email}</a>, 
                telefon: {BUSINESS_INFO.phone}, 
                heretter kalt «Selger».
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Kjøper er den forbrukeren som foretar bestillingen, heretter kalt «Kjøper».
              </p>
            </section>

            {/* 2. Betaling (Payment) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                2. Betaling
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Selger kan kreve betaling for varen fra det tidspunkt den blir sendt fra Selger til Kjøper.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Vi aksepterer følgende betalingsmetoder:
              </p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span><strong className="text-foreground">Vipps</strong> – Betal enkelt med Vipps-appen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span><strong className="text-foreground">Kryptovaluta</strong> – Vi aksepterer utvalgte kryptovalutaer (ETH, USDC)</span>
                </li>
              </ul>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                All prices are listed in Norwegian kroner (NOK) including value-added tax (VAT) where applicable.
              </p>
            </section>

            {/* 3. Levering (Delivery) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                3. Levering
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Levering skjer når Kjøper, eller Kjøpers representant, har overtatt varen.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Fysiske varer:</strong> Leveres via Bring eller annen avtalt transportør. 
                Estimert leveringstid vises ved bestilling og avhenger av leveringsadresse og valgt fraktmetode.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Digitale produkter:</strong> Leveres elektronisk umiddelbart etter bekreftet betaling, 
                med mindre annet er spesifisert i produktbeskrivelsen.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Dersom leveringen av varen blir forsinket, vil vi informere Kjøper så snart vi har kjennskap til dette, 
                sammen med informasjon om og når levering kan ventes, eller om varen er utsolgt.
              </p>
            </section>

            {/* 4. Angrerett (Right of withdrawal) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                4. Angrerett
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Ved kjøp av fysiske varer har Kjøper 14 dagers angrerett i henhold til angrerettloven. 
                Angreretten gjelder fra den dagen Kjøper mottar varen.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                For å benytte angreretten må Kjøper gi Selger melding om dette innen fristen. 
                Meldingen kan sendes på e-post til <a href={`mailto:${BUSINESS_INFO.email}`} className="text-emerald-500 hover:underline">{BUSINESS_INFO.email}</a>.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Varen må returneres i vesentlig samme stand og mengde som den ble mottatt. 
                Kjøper bærer kostnadene for retur av varen.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-200/90">
                  <strong>Merk:</strong> For digitale produkter og tjenester som er levert/påbegynt med Kjøpers samtykke, 
                  gjelder ikke angrerett etter at levering har startet.
                </p>
              </div>
            </section>

            {/* 5. Retur (Returns) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                5. Retur
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Ved bruk av angreretten må varen returneres til Selger innen rimelig tid, og senest 14 dager 
                etter at melding om bruk av angreretten er gitt.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Returadresse:</strong><br />
                {BUSINESS_INFO.name}<br />
                {BUSINESS_INFO.address}
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Kjøper dekker returkostnader med mindre varen er feil eller mangelfull. 
                Selger refunderer kjøpesummen inkludert frakt (standardfrakt) innen 14 dager etter at vi har mottatt varen, 
                eller dokumentasjon på at varen er returnert.
              </p>
            </section>

            {/* 6. Reklamasjon (Complaints) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                6. Reklamasjon og garanti
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Hvis det foreligger en mangel ved varen, må Kjøper innen rimelig tid etter at den ble oppdaget 
                eller burde ha blitt oppdaget, gi Selger melding om at Kjøper vil påberope seg mangelen (reklamasjon).
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Reklamasjonsfristen er 2 år fra Kjøper mottok varen. For varer som er ment å vare vesentlig lenger, 
                er fristen 5 år.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Ved berettiget reklamasjon har Kjøper rett til å kreve retting, omlevering, prisavslag, 
                erstatning eller heving i henhold til forbrukerkjøpsloven.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Reklamasjon meldes til <a href={`mailto:${BUSINESS_INFO.email}`} className="text-emerald-500 hover:underline">{BUSINESS_INFO.email}</a> med 
                beskrivelse av mangelen, ordrenummer og kontaktinformasjon.
              </p>
            </section>

            {/* 7. Konfliktløsning (Dispute resolution) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                7. Konfliktløsning
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Klager rettes til Selger innen rimelig tid. Partene skal forsøke å løse eventuelle tvister i minnelighet.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Dersom dette ikke lykkes, kan Kjøper bringe saken inn for{" "}
                <a 
                  href="https://www.forbrukertilsynet.no" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:underline"
                >
                  Forbrukertilsynet
                </a>{" "}
                eller{" "}
                <a 
                  href="https://www.forbrukerradet.no" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:underline"
                >
                  Forbrukerrådet
                </a>.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Europa-Kommisjonens klageportal for netthandel kan også benyttes:{" "}
                <a 
                  href="https://ec.europa.eu/consumers/odr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:underline"
                >
                  ec.europa.eu/consumers/odr
                </a>
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Tvister som ikke løses i minnelighet, avgjøres av norske domstoler med Oslo tingrett som verneting.
              </p>
            </section>

            {/* 8. Brukergenerert innhold og lisens (UGC licensing) */}
            <section>
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                8. Brukergenerert innhold og lisens
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Ved å laste opp innhold til Veggat (innlegg, bilder, produktannonser, avstemninger, meldinger m.m.) 
                gir du oss en ikke-eksklusiv, verdensomspennende, gebyrfri lisens til å lagre, vise og distribuere 
                innholdet innenfor plattformen. Du beholder alle eiendomsrettigheter.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Du garanterer at du eier eller har de nødvendige rettighetene til alt innhold du laster opp. 
                Innhold som krenker andres opphavsrett eller immaterielle rettigheter kan fjernes uten forvarsel. 
                For rapportering av krenkelser, se våre{" "}
                <Link href="/community-guidelines" className="text-emerald-500 hover:underline">
                  retningslinjer for fellesskapet
                </Link>.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Lisensen opphører når du sletter innholdet, med unntak av kopier som allerede er delt 
                med andre brukere (f.eks. meldinger) eller som vi er rettslig forpliktet til å beholde (f.eks. ordrehistorikk).
              </p>
            </section>

            {/* Contact box */}
            <section className="mt-12 p-6 rounded-2xl bg-muted/30 border border-border">
              <h3 className="text-lg font-semibold text-foreground">Kontaktinformasjon</h3>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <div>
                  <span className="font-medium text-foreground">Bedrift:</span><br />
                  {BUSINESS_INFO.name}
                </div>
                <div>
                  <span className="font-medium text-foreground">Org.nr:</span><br />
                  {BUSINESS_INFO.orgNumber}
                </div>
                <div>
                  <span className="font-medium text-foreground">Adresse:</span><br />
                  {BUSINESS_INFO.address}
                </div>
                <div>
                  <span className="font-medium text-foreground">E-post:</span><br />
                  <a href={`mailto:${BUSINESS_INFO.email}`} className="text-emerald-500 hover:underline">{BUSINESS_INFO.email}</a>
                </div>
                <div>
                  <span className="font-medium text-foreground">Telefon:</span><br />
                  {BUSINESS_INFO.phone}
                </div>
              </div>
            </section>

            {/* Links */}
            <div className="mt-8 flex flex-wrap gap-4 text-sm">
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                ← Personvern og cookies
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
          </div>
        </motion.div>
      </div>
    </div>
  );
}
