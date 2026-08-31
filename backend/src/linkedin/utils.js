/**
 * Extract LinkedIn vanity name (public identifier) from profile URLs.
 */
export class InvalidProfileUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidProfileUrlError';
    this.statusCode = 400;
  }
}

export function extractVanityName(profileUrl) {
  if (!profileUrl || typeof profileUrl !== 'string') {
    throw new InvalidProfileUrlError('Profile URL is required');
  }

  const trimmed = profileUrl.trim();

  // Allow bare vanity names like "williamhgates"
  if (!trimmed.includes('linkedin.com') && /^[\w-]+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  let url;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    throw new InvalidProfileUrlError('Invalid LinkedIn profile URL');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== 'linkedin.com' && hostname !== 'www.linkedin.com') {
    throw new InvalidProfileUrlError('URL must be a linkedin.com profile link');
  }

  const match = url.pathname.match(/\/in\/([^/?#]+)/i);
  if (!match?.[1]) {
    throw new InvalidProfileUrlError(
      'Could not extract profile identifier from URL. Expected format: https://www.linkedin.com/in/username'
    );
  }

  const vanityName = decodeURIComponent(match[1]);
  if (!/^[a-z0-9-]+$/i.test(vanityName)) {
    throw new InvalidProfileUrlError('Invalid LinkedIn profile identifier');
  }

  return vanityName.toLowerCase();
}

export function buildProfileUrl(vanityName) {
  return `https://www.linkedin.com/in/${vanityName}/`;
}

export function extractProfileIdFromUrn(urn) {
  if (!urn) return null;
  const parts = urn.split(':');
  return parts[parts.length - 1] || null;
}

export function encodeProfileUrn(profileId) {
  return `urn:li:fsd_profile:${profileId}`;
}

export function encodeGraphQlVariables(variables) {
  const entries = Object.entries(variables).map(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('urn:')) {
      return `${key}:${encodeURIComponent(value)}`;
    }
    if (typeof value === 'number') return `${key}:${value}`;
    if (typeof value === 'boolean') return `${key}:${value}`;
    return `${key}:${value}`;
  });
  return `(${entries.join(',')})`;
}

export function pickLocalizedText(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (field.text) return field.text;
  if (field.localized) {
    const values = Object.values(field.localized);
    return values[0] || null;
  }
  return null;
}

export function parseDateRange(start, end) {
  const format = (d) => {
    if (!d) return null;
    if (typeof d === 'object') {
      const month = d.month ? String(d.month).padStart(2, '0') : '01';
      const year = d.year ?? null;
      return year ? `${year}-${month}` : null;
    }
    return null;
  };

  return {
    start: format(start),
    end: format(end),
    isCurrent: !end?.year && !end?.month,
  };
}

export function resolveImageUrls(vectorImage) {
  if (!vectorImage?.rootUrl || !Array.isArray(vectorImage.artifacts)) {
    return [];
  }

  return vectorImage.artifacts
    .map((artifact) => ({
      url: `${vectorImage.rootUrl}${artifact.fileIdentifyingUrlPathSegment || ''}`,
      width: artifact.width ?? null,
      height: artifact.height ?? null,
    }))
    .filter((item) => item.url);
}

export function getBestImageUrl(vectorImage) {
  const urls = resolveImageUrls(vectorImage);
  if (!urls.length) return null;
  return urls.sort((a, b) => (b.width || 0) - (a.width || 0))[0].url;
}

export function findInIncluded(included, type, predicate = () => true) {
  if (!Array.isArray(included)) return [];
  return included.filter((item) => item?.$type === type && predicate(item));
}

export function findFirstInIncluded(included, type, predicate = () => true) {
  return findInIncluded(included, type, predicate)[0] ?? null;
}

export function indexIncludedByUrn(included) {
  const map = new Map();
  if (!Array.isArray(included)) return map;
  for (const item of included) {
    if (item?.entityUrn) map.set(item.entityUrn, item);
  }
  return map;
}

export function resolveReference(ref, includedMap) {
  if (!ref) return null;
  if (typeof ref === 'object' && !ref.entityUrn) return ref;
  const urn = typeof ref === 'string' ? ref : ref.entityUrn || ref['*company'] || ref['*school'] || ref['*geo'];
  if (!urn) return ref;
  return includedMap.get(urn) || ref;
}

export function resolveGeoName(geo, includedMap) {
  const resolved = resolveReference(geo, includedMap);
  if (!resolved) return null;
  if (typeof resolved === 'string') return resolved;
  return (
    pickLocalizedText(resolved.defaultLocalizedName) ||
    pickLocalizedText(resolved.localizedName) ||
    resolved.shortName ||
    null
  );
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
