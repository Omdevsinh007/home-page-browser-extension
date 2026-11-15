const UNSAFE_SCHEMES = ['javascript:', 'data:', 'vbscript:'];

/** Adds https:// unless the input is a system path or already has a scheme. */
export function normalizeUrl(input: string): string {
  const url = input.trim();
  const isSystemPath = /^[a-zA-Z]:\\|^[a-zA-Z]:\/|^\/|^\./.test(url);
  const hasProtocol = /^[a-z0-9+.-]+:\/\//i.test(url) || /^about:/i.test(url);
  return isSystemPath || hasProtocol ? url : `https://${url}`;
}

/** Denylist check (spec §6.5). */
export function isUnsafeUrl(url: string): boolean {
  const value = url.trim().toLowerCase().replace(/\s+/g, '');
  return UNSAFE_SCHEMES.some((scheme) => value.startsWith(scheme));
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}
