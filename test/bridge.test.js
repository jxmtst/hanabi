import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createBridge } from '../src/receiver/bridge.js';

test('createBridge: 接続中のクライアントに JSON をブロードキャストする', async () => {
  const bridge = createBridge(0); // 0 = OS が空きポートを割り当て
  const port = await bridge.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  const received = new Promise((resolve) => {
    client.on('message', (data) => resolve(JSON.parse(data.toString())));
  });
  await new Promise((resolve) => client.on('open', resolve));

  bridge.broadcast({ id: 'm1', text: 'hi' });
  const msg = await received;
  assert.deepEqual(msg, { id: 'm1', text: 'hi' });

  client.close();
  await bridge.close();
});
