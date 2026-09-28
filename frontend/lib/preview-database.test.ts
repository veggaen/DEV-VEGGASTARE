import { describe, expect, it } from 'vitest';
import { previewDatabaseUrl } from './preview-database';

const live = 'postgresql://owner:fake@ep-live-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
const preview = 'postgresql://owner:fake@ep-test-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
describe('isolated Preview database selection', () => {
  it('selects the explicit Preview endpoint', () => expect(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: preview, DATABASE_URL_MAINLIVE: live })).toBe(preview));
  it('allows an isolated Development fallback', () => expect(previewDatabaseUrl({ DATABASE_URL_MAINDEV: preview, DATABASE_URL_MAINLIVE: live })).toBe(preview));
  it('never falls back to the generic or live URL', () => expect(() => previewDatabaseUrl({ DATABASE_URL: live, DATABASE_URL_MAINLIVE: live })).toThrow('production fallback is forbidden'));
  it('rejects a blank Preview setting', () => expect(() => previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: ' ' })).toThrow('Preview requires'));
  it('rejects a live URL accidentally copied into Preview', () => expect(() => previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: live, DATABASE_URL_MAINLIVE: live })).toThrow('separate endpoint'));
  it('recognizes the same Neon endpoint in direct and pooled form', () => expect(() => previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: live.replace('-pooler.', '.'), DATABASE_URL_MAINLIVE: live })).toThrow('separate endpoint'));
  it('does not reveal invalid connection values', () => {
    expect(() => previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: 'bad-secret-value' })).toThrow('values are redacted');
    expect(() => previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: 'https://invalid.example' })).toThrow('Invalid database');
  });
});
