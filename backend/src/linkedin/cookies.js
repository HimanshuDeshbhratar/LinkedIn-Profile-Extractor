/**
 * Parse LinkedIn cookies from environment variables.
 * Supports full cookie string (LI_COOKIE) or individual LI_AT + JSESSIONID.
 */

const ESSENTIAL_COOKIES = ['li_at', 'JSESSIONID', 'bcookie', 'bscookie', 'lidc'];

export function parseCookiesFromEnv() {
  const fullCookie = process.env.LI_COOKIE?.trim();
  if (fullCookie) {
    try {
      return parseCookieString(fullCookie);
    } catch {
      // User pasted only the li_at token value without "li_at=" prefix — merge with other env vars
      return mergeSeparateCookieVars({ li_at: fullCookie });
    }
  }

  return mergeSeparateCookieVars({});
}

function mergeSeparateCookieVars(base) {
  const liAt = process.env.LI_AT?.trim() || base.li_at;
  const jsessionId = process.env.JSESSIONID?.trim();

  if (!liAt || !jsessionId) {
    throw new Error(
      'LinkedIn cookies required. Set LI_COOKIE (full string like li_at=...; JSESSIONID=...) OR LI_AT + JSESSIONID. See README.'
    );
  }

  const cookies = { ...parseExtraCookies(process.env.LI_EXTRA_COOKIES), ...base };
  cookies.li_at = liAt.replace(/^li_at=/, '');
  cookies.JSESSIONID = normalizeJsessionId(jsessionId);

  // Pick up bcookie/bscookie/lidc if set as standalone env vars (common .env mistake)
  for (const name of ['bcookie', 'bscookie', 'lidc', 'liap']) {
    if (process.env[name] && !cookies[name]) {
      cookies[name] = process.env[name].trim();
    }
  }

  return cookies;
}

export function parseCookieString(raw) {
  const cookies = parseCookiePairs(raw);

  if (!cookies.li_at) {
    throw new Error('LI_COOKIE must include li_at');
  }
  if (!cookies.JSESSIONID) {
    throw new Error('LI_COOKIE must include JSESSIONID');
  }

  cookies.JSESSIONID = normalizeJsessionId(cookies.JSESSIONID);
  return cookies;
}

function parseExtraCookies(raw) {
  if (!raw) return {};
  // LI_EXTRA_COOKIES intentionally contains only supplemental cookies, so it
  // must not be parsed with the li_at/JSESSIONID validation used for a full
  // cookie header.
  return parseCookiePairs(raw);
}

function parseCookiePairs(raw) {
  const cookies = {};

  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) cookies[key] = value;
  }

  return cookies;
}

export function normalizeJsessionId(value) {
  let id = value.replace(/^"|"$/g, '').trim();
  if (!id.startsWith('ajax:')) {
    id = `ajax:${id.replace(/^ajax:/, '')}`;
  }
  return id;
}

export function buildCookieHeader(cookies) {
  const merged = { ...cookies };

  // JSESSIONID must be quoted in the Cookie header (browser convention)
  const jsession = merged.JSESSIONID;
  if (jsession && !jsession.startsWith('"')) {
    merged.JSESSIONID = `"${jsession.replace(/^"|"$/g, '')}"`;
  }

  if (!merged.lang) {
    merged.lang = 'v=2&lang=en-us';
  }

  return Object.entries(merged)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export function getCsrfToken(cookies) {
  return normalizeJsessionId(cookies.JSESSIONID || '');
}

export function validateCookieSet(cookies) {
  const missing = ESSENTIAL_COOKIES.filter((name) => {
    if (name === 'JSESSIONID' || name === 'li_at') return !cookies[name];
    return false;
  });

  const warnings = ESSENTIAL_COOKIES.filter(
    (name) => name !== 'li_at' && name !== 'JSESSIONID' && !cookies[name]
  );

  return { missing, warnings };
}
