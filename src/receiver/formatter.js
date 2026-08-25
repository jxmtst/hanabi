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
