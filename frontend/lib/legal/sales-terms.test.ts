/** @fileOverview Full terms, public copies and version boundaries agree without fabricating historical consent. @stability stable */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/legal/terms/route';
import { SALES_TERMS_SECTIONS, SALES_TERMS_TEXT, WITHDRAWAL_FORM } from './sales-terms';
import { SALES_TERMS_DOWNLOAD, SALES_TERMS_VERSION } from './sales-terms-version';

describe('one published terms source', () => {
  it('keeps the reviewed nine-section, 34-block published source intact', () => {
    expect(SALES_TERMS_SECTIONS).toHaveLength(9);
    expect(SALES_TERMS_SECTIONS.reduce((count, section) => count + section.blocks.length, 0)).toBe(34);
    // Reviewed v2026-09-25.2: payment currency and supported media descriptions
    // updated; withdrawal, defect, dispute and refund rights are unchanged.
    expect(createHash('sha256').update(JSON.stringify(SALES_TERMS_SECTIONS)).digest('hex')).toBe('bf57ca8e275f765be738452c12206daffc872f7a99c4d0b3f65d1977afd2fdfd');
    for (const section of SALES_TERMS_SECTIONS) {
      expect(SALES_TERMS_TEXT).toContain(section.title);
      for (const block of section.blocks) expect(SALES_TERMS_TEXT).toContain(block.text);
    }
    expect(SALES_TERMS_TEXT).toContain(WITHDRAWAL_FORM);
  });
  it('describes confirmed fiat, historical currency and supported media consistently', () => {
    expect(SALES_TERMS_VERSION).toBe('2026-09-25.2');
    expect(SALES_TERMS_TEXT).toContain('beløp og betalingsvaluta i kassen');
    expect(SALES_TERMS_TEXT).toContain('Tidligere ordre beholder opprinnelig beløp og betalingsvaluta');
    expect(SALES_TERMS_TEXT).toContain('bildegenereringer og korte videogenereringer');
    expect(SALES_TERMS_TEXT).toContain('forespørselens reserverte kreditter');
  });
  it('includes the optional withdrawal form information and does not claim submission', () => {
    for (const field of ['THORSEN SOFTWARE', 'Blåskjellveien 5B', 'kontakt@veggat.com', 'Beskrivelse av kjøpet',
      'dato da avtalen ble inngått', 'dato da varen ble mottatt', 'Navn på forbrukeren', 'Adresse til forbrukeren', 'Dato for meldingen', 'Underskrift ved innsending på papir']) expect(WITHDRAWAL_FORM).toContain(field);
    expect(WITHDRAWAL_FORM).toContain('sender ingen melding');
    expect(SALES_TERMS_TEXT).toContain('Nedlasting alene fjerner ikke angreretten');
  });
  it('returns the exact complete public copy, with an attachment filename and no-sniff', async () => {
    const response = GET(new Request(`https://www.veggat.com${SALES_TERMS_DOWNLOAD}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="veggat-sales-terms-${SALES_TERMS_VERSION}.txt"`);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('content-language')).toBe('nb');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toContain('must-revalidate');
    expect(await response.text()).toBe(SALES_TERMS_TEXT);
  });
  it.each(['', '?version=old', '?version=../private', `?version=${SALES_TERMS_VERSION}&version=old`, `?version=${SALES_TERMS_VERSION}&file=private`])('does not silently substitute current terms for an invalid version %s', async query => {
    const response = GET(new Request(`https://www.veggat.com/api/legal/terms${query}`));
    expect(response.status).toBe(409); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain(SALES_TERMS_TEXT);
  });
});
