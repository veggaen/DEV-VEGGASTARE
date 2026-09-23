/**
 * @fileOverview Integration boundary regressions; no database or provider calls.
 * @stability stable
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Hapi = require('@hapi/hapi');
const WebSocket = require('ws');

process.env.BRING_MODE = 'mock';
// Fake credentials prove retirement is unconditional, without external calls.
process.env.DATABASE_URL_MAINLIVE = 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.PUSHER_APP_ID = 'unused';
process.env.PUSHER_KEY = 'unused';
process.env.PUSHER_SECRET = 'unused';
process.env.PUSHER_CLUSTER = 'eu';
const registerRoutes = require('../dist/routes').default;
const { initWebSocketServer } = require('../dist/websocket');
const { updateWarehouseInventory } = require('../dist/updateWarehouseInventory');

for (const path of ['/api/update', '/api/pusher-trigger']) {
  test(`${path} is retired with or without credential-looking headers`, async (t) => {
    const server = Hapi.server();
    registerRoutes(server);
    t.after(() => server.stop());
    for (const headers of [{}, { authorization: 'Bearer forged', origin: 'https://www.veggat.com' }]) {
      const response = await server.inject({ method: 'POST', url: path, headers,
        payload: { warehouseId: 'not-a-record', inventoryId: 'not-a-record', stock: 10,
          channel: 'private-any-channel', event: 'UPDATE_WAREHOUSES', data: {} } });
      assert.equal(response.statusCode, 410);
      assert.equal(response.result.code, 'LEGACY_ENDPOINT_RETIRED');
      assert.equal(response.headers['cache-control'], 'no-store');
    }
  });
}

test('health and public mock shipping still work', async (t) => {
  const server = Hapi.server();
  registerRoutes(server);
  t.after(() => server.stop());
  assert.equal((await server.inject('/v1/health')).statusCode, 200);
  const rates = await server.inject({ method: 'POST', url: '/v1/shipping/rates', payload: {
    fromCountryCode: 'NO', toCountryCode: 'NO', fromPostalCode: '0150', toPostalCode: '5003',
    packages: [{ grossWeight: 500 }],
  } });
  assert.equal(rates.statusCode, 200);
  assert.equal(rates.result.provider, 'mock');
  assert.equal(rates.result.options.length, 2);
  assert.ok(rates.result.options.every((option) => option.price.currency === 'NOK'));
  assert.equal((await server.inject({ method: 'POST', url: '/v1/shipping/rates', payload: {} })).statusCode, 400);
});

test('retired inventory helper cannot write or broadcast', async () => {
  assert.equal((await updateWarehouseInventory('not-a-record', 'not-a-record', 10)).status, 410);
  const loaded = Object.keys(require.cache).filter((file) => /[/\\]dist[/\\](db|pusher)\.js$/.test(file));
  assert.deepEqual(loaded, [], 'no DB/Pusher module is initialized');
});

test('legacy socket rejects polling and websocket handshakes', async (t) => {
  const server = http.createServer();
  const io = initWebSocketServer(server);
  t.after(() => new Promise((resolve) => io.close(resolve)));
  let connected = false;
  io.on('connection', () => { connected = true; });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `127.0.0.1:${server.address().port}`;
  for (const headers of [{}, { Origin: 'https://www.veggat.com', Authorization: 'Bearer forged' }]) {
    const polling = await fetch(`http://${base}/socket.io/?EIO=4&transport=polling`, { headers });
    assert.equal(polling.status, 403);
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${base}/socket.io/?EIO=4&transport=websocket`, { headers, handshakeTimeout: 3000 });
      socket.on('open', () => { socket.close(); reject(new Error('Unauthenticated socket accepted')); });
      socket.on('unexpected-response', (_request, response) => {
        // Engine.IO sends 400 for rejected upgrades (403 for polling). Assert
        // our denial message too, so a malformed test handshake cannot pass.
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          try {
            assert.equal(response.statusCode, 400);
            assert.equal(body, 'Legacy realtime is unavailable.');
            socket.terminate(); resolve();
          } catch (error) { socket.terminate(); reject(error); }
        });
      });
      socket.on('error', (error) => { if (!String(error.message).includes('closed before')) reject(error); });
    });
  }
  assert.equal(connected, false);
});
