/** @fileOverview Run both unit-test runners on Windows and CI without shell-specific operators. @stability stable */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const frontend = fileURLToPath(new URL('..', import.meta.url));
const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: frontend, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

run([vitest, 'run', '--exclude', '**/e2e/**', ...process.argv.slice(2)]);
const scriptTests = readdirSync(path.join(frontend, 'scripts'))
  .filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join('scripts', name));
if (scriptTests.length) run(['--test', ...scriptTests]);
