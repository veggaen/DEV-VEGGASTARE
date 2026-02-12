# Norwegian Legal & Regulatory Compliance — Veggat Platform

> Comprehensive compliance map for operating a SaaS marketplace with UGC, payments, and Web3 features from Norway (ENK).

**Business Entity:** THORSEN SOFTWARE · Org.nr 937 051 107  
**Platform:** [veggat.com](https://www.veggat.com)  
**Last Updated:** February 2026  
**Disclaimer:** This document is for development planning only. It is **not legal advice**. Consult a qualified Norwegian lawyer before launch.

---

## Table of Contents

1. [Regulatory Overview](#1-regulatory-overview)
2. [Business Administration & Tax](#2-business-administration--tax)
3. [GDPR & Privacy (Personopplysningsloven)](#3-gdpr--privacy)
4. [Cookies & Tracking (Ekomloven)](#4-cookies--tracking)
5. [Consumer Protection & E-Commerce](#5-consumer-protection--e-commerce)
6. [Accessibility / Universal Design (UU)](#6-accessibility--universal-design)
7. [Platform Regulation & DSA](#7-platform-regulation--dsa)
8. [Copyright & User Uploads](#8-copyright--user-uploads)
9. [Payment Regulation](#9-payment-regulation)
10. [Web3 & Crypto Considerations](#10-web3--crypto-considerations)
11. [Digital Platform Information (DPI) Tax Reporting](#11-digital-platform-information-dpi)
12. [Security Standards & Best Practices](#12-security-standards--best-practices)
13. [Veggat Compliance Status Matrix](#13-veggat-compliance-status-matrix)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Lessons Learned & Solutions Log](#15-lessons-learned--solutions-log)
16. [Authoritative Sources](#16-authoritative-sources)

---

## 1. Regulatory Overview

Veggat triggers multiple regulatory regimes because it is:

| Role | What It Means | Key Laws |
|------|--------------|----------|
| **SaaS vendor (B2B)** | Selling websites/apps to businesses | Bokføringsloven, MVA |
| **Marketplace operator (B2C)** | Users buy/sell products via the platform | Ehandelsloven, Forbrukerkjøpsloven, Angrerettloven |
| **UGC platform** | Users post content (Pulse feed, chat, listings) | DSA (via Nkom), Åndsverkloven |
| **Data controller** | Processing personal data (accounts, messages, analytics) | GDPR / Personopplysningsloven |
| **Payment facilitator** | Integrating Vipps, crypto payments | Finanstilsynet rules, e-money regs |
| **Web3 platform** | Wallet connections, crypto trading, on-chain verification | MiCA (incoming), Finanstilsynet guidance |

### Practical Risk-Reducing Design Choices

These architectural decisions keep Veggat in a lower-regulation zone:

- **Use licensed PSPs only** (Vipps, Stripe) — never hold user funds → avoids e-money licensing
- **Classifieds model** for listings — do not broker transactions → avoids real estate brokerage licensing
- **Moderation + reporting UX from day one** — DSA readiness built into the platform
- **Mock mode for shipping** — `BRING_MODE=mock` means the template works without live credentials

---

## 2. Business Administration & Tax

### ENK Baseline Obligations

| Obligation | Status | Details |
|-----------|--------|---------|
| ENK registration (Brønnøysund) | ✅ Done | Org.nr 937 051 107 |
| MVA registration (NOK 50,000 threshold) | ⚠️ Monitor | Register when taxable turnover exceeds NOK 50,000 in 12 months |
| Bookkeeping (Bokføringsloven) | ⚠️ Ongoing | Maintain records for 5 years, use approved accounting software |
| Annual tax return (Næringsoppgave) | ⚠️ Ongoing | File via Altinn annually |

### MVA/VAT Rules for Digital Services

- **Digital services sold B2C to Norwegian consumers:** MVA at 25%
- **All prices displayed to consumers must include MVA**
- **SaaS sold B2B:** Reverse charge may apply for cross-border sales
- **Crypto transactions:** Currently MVA-exempt in Norway (financial services exemption), but monitor MiCA developments

### Key Sources
- [Brønnøysund — ENK registration](https://www.brreg.no/enkeltpersonforetak/registrere-et-enkeltpersonforetak/)
- [Skatteetaten — ENK basics & VAT](https://www.skatteetaten.no/bedrift-og-organisasjon/starte-og-drive/ny-som-naringsdrivende/nytt-enk/)
- [Lovdata — Bokføringsloven](https://lovdata.no/lov/2004-11-19-73)
- [Skatteetaten — MVA for digital services](https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/)

---

## 3. GDPR & Privacy

### Veggat's Role

| Context | GDPR Role | Implications |
|---------|-----------|-------------|
| Running veggat.com | **Data Controller** | Full responsibility for lawful processing, documentation, breach handling |
| Building SaaS for clients | **Data Processor** | Need DPA (Data Processing Agreement) with each client |
| Using Vercel, Pusher, EdgeStore | Controller using processors | Need DPA with each vendor |

### Required Privacy Documentation

| Document | Status | Location |
|----------|--------|----------|
| Privacy Policy (Art. 13/14) | ❌ **Incomplete** | `/privacy` exists but is deliberately vague — needs full rewrite |
| Data Processing Agreement (DPA) template | ❌ Missing | Needed for B2B SaaS clients |
| Record of Processing Activities (Art. 30) | ❌ Missing | Internal document |
| Data Protection Impact Assessment (DPIA) | ❌ Missing | Required for high-risk processing (UGC, profiling, Web3) |

### What the Privacy Policy MUST Include (Art. 13/14)

Our current `/privacy` page is intentionally high-level. For compliance, it needs:

1. **Data controller identity & contact** — THORSEN SOFTWARE, org.nr, email, address
2. **Categories of personal data** — Name, email, OAuth IDs, wallet addresses, IP, messages, uploads
3. **Legal basis for each processing** — Consent, contract, legitimate interest
4. **Retention periods** — How long each data type is kept
5. **Third-party recipients** — Vercel, Pusher, EdgeStore, Google (OAuth), GitHub, Discord, Reown
6. **International transfers** — Vercel (US), Pusher (US/EU), etc. — need Standard Contractual Clauses or adequacy
7. **Data subject rights** — Access, rectification, erasure, portability, restriction, objection
8. **Right to complain** to Datatilsynet
9. **Automated decision-making** — True Reach™ scoring, verification tier system
10. **Children's data** — Age requirements, parental consent if applicable

### Data Subject Rights — Implementation Status

| Right | GDPR Article | Status | Implementation |
|-------|-------------|--------|----------------|
| Right of Access | Art. 15 | ❌ Missing | Need data export endpoint |
| Right to Rectification | Art. 16 | 🔄 Partial | Users can edit profile, but not all data |
| Right to Erasure | Art. 17 | ❌ Missing | Need account deletion flow |
| Right to Portability | Art. 20 | ❌ Missing | Need JSON data export |
| Right to Restriction | Art. 18 | ❌ Missing | Need processing pause mechanism |
| Right to Object | Art. 21 | ❌ Missing | Need opt-out for profiling |
| Withdraw Consent | Art. 7(3) | 🔄 Partial | Cookie consent can be reset; other consent unclear |

### Integration Core Implications

The backend Integration Core should:
- **Log all data access** for audit trail (who accessed what, when)
- **Support data export API** — `GET /v1/users/{id}/data-export` for portability
- **Support data deletion API** — `DELETE /v1/users/{id}` with cascading cleanup
- **Include DPA terms** in any B2B API agreements
- **Encrypt PII at rest** in PostgreSQL (or use column-level encryption for sensitive fields)

### Key Sources
- [Lovdata — Personopplysningsloven (GDPR in Norway)](https://lovdata.no/lov/2018-06-15-38)
- [Datatilsynet — GDPR guidance](https://www.datatilsynet.no/)
- [Datatilsynet — DPA guidance (English)](https://www.datatilsynet.no/globalassets/global/english/databehandleravtaler_veil_okt2012_eng.pdf)

---

## 4. Cookies & Tracking

### Current Implementation ✅

Veggat has a **functional cookie consent banner** (`components/uicustom/cookie-banner.tsx`):
- Three categories: Essential (always on), Analytics (toggleable), Marketing (toggleable)
- Consent stored in `localStorage` with versioning (`veggat:cookieConsent`)
- Accept All / Essential Only / Customize options
- Reset mechanism from `/privacy` page

### Ekomloven §3-15 (Effective 1 Jan 2025)

Norwegian cookie rules now align with strict GDPR-style consent:
- **Prior informed consent** required for all non-essential cookies
- **Granular opt-in** (not just "accept all") — ✅ We have this
- **Easy withdrawal** — ✅ We have reset functionality
- **No cookie walls** (cannot deny service for refusing optional cookies)

### What's Missing

| Gap | Priority | Action |
|-----|----------|--------|
| **Detailed cookie list** | High | Document every cookie: name, purpose, duration, 1st/3rd party |
| **Third-party cookie disclosure** | High | Pusher, Google Analytics, Vercel Analytics, EdgeStore |
| **Cookie policy page** | Medium | Expand `/privacy` or create dedicated `/cookies` page |

### Integration Core Connection

If the backend sets any cookies or tracking headers:
- Document them in the cookie policy
- Ensure CORS headers don't inadvertently expose tracking across origins

### Key Sources
- [Datatilsynet — Cookies & tracking](https://www.datatilsynet.no/personvern-pa-ulike-omrader/internett-og-apper/bruk-av-informasjonskapsler-og-andre-sporingsteknologier/)
- [Lovdata — Ekomloven](https://lovdata.no/lov/2024-12-13-76)

---

## 5. Consumer Protection & E-Commerce

### Applicable Laws

| Law | Scope | Key Requirement |
|-----|-------|----------------|
| **Ehandelsloven** | All e-commerce | Seller identification, confirmation, terms accessibility |
| **Forbrukerkjøpsloven** | Consumer product sales | Warranties, complaint rights |
| **Angrerettloven** | Distance sales to consumers | 14-day withdrawal right |
| **Markedsføringsloven** | Marketing/advertising | Fair marketing, price display |
| **Digitalytelsesloven** | Digital services to consumers | Conformity, updates, consumer rights for digital content |

### Current Implementation

| Requirement | Status | Location |
|-------------|--------|----------|
| Sales Terms (Salgsvilkår) | ✅ Done | `/terms` — 7 sections covering all required areas |
| Seller identification | ✅ Done | Footer + `/terms` contact box (org.nr, address, email, phone) |
| Price display with MVA | ✅ Done | Product prices include currency conversion |
| 14-day withdrawal info | ✅ Done | `/terms` section 4 (Angrerett) |
| Complaints handling | ✅ Done | `/terms` section 6 (Reklamasjon) |
| Conflict resolution | ✅ Done | `/terms` section 7 (Konfliktløsning + EU ODR link) |
| Order confirmation email | ❌ Missing | Need transactional email system |
| Withdrawal form (Angrerettskjema) | ❌ Missing | Should provide downloadable/online form |
| Complaint submission form | ❌ Missing | Only email mentioned, no structured form |
| Refund request UI | ❌ Missing | Permission exists in backend (`CAN_PROCESS_REFUNDS`), no user-facing flow |

### Digital Services — Digitalytelsesloven (2022)

Since Veggat offers digital services (SaaS, digital products), additional rules apply:
- **Conformity requirement** — Digital content must match description and be fit for purpose
- **Update obligation** — Must provide necessary updates for reasonable period
- **Remedy rights** — Consumer can demand repair/replacement before price reduction/termination

### Integration Core: Refund & Complaint Flow

The backend should support:
```
POST /v1/orders/{orderId}/refund-request   → Create refund request
GET  /v1/orders/{orderId}/refund-status    → Check refund status
POST /v1/complaints                        → Submit structured complaint
GET  /v1/complaints/{id}                   → Track complaint status
```

These endpoints would power both the user-facing UI and admin dashboard for processing.

### Key Sources
- [Lovdata — Ehandelsloven](https://lovdata.no/lov/2003-05-23-35)
- [Lovdata — Forbrukerkjøpsloven](https://lovdata.no/lov/2002-06-21-34)
- [Lovdata — Angrerettloven](https://lovdata.no/lov/2014-06-20-27)
- [Lovdata — Markedsføringsloven](https://lovdata.no/lov/2009-01-09-2)
- [Lovdata — Digitalytelsesloven](https://lovdata.no/lov/2022-06-17-56)
- [Forbrukertilsynet — Standard sales terms template](https://www.forbrukertilsynet.no/lov-og-rett/veiledninger-og-retningslinjer/standard-salgsbetingelser-for-forbrukerkjop-av-varer-over-internett)
- [Forbrukertilsynet — Digital service contract terms](https://www.forbrukertilsynet.no/lov-og-rett/veiledninger-og-retningslinjer/forbrukertilsynets-veiledning-om-avtalevilkar-digitale-tjenester)

---

## 6. Accessibility / Universal Design

### Legal Requirement

Norway's **Diskriminerings- og tilgjengelighetsloven** and **Likestillings- og diskrimineringsloven** require public-facing websites to meet accessibility standards. The enforcement body is **UU-tilsynet** (Digdir).

Current standard: **WCAG 2.1 Level AA** (with WCAG 2.2 adoption in progress as of the EU European Accessibility Act 2025 deadline).

### Veggat Compliance Status

| Area | Status | Notes |
|------|--------|-------|
| Semantic HTML | 🔄 Partial | App Router + Radix UI provides good baseline |
| Keyboard navigation | 🔄 Partial | Radix components are keyboard-accessible; custom components may not be |
| Focus management (SPA) | ⚠️ Needs audit | Client-side routing may lose focus on navigation |
| Color contrast | ⚠️ Needs audit | Dark/light themes need contrast verification |
| Screen reader support | ⚠️ Needs audit | ARIA labels on custom components needed |
| Alt text on images | ⚠️ Needs audit | Product images, avatars, uploads |
| Form error messaging | 🔄 Partial | Zod validation exists but may not announce errors to screen readers |
| Accessibility statement | ❌ Missing | Required public page explaining conformance level |
| Skip navigation link | ❌ Missing | `<a href="#main-content">Skip to content</a>` |

### Priority Actions

1. **Create `/accessibility` page** with WCAG conformance statement
2. **Add skip-to-content link** in root layout
3. **Audit color contrast** in both light and dark themes
4. **Add ARIA labels** to all interactive custom components (trade windows, inventory grid, poll sliders)
5. **Test with screen reader** (NVDA on Windows) — especially Pulse feed, chat, and trade flows

### Key Sources
- [UU-tilsynet — Rules and requirements](https://www.uutilsynet.no/regelverk/regelverk-og-krav/746)
- [UU-tilsynet — WCAG standard](https://www.uutilsynet.no/wcag-standarden/wcag-standarden/86)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)

---

## 7. Platform Regulation & DSA

### EU Digital Services Act (DSA) — Norwegian Implementation

Norway is implementing the DSA framework via **Nkom** (Norwegian Communications Authority). As a platform hosting user-generated content (Pulse feed, chat, marketplace listings, video), Veggat must comply with:

### Obligations (Applicable to All Platforms)

| Obligation | Status | Implementation Plan |
|-----------|--------|-------------------|
| **Point of contact** for authorities | ⏳ | Designate email for Nkom/Datatilsynet requests |
| **Terms of service** with content moderation rules | 🔄 Partial | `/terms` exists but no community guidelines |
| **Notice-and-action system** for illegal content | ❌ Missing | Need reporting button + review queue |
| **Statement of reasons** for content removal | ❌ Missing | Need automated notification on takedown |
| **Complaint/appeal mechanism** for moderation decisions | ❌ Missing | Users must be able to appeal removals |
| **Transparency reporting** (annual) | ❌ Missing | Track content reports, removals, appeals |
| **No dark patterns** in user interfaces | ⚠️ Audit needed | Cookie banner, sign-up flows, cancellation |

### Content Moderation Architecture

The platform needs:

```
Frontend:
  - Report button on all UGC (posts, messages, listings, polls)
  - /report/[contentId] — structured report form
  - /dashboard/moderation — admin queue for reviewing reports
  - Appeal UI after content removal

Backend (Integration Core):
  POST /v1/reports          → Submit content report
  GET  /v1/reports          → Admin: list pending reports
  PATCH /v1/reports/{id}    → Admin: resolve (remove/keep + reason)
  POST /v1/appeals          → User: appeal a moderation decision
  GET  /v1/transparency     → Public: annual transparency stats
```

### Community Guidelines Document

Create `/community-guidelines` page covering:
- Prohibited content (illegal, harassment, spam, impersonation, copyright infringement)
- Moderation process (review timeline, actions taken)
- Appeal process
- Consequences (warning → temporary ban → permanent ban)

### Key Sources
- [Nkom — Digital Services Act hub](https://nkom.no/internett/digital-service-act-dsa)
- [Nkom — DSA and you](https://nkom.no/trygt-internett/dsa/dsa-og-deg)

---

## 8. Copyright & User Uploads

### Åndsverkloven (Copyright Act)

As a platform hosting user-uploaded content (images, posts, videos, poll images), Veggat needs:

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **Terms requiring users own/license content** | 🔄 Partial | In terms but not explicit enough |
| **DMCA/takedown procedure** | ❌ Missing | Need notice-and-action flow (same as DSA §16) |
| **Repeat infringer policy** | ❌ Missing | Track users with multiple copyright violations |
| **Content licensing terms** | ❌ Missing | Terms should specify what license platform gets |

### Recommended Terms Addition

Add to `/terms`:
> By uploading content to Veggat, you grant us a non-exclusive, worldwide, royalty-free license to host, display, and distribute the content within the platform. You retain all ownership rights. You represent that you own or have rights to all content you upload.

### EdgeStore & Content Storage

Since we use EdgeStore for file uploads:
- EdgeStore acts as a **data processor** for stored files
- Need DPA with EdgeStore
- Implement file deletion when content is removed (don't orphan files)

### Key Source
- [Lovdata — Åndsverkloven](https://lovdata.no/lov/2018-06-15-40)

---

## 9. Payment Regulation

### Current Architecture — Safe Zone ✅

Veggat currently integrates with **licensed payment service providers** (Vipps planned, crypto wallets). The platform:
- Does **NOT** hold user funds
- Does **NOT** run escrow
- Does **NOT** issue wallet balances or e-money

This keeps us **outside** the scope of:
- Betalingstjenesteloven (payment services regulation)
- E-money institution licensing (Finanstilsynet)

### Critical Rule: Never Hold Funds

If we ever:
- Hold customer money between purchase and payout
- Create internal "wallet balances"
- Run an escrow system for P2P trades

…we would trigger **financial regulation** and need a license from Finanstilsynet. This is extremely expensive and time-consuming for an ENK.

### Crypto P2P Trading — Current Model

Our P2P trading uses wallet-to-wallet transfers:
- Users connect their own wallets (Reown/WalletConnect, Phantom)
- Trades are confirmed via wallet signatures (no platform custody)
- Platform records trade metadata, not actual asset transfers

This is a **classifieds/matching model**, not a regulated exchange — **as long as we don't custody assets**.

### Vipps Integration (Planned)

See [VIPPS_REQUIREMENTS.md](VIPPS_REQUIREMENTS.md) for the detailed Vipps integration checklist. Key requirements beyond technical:
- All prices include MVA
- Clear sales terms (✅ already done)
- Company info visible on site (✅ in footer)
- Withdrawal/refund flow (❌ needs implementation)

### Key Sources
- [Finanstilsynet — E-money institutions](https://www.finanstilsynet.no/tillatelser/e-pengeforetak/)
- [Finanstilsynet — Payment services](https://www.finanstilsynet.no/tillatelser/betalingsforetak/)
- [Vipps Developer Portal](https://developer.vippsmobilepay.com/)

---

## 10. Web3 & Crypto Considerations

### MiCA (Markets in Crypto-Assets Regulation)

The EU MiCA regulation is being adopted across the EEA. Key implications for Veggat:

| Aspect | Risk Level | Notes |
|--------|-----------|-------|
| **Wallet connection** (read-only) | Low | No custody, no regulation triggered |
| **Crypto payments** (ETH, USDC) | Medium | If we accept crypto as payment, may need AML/KYC |
| **P2P trading** (wallet-to-wallet) | Medium | Classifieds model is lower risk; any intermediation increases risk |
| **NFT features** (future) | Medium | Depends on whether NFTs are classified as crypto-assets |
| **On-chain verification tiers** | Low | Reading blockchain data, not transacting |

### Anti-Money Laundering (AML)

If Veggat processes crypto payments:
- May need to register with Finanstilsynet as a virtual asset service provider (VASP)
- May need KYC (Know Your Customer) procedures
- Monitor: Norway's implementation of MiCA and the Transfer of Funds Regulation

### Current Safeguards

- Verification tier system provides identity confidence scoring
- Wallet signatures prove ownership without custody
- No platform-controlled wallets or fund pools
- Trade records create audit trail

### Key Sources
- [Finanstilsynet — Virtual assets](https://www.finanstilsynet.no/tema/virtuelle-valutaer/)
- [EU MiCA Regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1114)

---

## 11. Digital Platform Information (DPI)

### DPI Reporting — Effective 1 January 2026 ⚠️

If Veggat facilitates any of these activities, we must report seller/provider information to Skatteetaten:

| Activity | Applies to Veggat? | Status |
|----------|-------------------|--------|
| Rental of real property | ⏳ Possible (future listings) | Not yet implemented |
| Rental of vehicles/transport | ❌ No | Not in scope |
| Personal services | ⏳ Possible (if freelancers list services) | Not yet implemented |
| Sale of goods | ✅ Yes (marketplace) | Active feature |

### What DPI Requires Us to Report

For each seller exceeding thresholds:
- Name, address, tax identification number
- Financial account identifier
- Total consideration paid
- Platform fees charged
- Number of transactions
- Country of residence

### Implementation Plan

1. **Data model:** Ensure seller/company records include tax ID fields
2. **Transaction logging:** Track all completed sales with amounts
3. **Reporting endpoint:** Build export in Skatteetaten's required XML format
4. **Threshold monitoring:** Automate alerts when sellers approach reporting thresholds

### Key Sources
- [Skatteetaten — DPI overview](https://www.skatteetaten.no/bedrift-og-organisasjon/rapportering-og-bransjer/tredjepartsopplysninger/andre-bransjer/digital-plattforminformasjon-dpi/)
- [Skatteetaten — DPI about the scheme](https://www.skatteetaten.no/bedrift-og-organisasjon/rapportering-og-bransjer/tredjepartsopplysninger/andre-bransjer/digital-plattforminformasjon-dpi/om-ordningen/)
- [Skatteetaten — DPI technical formats](https://www.skatteetaten.no/bedrift-og-organisasjon/rapportering-og-bransjer/tredjepartsopplysninger/andre-bransjer/digital-plattforminformasjon-dpi/formater-og-tekniske-spesifikasjoner/)

---

## 12. Security Standards & Best Practices

### Norwegian & International Standards

| Standard | Purpose | Priority |
|----------|---------|----------|
| **NSM Grunnprinsipper** | Norwegian baseline security principles | High — Norway-specific |
| **OWASP Top 10** | Web application security risks | High — immediate |
| **OWASP ASVS** | Application Security Verification Standard | Medium — for audits |
| **NIST CSF 2.0** | Cybersecurity risk management framework | Medium — structure |
| **ISO 27001** | Information security management | Low — for enterprise/scale |

### Current Security Posture

| Control | Status | Implementation |
|---------|--------|----------------|
| **Authentication** | ✅ Strong | NextAuth v5 with multiple OAuth + email verification |
| **Input validation** | ✅ Strong | Zod schemas on all server actions and backend routes |
| **CORS** | ✅ Configured | Restrictive in production (`CORS_ORIGINS`) |
| **CSRF protection** | ✅ Built-in | NextAuth CSRF tokens |
| **Web3 wallet signing** | ✅ Done | Required for trade acceptance |
| **Environment isolation** | ✅ Done | Separate dev/prod secrets, Reown projects |
| **HTTPS** | ✅ Done | Vercel enforces HTTPS; Railway supports it |
| **Password hashing** | ✅ Done | bcryptjs |
| **Secrets management** | ✅ Done | Env vars, never committed |
| **Rate limiting** | ⚠️ Partial | Verification tier weighting, but no explicit rate limiter |
| **Dependency scanning** | ❌ Missing | No automated vulnerability scanning (Snyk/Dependabot) |
| **Security headers** | ⚠️ Partial | Vercel defaults; should add CSP, X-Frame-Options |
| **Logging & monitoring** | ⚠️ Partial | Console logging; no centralized logging (Sentry, Datadog) |
| **Breach notification** | ❌ Missing | Need incident response plan (72-hour GDPR notification) |
| **Data encryption at rest** | ⚠️ Depends | PostgreSQL provider-level encryption; no column-level |
| **Backup & recovery** | 🔄 Manual | `database-backups/` folder; no automated schedule |

### Priority Security Actions

1. **Add rate limiting middleware** to both frontend API routes and backend endpoints
2. **Enable Dependabot/Snyk** for dependency vulnerability scanning
3. **Add security headers** via `next.config.mjs` (CSP, HSTS, X-Content-Type-Options, X-Frame-Options)
4. **Set up error monitoring** (Sentry or similar) for production
5. **Create incident response plan** for data breaches (72-hour notification per GDPR)
6. **Automate database backups** with point-in-time recovery

### Key Sources
- [NSM — Security principles](https://nsm.no/regelverk-og-hjelp/rad-og-anbefalinger/introduksjon/)
- [OWASP Top 10 (2021)](https://owasp.org/Top10/2021/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [NIST CSF 2.0 (PDF)](https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf)
- [ISO/IEC 27001](https://www.iso.org/standard/27001)

---

## 13. Veggat Compliance Status Matrix

Complete overview of where we stand across all regulatory areas:

| # | Area | Overall Status | Critical Gaps |
|---|------|---------------|---------------|
| 1 | Business/Tax | ✅ Registered | MVA registration when threshold hit |
| 2 | GDPR/Privacy | ❌ **Major gaps** | Privacy policy incomplete, no data export/deletion, no DPIA |
| 3 | Cookies | 🔄 Mostly done | Missing detailed cookie list & 3rd-party disclosure |
| 4 | Consumer protection | 🔄 Good | Missing withdrawal form, complaint form, refund UI |
| 5 | Accessibility | ⚠️ **Needs audit** | No accessibility statement, no WCAG audit done |
| 6 | DSA/Moderation | ❌ **Not started** | No reporting system, no community guidelines |
| 7 | Copyright | ⚠️ Partial | Need explicit takedown procedure, licensing terms |
| 8 | Payments | ✅ Safe (for now) | Don't hold funds — maintain this boundary |
| 9 | Web3/Crypto | ⚠️ Monitor | MiCA adoption may require VASP registration |
| 10 | DPI Reporting | ⏳ Plan needed | Effective Jan 2026 — need data model + reporting |
| 11 | Security | 🔄 Good baseline | Rate limiting, dependency scanning, security headers |

### Top 5 Compliance Priorities

1. **Rewrite `/privacy` page** with full GDPR Art. 13/14 content
2. **Build content reporting system** (DSA notice-and-action)
3. **WCAG accessibility audit** + create `/accessibility` statement
4. **Add data export & deletion** endpoints for data subject rights
5. **Prepare DPI reporting** data model before January 2026 deadline

---

## 14. Implementation Roadmap

### Phase 1: Critical Legal Pages (Q1 2026)
- [ ] Rewrite `/privacy` with full GDPR content
- [ ] Create `/accessibility` statement page
- [ ] Create `/community-guidelines` page
- [ ] Add content licensing paragraph to `/terms`
- [ ] Create downloadable Angrerettskjema (withdrawal form)

### Phase 2: User Rights & Moderation (Q1-Q2 2026)
- [ ] Build data export API (`GET /v1/users/{id}/data-export`)
- [ ] Build account deletion flow (right to erasure)
- [ ] Build content report button + admin moderation queue
- [ ] Build complaint submission form
- [ ] Build refund request UI (use existing `CAN_PROCESS_REFUNDS` permission)

### Phase 3: Security Hardening (Q2 2026)
- [ ] Add rate limiting (middleware for API routes + backend)
- [ ] Add security headers (CSP via `next.config.mjs`)
- [ ] Set up Sentry for error monitoring
- [ ] Enable Dependabot for dependency scanning
- [ ] Create incident response plan document
- [ ] Automate database backups

### Phase 4: Reporting & Compliance Automation (Q3-Q4 2026)
- [ ] DPI reporting data model + XML export
- [ ] Annual DSA transparency report generation
- [ ] Cookie audit + detailed cookie policy page
- [ ] DPIA for high-risk processing activities
- [ ] DPA templates for B2B SaaS clients

---

## 15. Lessons Learned & Solutions Log

> This section is a living log. Update it whenever a compliance issue is discovered and resolved. Future developers and AI assistants should read this to avoid repeating mistakes.

### Template

```markdown
#### [Date] — Title
**Problem:** What went wrong or what was discovered
**Root Cause:** Why it happened
**Solution:** What we did to fix it
**Prevention:** How to avoid this in the future
```

---

#### [Feb 2026] — Privacy page was intentionally vague
**Problem:** The `/privacy` page was deliberately high-level ("we won't list infrastructure details for security") which doesn't meet GDPR Art. 13/14 requirements.  
**Root Cause:** Early development prioritized security-by-obscurity over legal compliance.  
**Solution:** Planned full rewrite of `/privacy` with all required GDPR disclosures while keeping security-sensitive infrastructure details generic (e.g., "EU-based cloud hosting" rather than specific provider names).  
**Prevention:** Check new legal pages against the compliance matrix in this document before shipping.

#### [Feb 2026] — Contact page redirects instead of existing
**Problem:** `/contact` redirects to `/info` — no standalone contact page.  
**Root Cause:** Contact info was consolidated into the info page during early development.  
**Solution:** Acceptable if `/info` contains all required contact information (org name, org.nr, address, phone, email). Verify this is the case.  
**Prevention:** Before removing or redirecting any legal page, check VIPPS_REQUIREMENTS.md and this document for required pages.

#### [Feb 2026] — Cookie consent banner built before Ekomloven update
**Problem:** Cookie banner was built before Ekomloven §3-15 took effect (1 Jan 2025).  
**Root Cause:** Banner was designed based on general GDPR principles, not Norway-specific requirements.  
**Solution:** Banner already meets the stricter requirements (granular consent, no cookie wall, easy withdrawal). Verified compliant.  
**Prevention:** When Norway-specific regulations update, check this document's "Key Sources" links for changes.

---

## 16. Authoritative Sources

### Norwegian Government & Agencies

| Agency | Area | URL |
|--------|------|-----|
| **Brønnøysund** | Business registration | [brreg.no](https://www.brreg.no/) |
| **Skatteetaten** | Tax, MVA, DPI reporting | [skatteetaten.no](https://www.skatteetaten.no/) |
| **Datatilsynet** | Privacy / GDPR enforcement | [datatilsynet.no](https://www.datatilsynet.no/) |
| **Forbrukertilsynet** | Consumer protection | [forbrukertilsynet.no](https://www.forbrukertilsynet.no/) |
| **Nkom** | DSA / platform regulation | [nkom.no](https://nkom.no/) |
| **Finanstilsynet** | Financial regulation, payments | [finanstilsynet.no](https://www.finanstilsynet.no/) |
| **UU-tilsynet (Digdir)** | Accessibility / WCAG | [uutilsynet.no](https://www.uutilsynet.no/) |
| **NSM** | Cybersecurity standards | [nsm.no](https://nsm.no/) |
| **Altinn** | Reporting portal | [altinn.no](https://www.altinn.no/) |

### Key Norwegian Laws (Lovdata)

| Law | English Name | URL |
|-----|-------------|-----|
| Personopplysningsloven | Personal Data Act (GDPR) | [lovdata.no/lov/2018-06-15-38](https://lovdata.no/lov/2018-06-15-38) |
| Ekomloven | Electronic Communications Act | [lovdata.no/lov/2024-12-13-76](https://lovdata.no/lov/2024-12-13-76) |
| Markedsføringsloven | Marketing Act | [lovdata.no/lov/2009-01-09-2](https://lovdata.no/lov/2009-01-09-2) |
| Angrerettloven | Right of Withdrawal Act | [lovdata.no/lov/2014-06-20-27](https://lovdata.no/lov/2014-06-20-27) |
| Forbrukerkjøpsloven | Consumer Purchases Act | [lovdata.no/lov/2002-06-21-34](https://lovdata.no/lov/2002-06-21-34) |
| Digitalytelsesloven | Digital Services (Consumer) Act | [lovdata.no/lov/2022-06-17-56](https://lovdata.no/lov/2022-06-17-56) |
| Ehandelsloven | E-Commerce Act | [lovdata.no/lov/2003-05-23-35](https://lovdata.no/lov/2003-05-23-35) |
| Bokføringsloven | Bookkeeping Act | [lovdata.no/lov/2004-11-19-73](https://lovdata.no/lov/2004-11-19-73) |
| Åndsverkloven | Copyright Act | [lovdata.no/lov/2018-06-15-40](https://lovdata.no/lov/2018-06-15-40) |
| Eiendomsmeglingsloven | Real Estate Brokerage Act | [lovdata.no/lov/2007-06-29-73](https://lovdata.no/lov/2007-06-29-73) |

### International Standards

| Standard | URL |
|----------|-----|
| OWASP Top 10 (2021) | [owasp.org/Top10/2021/](https://owasp.org/Top10/2021/) |
| OWASP ASVS | [owasp.org/www-project-application-security-verification-standard/](https://owasp.org/www-project-application-security-verification-standard/) |
| NIST CSF 2.0 | [nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf](https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf) |
| WCAG 2.1 | [w3.org/TR/WCAG21/](https://www.w3.org/TR/WCAG21/) |
| EU MiCA Regulation | [eur-lex.europa.eu](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1114) |
| EU DSA Regulation | [eur-lex.europa.eu](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2065) |

---

*This document should be reviewed quarterly and updated whenever new features are shipped, regulations change, or compliance gaps are identified.*
