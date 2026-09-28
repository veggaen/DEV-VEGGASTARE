/** @fileOverview Prove upload-before-save ordering and retry idempotence without external files. @stability stable */
import { expect, it, vi } from 'vitest';
import { saveProfileImage } from './profile-image-save';
it('uploads once, remembers the file, then persists the profile', async () => {
  const events: string[] = [];
  const result = await saveProfileImage({ upload: async () => { events.push('upload'); return { url: 'qa-image' }; }, remember: () => { events.push('remember'); }, persist: async () => { events.push('persist'); } });
  expect(result).toBe('qa-image'); expect(events).toEqual(['upload', 'remember', 'persist']);
});
it('retries a failed or uncertain profile save without uploading another file', async () => {
  let uploadedUrl: string | undefined;
  const upload = vi.fn(async () => ({ url: 'qa-image' })), remember = vi.fn((url: string) => { uploadedUrl = url; });
  const persist = vi.fn().mockRejectedValueOnce(new Error('Controlled save failure')).mockResolvedValue(undefined);
  await expect(saveProfileImage({ upload, remember, persist })).rejects.toThrow('Controlled save failure');
  await expect(saveProfileImage({ uploadedUrl, upload, remember, persist })).resolves.toBe('qa-image');
  expect(upload).toHaveBeenCalledTimes(1); expect(remember).toHaveBeenCalledTimes(1); expect(persist.mock.calls).toEqual([['qa-image'], ['qa-image']]);
});
it('never persists when storage failed or returned no file', async () => {
  const persist = vi.fn(), remember = vi.fn();
  await expect(saveProfileImage({ upload: async () => { throw new Error('Storage unavailable'); }, remember, persist })).rejects.toThrow('Storage unavailable');
  await expect(saveProfileImage({ upload: async () => ({ url: '' }), remember, persist })).rejects.toThrow('did not return');
  expect(persist).not.toHaveBeenCalled(); expect(remember).not.toHaveBeenCalled();
});
