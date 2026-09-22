/** @fileOverview Stable reviewer SKUs; integer NOK øre prices are authoritative at checkout. @stability stable */
export const SHOWCASE_COMPANY_ID = 'cveggatshowcasestudio00001';
export const SHOWCASE_PRODUCTS = {
  interviewPack: {
    id: 'cveggatinterviewpack000001',
    title: 'Veggat Interview Pack',
    amountOre: 2900,
    currency: 'NOK',
    kind: 'DIGITAL_FILES',
  },
  credits: {
    id: 'cveggatinterviewcredits01',
    title: 'Interviewer AI Credits',
    amountOre: 3900,
    currency: 'NOK',
    kind: 'AI_CREDITS',
    credits: 100,
  },
} as const;

export function isShowcaseProduct(id: string): boolean {
  return Object.values(SHOWCASE_PRODUCTS).some(product => product.id === id);
}
