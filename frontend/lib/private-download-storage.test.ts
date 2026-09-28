/** @fileOverview Storage credentials must never follow arbitrary URLs or redirects. @stability stable */
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { privateStorageUrl } from './private-download-storage';
describe('private storage origin', () => {
  it.each(['http://files.edgestore.dev/file', 'https://evil.example/file', 'https://files.edgestore.dev.evil.example/file',
    'https://user:pass@files.edgestore.dev/file', 'https://files.edgestore.dev:444/file', 'https://files.edgestore.dev/file?token=secret'])('rejects %s', url => {
    expect(() => privateStorageUrl(url)).toThrow();
  });
  it('accepts the private provider origin', () => { expect(privateStorageUrl('https://files.edgestore.dev/project/digitalAssets/file.jpg')).toBe('https://files.edgestore.dev/project/digitalAssets/file.jpg'); });
});
