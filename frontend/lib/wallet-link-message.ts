/** @fileOverview Account- and origin-bound wallet ownership messages. @stability evolving */
import { getAddress } from 'viem';
import { createSiweMessage } from 'viem/siwe';

export const WALLET_LINK_TTL = 10 * 60 * 1000;
export function walletLinkMessage(input: {
  origin: string; userId: string; address: string; chainId: number;
  nonce: string; createdAt: Date; expires: Date; twoFactor: boolean;
}) {
  const origin = new URL(input.origin);
  return createSiweMessage({
    domain: origin.host, scheme: origin.protocol.slice(0, -1),
    address: getAddress(input.address), chainId: input.chainId, version: '1',
    uri: `${origin.origin}/settings`, nonce: input.nonce,
    issuedAt: input.createdAt, expirationTime: input.expires, requestId: input.userId,
    statement: 'Link this wallet to your Veggat account. No transaction or gas fee. If no receiving wallet is set, this becomes your receiving wallet.',
    resources: [`urn:veggat:wallet-link:two-factor:${input.twoFactor ? 'required' : 'off'}`],
  });
}
