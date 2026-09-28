'use server';
// Retained for already-open old tabs. Legacy bearer links never change settings.
export async function MyRequestWeb3ModeSecurityAction() {
  return { error: 'Open Settings → Web3 & Wallet to review and confirm this change.' };
}
export async function MyConfirmSecurityAction() {
  return { error: 'This link cannot change your settings. Open Settings → Web3 & Wallet.' };
}
