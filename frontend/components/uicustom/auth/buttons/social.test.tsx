// @vitest-environment jsdom
/** @fileOverview Provider buttons reflect runtime configuration without blocking email login. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MySocialAuth } from './social';
import { DEFAULT_LOGIN_REDIRECT } from '@/routes';

const auth = vi.hoisted(() => ({ getProviders: vi.fn(), signIn: vi.fn() }));
vi.mock('next-auth/react', () => auth);
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/hooks/use-client-ready', () => ({ useClientReady: () => true }));

let container: HTMLDivElement;
let root: Root;
const buttons = () => [...container.querySelectorAll('button')];
const button = (label: string) => buttons().find(item => item.textContent?.includes(label));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('configured social sign-in', () => {
  it('shows only configured OAuth providers, not credentials or unavailable Discord', async () => {
    auth.getProviders.mockResolvedValue({ google: { id: 'google' }, github: { id: 'github' }, credentials: { id: 'credentials' } });
    await act(async () => root.render(<MySocialAuth />));
    expect(buttons().map(item => item.textContent)).toEqual(['Google', 'GitHub']);
    expect(button('Google')?.disabled).toBe(false);
    await act(async () => button('GitHub')!.click());
    expect(auth.signIn).toHaveBeenCalledWith('github', { callbackUrl: DEFAULT_LOGIN_REDIRECT });
  });
  it('does not submit before configuration has loaded', async () => {
    auth.getProviders.mockReturnValue(new Promise(() => {}));
    await act(async () => root.render(<MySocialAuth />));
    expect(buttons().every(item => item.disabled)).toBe(true);
    expect(auth.signIn).not.toHaveBeenCalled();
  });
  it('preserves the account menu destination', async () => {
    auth.getProviders.mockResolvedValue({ google: { id: 'google' } });
    await act(async () => root.render(<MySocialAuth redirectTo="/products" />));
    await act(async () => button('Google')!.click());
    expect(auth.signIn).toHaveBeenCalledWith('google', { callbackUrl: '/products' });
  });
  it('offers retry after a failed discovery request', async () => {
    auth.getProviders.mockResolvedValueOnce(null).mockResolvedValueOnce({ discord: { id: 'discord' } });
    await act(async () => root.render(<MySocialAuth />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Social sign-in is unavailable');
    await act(async () => button('Retry')!.click());
    expect(buttons().map(item => item.textContent)).toEqual(['Discord']);
    expect(button('Discord')?.disabled).toBe(false);
  });
  it('handles rejected discovery and an empty configured list', async () => {
    auth.getProviders.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ credentials: { id: 'credentials' } });
    await act(async () => root.render(<MySocialAuth />));
    expect(button('Retry')).toBeDefined();
    await act(async () => button('Retry')!.click());
    expect(buttons()).toHaveLength(0);
  });
});
