/** @fileOverview One versioned source for the published sales terms and retained buyer copy. @stability experimental */
import { SALES_TERMS_VERSION, SALES_TERMS_DATE } from './sales-terms-version';
export const BUSINESS_INFO = {
  "name": "THORSEN SOFTWARE",
  "orgNumber": "937 051 107",
  "address": "Blåskjellveien 5B, 4310 Hommersåk",
  "email": "kontakt@veggat.com",
  "phone": "+47 984 207 21",
  "country": "Norge"
} as const;

// Preserved from the published terms; legal review remains a separate gate.
export const SALES_TERMS_SECTIONS = [
  {
    "id": "section-1",
    "title": "1. Parter",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Selger er THORSEN SOFTWARE, org.nr. 937 051 107, Blåskjellveien 5B, 4310 Hommersåk, e-post: kontakt@veggat.com, telefon: +47 984 207 21, heretter kalt «Selger»."
      },
      {
        "kind": "paragraph",
        "text": "Kjøper er den forbrukeren som foretar bestillingen, heretter kalt «Kjøper»."
      }
    ]
  },
  {
    "id": "section-2",
    "title": "2. Betaling",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Selger, innhold, pris og tilgjengelig betalingsmåte vises før du betaler. Digitale filer og AI-kreditter leveres først etter at betalingen er bekreftet av betalingsleverandøren."
      },
      {
        "kind": "paragraph",
        "text": "For Veggat Studio-produktene gjelder følgende:"
      },
      {
        "kind": "bullet",
        "text": "PayPal – Beløp og betalingsvaluta bekreftes før godkjenning hos PayPal."
      },
      {
        "kind": "bullet",
        "text": "Andre betalingsmåter – Kan bare brukes når de er aktivert for den aktuelle bestillingen. Et kryptobeløp i prisvisningen er ikke i seg selv et betalingstilbud."
      },
      {
        "kind": "paragraph",
        "text": "Prisene inkluderer merverdiavgift der det gjelder. Valgt visningsvaluta og kryptovaluta kan være veiledende omregninger. Beløpet og valutaen du faktisk godkjenner hos betalingsleverandøren gjelder for betalingen. Sandbox- og demoordre er tydelig merket og bruker ikke ekte penger."
      }
    ]
  },
  {
    "id": "section-3",
    "title": "3. Levering",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Levering skjer når Kjøper, eller Kjøpers representant, har overtatt varen."
      },
      {
        "kind": "paragraph",
        "text": "Fysiske varer: Leveres via Bring eller annen avtalt transportør. Estimert leveringstid vises ved bestilling og avhenger av leveringsadresse og valgt fraktmetode."
      },
      {
        "kind": "paragraph",
        "text": "Digitale produkter: Leveres elektronisk umiddelbart etter bekreftet betaling, med mindre annet er spesifisert i produktbeskrivelsen."
      },
      {
        "kind": "paragraph",
        "text": "Dersom leveringen av varen blir forsinket, vil vi informere Kjøper så snart vi har kjennskap til dette, sammen med informasjon om og når levering kan ventes, eller om varen er utsolgt."
      }
    ]
  },
  {
    "id": "section-4",
    "title": "4. Angrerett",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Ved kjøp av fysiske varer har Kjøper 14 dagers angrerett i henhold til angrerettloven. Angreretten gjelder fra den dagen Kjøper mottar varen."
      },
      {
        "kind": "paragraph",
        "text": "For å benytte angreretten må Kjøper gi Selger melding om dette innen fristen. Meldingen kan sendes på e-post til kontakt@veggat.com."
      },
      {
        "kind": "paragraph",
        "text": "For fysiske varer kan du undersøke varen for å fastslå art, egenskaper og funksjon. Eventuelt fradrag for verdireduksjon og ansvar for returkostnader følger lovens vilkår."
      },
      {
        "kind": "paragraph",
        "text": "Digitale filer: Nedlasting alene fjerner ikke angreretten. Unntaket for digitalt innhold krever uttrykkelig forhåndssamtykke til levering, erkjennelse av at angreretten går tapt, og nødvendig bekreftelse på et varig medium. Vi avviser ikke et krav bare fordi en fil er åpnet eller lastet ned."
      },
      {
        "kind": "paragraph",
        "text": "AI-tjenester og kreditter: Reglene for tjenester vurderes separat. Kjøp eller bruk av kreditter behandles ikke automatisk som et avkall på angrerett. Kontakt oss med ordrenummer ved ønske om tilbakebetaling av ubrukte kreditter. Ufravikelige rettigheter og krav ved mangler gjelder uansett."
      }
    ]
  },
  {
    "id": "section-5",
    "title": "5. Retur",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Ved bruk av angreretten må varen returneres til Selger innen rimelig tid, og senest 14 dager etter at melding om bruk av angreretten er gitt."
      },
      {
        "kind": "paragraph",
        "text": "Returadresse: THORSEN SOFTWARE Blåskjellveien 5B, 4310 Hommersåk"
      },
      {
        "kind": "paragraph",
        "text": "Ved gyldig bruk av angreretten tilbakebetaler vi etter lovens frister, normalt innen 14 dager etter at vi har mottatt meldingen. For fysiske varer kan tilbakebetaling holdes tilbake til varen eller dokumentasjon på returen er mottatt, der loven tillater det. Standard leveringskostnad tilbakebetales der dette følger av loven."
      },
      {
        "kind": "paragraph",
        "text": "En mottatt eller godkjent returforespørsel betyr ikke at penger er tilbakebetalt. Betalingsleverandørens bekreftelse avgjør betalingsstatusen. Tilbakebetaling skjer normalt med samme betalingsmiddel. Bankens behandlingstid kan komme i tillegg."
      },
      {
        "kind": "paragraph",
        "text": "Ved bekreftet tilbakebetaling eller reversering stopper fremtidig tilgang til de berørte filene og kredittene. En fil som allerede er lagret på enheten din, kan ikke slettes av oss. Hvis tilbakebetalte kreditter er brukt, kan kontoen få en synlig kredittjustering som må avklares før videre betalt AI-bruk. Vi belaster ikke kortet ditt automatisk. Delvise tilbakebetalinger kan medføre midlertidig tilgangsstans mens beløp og rettigheter avklares."
      }
    ]
  },
  {
    "id": "section-6",
    "title": "6. Reklamasjon og garanti",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Hvis det foreligger en mangel ved varen, må Kjøper innen rimelig tid etter at den ble oppdaget eller burde ha blitt oppdaget, gi Selger melding om at Kjøper vil påberope seg mangelen (reklamasjon)."
      },
      {
        "kind": "paragraph",
        "text": "For fysiske varer gjelder forbrukerkjøpslovens reklamasjonsregler, normalt 2 år eller 5 år for varer som er ment å vare vesentlig lenger. Digitale ytelser følger egne regler i digitalytelsesloven; fristene for fysiske varer brukes ikke som en generell begrensning av krav på digitale filer eller tjenester."
      },
      {
        "kind": "paragraph",
        "text": "Ved berettiget reklamasjon har Kjøper rett til å kreve retting, omlevering, prisavslag, erstatning eller heving etter den loven som gjelder for kjøpet. Nedlasting eller bruk fjerner ikke retten til å klage på feil eller mangler. Disse vilkårene begrenser heller ikke gjeldende rettigheter hos PayPal eller kortutsteder."
      },
      {
        "kind": "paragraph",
        "text": "Reklamasjon meldes til kontakt@veggat.com med beskrivelse av mangelen, ordrenummer og kontaktinformasjon."
      }
    ]
  },
  {
    "id": "section-7",
    "title": "7. Konfliktløsning",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Klager rettes til Selger innen rimelig tid. Partene skal forsøke å løse eventuelle tvister i minnelighet."
      },
      {
        "kind": "paragraph",
        "text": "Dersom dette ikke lykkes, kan Kjøper bringe saken inn for Forbrukertilsynet eller Forbrukerrådet."
      },
      {
        "kind": "paragraph",
        "text": "For veiledning om utenrettslig klagebehandling i Europa, se EU-kommisjonens forbrukerportal"
      },
      {
        "kind": "paragraph",
        "text": "Tvister som ikke løses i minnelighet, behandles etter gjeldende regler om lovvalg og verneting. Dine ufravikelige rettigheter som forbruker går foran disse vilkårene."
      }
    ]
  },
  {
    "id": "section-8",
    "title": "8. Brukergenerert innhold og lisens",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Ved å laste opp innhold til Veggat (innlegg, bilder, produktannonser, avstemninger, meldinger m.m.) gir du oss en ikke-eksklusiv, verdensomspennende, gebyrfri lisens til å lagre, vise og distribuere innholdet innenfor plattformen. Du beholder alle eiendomsrettigheter."
      },
      {
        "kind": "paragraph",
        "text": "Du garanterer at du eier eller har de nødvendige rettighetene til alt innhold du laster opp. Innhold som krenker andres opphavsrett eller immaterielle rettigheter kan fjernes uten forvarsel. For rapportering av krenkelser, se våre retningslinjer for fellesskapet."
      },
      {
        "kind": "paragraph",
        "text": "Lisensen opphører når du sletter innholdet, med unntak av kopier som allerede er delt med andre brukere (f.eks. meldinger) eller som vi er rettslig forpliktet til å beholde (f.eks. ordrehistorikk)."
      }
    ]
  },
  {
    "id": "section-9",
    "title": "9. Forhåndsbetalte AI-kreditter",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Kreditter gir tilgang til avgrensede AI-meldinger i Veggat. De er ikke penger, en investering eller en lovnad om et bestemt antall modell-tokens. Kredittkostnaden for valgt modell vises før sending. Du kan ikke sende en betalt melding uten tilstrekkelig tilgjengelig saldo. Modelltilgjengelighet og bruksgrenser kan variere."
      },
      {
        "kind": "paragraph",
        "text": "Kredittkjøp er engangskjøp uten abonnement eller automatisk påfyll. Pris og eventuell mengderabatt vises før betalingen. Ved en registrert leverandørfeil frigjøres eller tilbakeføres meldingens reserverte kreditter. AI-svar kan være feil og må vurderes av deg; dette begrenser ikke lovfestede rettigheter ved feil på tjenesten."
      }
    ]
  }
] as const;

