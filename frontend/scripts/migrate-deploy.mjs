/** @fileOverview Retry transient migration failures but never deploy an unmigrated build. @stability stable */
import { spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (let attempt = 1; attempt <= 3; attempt++) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit', timeout: 120_000 });
  if (result.status === 0) process.exit(0);
  if (attempt < 3) {
    console.warn(`Migration attempt ${attempt} failed; retrying in six seconds.`);
    await setTimeout(6_000);
  }
}
console.error('Migration failed. Deployment stopped before build.');
process.exit(1);
