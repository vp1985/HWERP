const SAFE_ABSOLUTE_PROTOCOLS = new Set(['http:', 'https:']);

export function sanitizeInquiryHref(rawHref: string | null | undefined): string | null {
  const href = rawHref?.trim();

  if (!href || href.startsWith('//') || href.startsWith('#') || href.startsWith('?') || /[\u0000-\u001f\u007f]/.test(href)) {
    return null;
  }

  try {
    const parsed = new URL(href, 'https://hwerp.local');
    const hasExplicitProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href);

    if (hasExplicitProtocol && !SAFE_ABSOLUTE_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return href;
  } catch {
    return null;
  }
}
