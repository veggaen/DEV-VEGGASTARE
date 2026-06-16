/**
 * Whether Web3 / wallet connect is configured for this deployment.
 *
 * AppKit (Reown) only initializes its modal when a project ID exists. Without
 * one, `ModalController.open()` is a no-op and the "Connect with Web3" button
 * silently does nothing. UI should check this and disable/relabel the button
 * instead of presenting a dead control.
 *
 * To enable: set NEXT_PUBLIC_APPKIT_PROJECT_ID (free from https://cloud.reown.com)
 * in the Vercel environment.
 */
export const WEB3_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPKIT_PROJECT_ID ??
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID ??
  "";

export const IS_WEB3_CONFIGURED = WEB3_PROJECT_ID.length > 0;
