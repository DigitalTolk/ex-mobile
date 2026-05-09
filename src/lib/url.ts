export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (url.pathname === '/') url.pathname = '';
  return url.toString().replace(/\/+$/, '');
}

export function apiUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function authCallbackUrl(): string {
  return 'ex://mobile/auth/callback';
}

export function isSameServerUrl(serverUrl: string, candidateUrl: string): boolean {
  const server = new URL(serverUrl);
  const candidate = new URL(candidateUrl);

  return (
    server.protocol.toLowerCase() === candidate.protocol.toLowerCase() &&
    server.hostname.toLowerCase() === candidate.hostname.toLowerCase() &&
    normalizedPort(server) === normalizedPort(candidate)
  );
}

function normalizedPort(url: URL): string {
  if (url.port) return url.port;
  if (url.protocol.toLowerCase() === 'http:') return '80';
  if (url.protocol.toLowerCase() === 'https:') return '443';
  return '';
}