export const SALES_TERMS_LINKS = [
  { label: 'Forbrukertilsynet', href: 'https://www.forbrukertilsynet.no' },
  { label: 'Forbrukerrådet', href: 'https://www.forbrukerradet.no' },
  { label: 'EU-kommisjonens forbrukerportal', href: 'https://consumer-redress.ec.europa.eu/index_en' },
  { label: 'Retningslinjer for fellesskapet', href: 'https://www.veggat.com/community-guidelines' },
] as const;

// Same information fields as government form Q-0319B (10.2023), in a text format
// the buyer can retain and complete. No address/signature is submitted by merely downloading.
export const WITHDRAWAL_FORM = `ANGRESKJEMA — VARER OG TJENESTER
Valgfri mal: Du kan også sende en annen tydelig melding om at du vil gå fra avtalen.
Send meldingen til THORSEN SOFTWARE, Blåskjellveien 5B, 4310 Hommersåk, Norge,
eller e-post kontakt@veggat.com.

Jeg/vi vil gå fra avtalen beskrevet nedenfor.
Gjelder (kryss av): [ ] vare(r)  [ ] tjeneste(r)
Beskrivelse av kjøpet: ________________________________________________
Ordrenummer, hvis tilgjengelig: _______________________________________
For tjenester — dato da avtalen ble inngått: __________________________
For varer — dato da varen ble mottatt: ________________________________
Navn på forbrukeren/forbrukerne: ______________________________________
Adresse til forbrukeren/forbrukerne: __________________________________
Dato for meldingen: __________________________________________________
Underskrift ved innsending på papir: _________________________________

Ikke legg ved kortnummer, passord eller private nedlastingslenker.
Alternativt: åpne kvitteringen under Mine ordre og velg «Withdraw from this purchase».
Å laste ned dette skjemaet sender ingen melding og utsteder ingen tilbakebetaling.`;

export const SALES_TERMS_TEXT = [
  `VEGGAT — FULLSTENDIGE PUBLISERTE SALGSVILKÅR\nVersjon: ${SALES_TERMS_VERSION}\nDato: ${SALES_TERMS_DATE}\nSpråk: Norsk bokmål\n`,
  ...SALES_TERMS_SECTIONS.map(section => [section.title, ...section.blocks.map(block => block.text)].join('\n\n')),
  'Lenker\n' + SALES_TERMS_LINKS.map(link => `${link.label}: ${link.href}`).join('\n'),
  WITHDRAWAL_FORM,
].join('\n\n');
