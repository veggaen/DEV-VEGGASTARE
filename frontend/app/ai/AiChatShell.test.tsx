// @vitest-environment jsdom
/** @fileOverview Rename cancellation and failure retain the user's intent and draft. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock('next/navigation', () => ({ usePathname: () => '/ai', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/providers/ui-preferences', () => ({ useUiPreferences: () => ({ prefs: {} }) }));
vi.mock('@/components/providers/confirm-dialog', () => ({ useConfirm: () => vi.fn() }));
import { RailRow } from './AiChatShell';
let host: HTMLDivElement, root: Root;
const rename = vi.fn(), remove = vi.fn();
beforeEach(async () => {
  vi.clearAllMocks(); rename.mockResolvedValue(true);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<RailRow session={{ id: 'qa', title: 'Original', updatedAt: '2026-09-24T00:00:00Z' }} active={false} onRename={rename} onRemove={remove} readOnly={false} />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async (name: string) => { await act(async () => (host.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement).click()); };
async function draft(value: string) {
  await click('Rename Original');
  const input = host.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  return input;
}
it('Cancel does not save through blur', async () => { const input = await draft('Do not save'); await act(async () => input.blur()); await click('Cancel renaming'); expect(rename).not.toHaveBeenCalled(); expect(host.querySelector('a')?.textContent).toBe('Original'); });
it('Escape cancels and keeps the original name', async () => { const input = await draft('Do not save'); await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); expect(rename).not.toHaveBeenCalled(); expect(host.querySelector('input')).toBeNull(); });
it('Save submits the trimmed title exactly once', async () => { await draft('  New name  '); await click('Save conversation name'); expect(rename).toHaveBeenCalledExactlyOnceWith('qa', 'New name'); expect(host.querySelector('input')).toBeNull(); });
it('a failed save retains the edit and draft for retry', async () => { rename.mockResolvedValue(false); await draft('Retry me'); await click('Save conversation name'); expect(host.querySelector('input')?.value).toBe('Retry me'); expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Conversation title'); });
it('empty titles cannot be submitted', async () => { await draft('  '); const button = host.querySelector('[aria-label="Save conversation name"]') as HTMLButtonElement; expect(button.disabled).toBe(true); await click('Save conversation name'); expect(rename).not.toHaveBeenCalled(); });
it('demo rows expose no rename or deletion controls', async () => { await act(async () => root.render(<RailRow session={{ id: 'qa', title: 'Original', updatedAt: '2026-09-24T00:00:00Z' }} active={true} onRename={rename} onRemove={remove} readOnly />)); expect(host.querySelectorAll('button')).toHaveLength(0); expect(host.querySelector('a')?.getAttribute('aria-current')).toBe('page'); });
