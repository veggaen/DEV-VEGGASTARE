# Vipps Integration Requirements Checklist

Based on [vippsmobilepay.com/nb-NO/legal/krav-til-nettside](https://vippsmobilepay.com/nb-NO/legal/krav-til-nettside)

## ✅ Website Content Requirements

### 1. Sales Terms (Salgsvilkår)
Your sales terms must include sections covering:

- [ ] **Parties** (Parter) - Who is seller, who is buyer
- [ ] **Payment** (Betaling) - Payment methods, when payment is due
- [ ] **Delivery** (Levering) - Delivery times, shipping methods
- [ ] **Right of Withdrawal** (Angrerett) - 14-day cooling-off period per Norwegian law
- [ ] **Returns** (Retur) - How to return products
- [ ] **Complaints Handling** (Reklamasjonshåndtering) - How to file complaints
- [ ] **Conflict Resolution** (Konfliktløsning) - How disputes are resolved

### 2. Company Information (Firma- og kontaktinformasjon)
Must be clearly visible on the website (e.g., footer or "Contact" page):

- [ ] **Organization Name** - Legal company name
- [ ] **Organization Number** (Org.nr.) - Norwegian organization number
- [ ] **Address** - Physical business address
- [ ] **Phone Number** - Contact phone
- [ ] **Email Address** - Contact email

### 3. Product Information
Since Vipps serves consumers, you must follow [Forbrukerrådets veiledning](https://www.forbrukertilsynet.no/lov-og-rett/veiledninger-og-retningslinjer/standard-salgsbetingelser-for-forbrukerkjop-av-varer-over-internett):

- [ ] **Product/Service descriptions** - Clear info about what you're selling
- [ ] **Prices** - Must be clearly displayed (including any fees)

## 🔧 Implementation Tasks for VeggaStare

### Legal Pages to Verify / Upgrade:
1. [ ] Verify `/terms` contains all required sales-term sections (parties, payment, delivery, withdrawal, returns, complaints, conflict resolution)
2. [ ] Verify `/privacy` legal adequacy for GDPR + Norway consumer context
3. [ ] Verify `/contact` routing/content includes required company information
4. [ ] Add/verify footer company details: legal name, org number, address, phone, email

### Features to Implement:
1. [ ] Order confirmation emails
2. [ ] Cancellation/refund workflow
3. [ ] Complaint submission system
4. [ ] Clear price display including all fees

## 📝 Norwegian Consumer Law Highlights

### Angrerett (Right of Withdrawal)
- Consumer has 14 days to cancel purchase
- Must inform consumer about this right BEFORE purchase
- Refund within 14 days of receiving returned goods
- Consumer pays return shipping unless seller offers free returns

### Reklamasjon (Complaints)
- 2-year complaint period for most goods
- 5-year period for items meant to last significantly longer
- Consumer can demand repair, replacement, price reduction, or refund

### Price Display
- All prices must include VAT (MVA)
- Any additional fees must be clearly stated upfront
- Total price must be shown before checkout

## 🔗 Useful Resources

- [Standard salgsbetingelser (Forbrukertilsynet)](https://www.forbrukertilsynet.no/lov-og-rett/veiledninger-og-retningslinjer/standard-salgsbetingelser-for-forbrukerkjop-av-varer-over-internett)
- [Angrerettloven](https://lovdata.no/dokument/NL/lov/2014-06-20-27)
- [Forbrukerkjøpsloven](https://lovdata.no/dokument/NL/lov/2002-06-21-34)
- [Vipps API Documentation](https://developer.vippsmobilepay.com/)

## 📊 Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| Sales Terms page | 🔄 | Exists, needs legal completeness verification |
| Company info in footer | ⏳ | Add/verify legal company metadata |
| Product prices displayed | ✅ | With currency conversion |
| Privacy policy | 🔄 | Exists, needs legal review |
| Contact page | 🔄 | Exists/routed, verify required company info |

---

*Note: This is not legal advice. Consult with a lawyer familiar with Norwegian e-commerce law before launching.*
