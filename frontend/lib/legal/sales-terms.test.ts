/** @fileOverview Full terms, public copies and version boundaries agree without fabricating historical consent. @stability stable */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/legal/terms/route';
import { SALES_TERMS_SECTIONS, SALES_TERMS_TEXT, WITHDRAWAL_FORM } from './sales-terms';
import { SALES_TERMS_DOWNLOAD, SALES_TERMS_VERSION } from './sales-terms-version';

describe('one published terms source', () => {
  it('preserves all nine sections and 34 blocks from the prior published page', () => {
    expect(SALES_TERMS_SECTIONS).toHaveLength(9);
    expect(SALES_TERMS_SECTIONS.reduce((count, section) => count + section.blocks.length, 0)).toBe(34);
    // Fingerprint of mechanically extracted prior page text, whitespace normalized.
    // Any future legal wording change needs an intentional version/fixture update.
    expect(createHash('sha256').update(JSON.stringify(SALES_TERMS_SECTIONS)).digest('hex')).toBe('c6d5d72f690e5b1f60be47e62b64d792004e9234fcba2763246749b739dbd51a');
    for (const section of SALES_TERMS_SECTIONS) {
      expect(SALES_TERMS_TEXT).toContain(section.title);
      for (const block of section.blocks) expect(SALES_TERMS_TEXT).toContain(block.text);
    }
    expect(SALES_TERMS_TEXT).toContain(WITHDRAWAL_FORM);
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
