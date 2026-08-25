import { Client, GatewayIntentBits, Events } from 'discord.js';
import { normalize } from './formatter.js';

/**
 * Discord に接続し、対象チャンネルのメッセージを normalize して onMessage に渡す。
 * @param {{ token: string, channelId: string }} opts
 * @param {(msg: object) => void} onMessage
 * @returns {Client}
 */
export function startDiscordClient({ token, channelId }, onMessage) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[receiver] Discord 接続完了: ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.channelId !== channelId) return;
    if (message.author.bot) return;
    onMessage(
      normalize({
        id: message.id,
        authorName: message.member?.displayName ?? message.author.username,
        authorAvatarUrl: message.author.displayAvatarURL({ size: 64 }),
        content: message.content,
        timestamp: message.createdTimestamp,
      }),
    );
  });

  client.login(token);
  return client;
}
