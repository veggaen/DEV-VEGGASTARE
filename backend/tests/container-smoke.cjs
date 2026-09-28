/**
 * @fileOverview Secret-free smoke check for an isolated local mock container.
 * @stability stable
 * Usage: node tests/container-smoke.cjs <HTTP port> <retired socket port>
 */
const assert = require('node:assert/strict');

async function main() {
  const ports = process.argv.slice(2).map(Number);
  assert.equal(ports.length, 2, 'Pass the two published loopback ports');
  assert.ok(ports.every((port) => Number.isInteger(port) && port > 0 && port < 65536));
  const base = `http://127.0.0.1:${ports[0]}`;
  const request = (url, options = {}) => fetch(url, {
    ...options, signal: AbortSignal.timeout(5000),
  });
  const health = await request(`${base}/v1/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  const rates = await request(`${base}/v1/shipping/rates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromCountryCode: 'NO', toCountryCode: 'NO',
      fromPostalCode: '0150', toPostalCode: '5003', packages: [{ grossWeight: 500 }] }),
  });
  assert.equal(rates.status, 200);
  assert.equal((await rates.json()).provider, 'mock');
  for (const path of ['/api/update', '/api/pusher-trigger']) {
    const response = await request(`${base}${path}`, { method: 'POST' });
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const socket = await request(`http://127.0.0.1:${ports[1]}/socket.io/?EIO=4&transport=polling`);
  assert.equal(socket.status, 403);
  console.log('PASS: container health, mock shipping, retired writes, socket refusal');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
