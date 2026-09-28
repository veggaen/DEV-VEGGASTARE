/** @fileOverview Permanent Veggat Studio SKUs; legacy IDs preserve orders and integer NOK prices remain server-authoritative. @stability stable */
export const SHOWCASE_COMPANY_ID = 'cveggatshowcasestudio00001';
export const SHOWCASE_PRODUCTS = {
  interviewPack: {
    id: 'cveggatinterviewpack000001',
    title: 'Fjord Study — Digital Artwork',
    amountOre: 2900,
    currency: 'NOK',
    kind: 'DIGITAL_FILES',
  },
  credits: {
    id: 'cveggatinterviewcredits01',
    title: 'Veggat AI Credits',
    amountOre: 3900,
    currency: 'NOK',
    kind: 'AI_CREDITS',
    credits: 100,
  },
} as const;

export function isShowcaseProduct(id: string): boolean {
  return Object.values(SHOWCASE_PRODUCTS).some(product => product.id === id);
}
