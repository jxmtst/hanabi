import { config, assertReceiverConfig } from '../config.js';
import { createBridge } from './bridge.js';
import { startDiscordClient } from './discord-client.js';

assertReceiverConfig();

const bridge = createBridge(config.wsPort);
bridge.ready().then((port) => {
  console.log(`[receiver] WS bridge listening on ws://127.0.0.1:${port}`);
});

startDiscordClient(
  { token: config.botToken, channelId: config.channelId },
  (msg) => {
    console.log(`[receiver] ${msg.author.name}: ${msg.text}`);
    bridge.broadcast(msg);
  },
);

process.on('SIGINT', async () => {
  await bridge.close();
  process.exit(0);
});
