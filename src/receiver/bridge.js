import { WebSocketServer } from 'ws';

export function createBridge(port) {
  const wss = new WebSocketServer({ host: '127.0.0.1', port });

  const readyPromise = new Promise((resolve, reject) => {
    wss.on('listening', () => resolve(wss.address().port));
    wss.on('error', reject);
  });

  return {
    ready: () => readyPromise,
    broadcast(obj) {
      const data = JSON.stringify(obj);
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(data);
      }
    },
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}
