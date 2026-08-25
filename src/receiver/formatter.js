const URL_RE = /https?:\/\/[^\s]+/g;

export function shortenUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const hasPath = (u.pathname && u.pathname !== '/') || u.search || u.hash;
    return hasPath ? `${host}/…` : host;
  } catch {
    return url;
  }
}

export function formatText(content) {
  return content.replace(URL_RE, (m) => shortenUrl(m));
}

// <:name:id> または <a:name:id>（アニメーション）にマッチ
const EMOJI_RE = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;

export function parseSegments(content) {
  const segments = [];
  let lastIndex = 0;
  let match;

  const pushText = (raw) => {
    if (!raw) return;
    segments.push({ type: 'text', value: formatText(raw) });
  };

  EMOJI_RE.lastIndex = 0;
  while ((match = EMOJI_RE.exec(content)) !== null) {
    pushText(content.slice(lastIndex, match.index));
    const [, animated, name, id] = match;
    const ext = animated ? 'gif' : 'png';
    segments.push({
      type: 'emoji',
      url: `https://cdn.discordapp.com/emojis/${id}.${ext}`,
      name,
    });
    lastIndex = match.index + match[0].length;
  }
  pushText(content.slice(lastIndex));
  return segments;
}

export function normalize({ id, authorName, authorAvatarUrl, content, timestamp }) {
  return {
    id,
    author: { name: authorName, avatarUrl: authorAvatarUrl ?? null },
    text: content,
    segments: parseSegments(content),
    timestamp,
  };
}
