import { createLinkedInClientFromEnv, LinkedInRequestsDisabledError } from './client.js';
import { transformProfile } from './profileParser.js';
import { extractVanityName, buildProfileUrl } from './utils.js';

let clientInstance = null;
const inFlightLookups = new Map();

function getClient() {
  if (!clientInstance) {
    clientInstance = createLinkedInClientFromEnv();
  }
  return clientInstance;
}

export async function fetchLinkedInProfile(profileUrl) {
  if (process.env.LINKEDIN_ENABLE_LIVE_REQUESTS !== 'true') {
    throw new LinkedInRequestsDisabledError();
  }

  const vanityName = extractVanityName(profileUrl);
  const existing = inFlightLookups.get(vanityName);
  if (existing) return existing;

  const lookup = fetchProfile(vanityName);
  inFlightLookups.set(vanityName, lookup);
  try {
    return await lookup;
  } finally {
    inFlightLookups.delete(vanityName);
  }
}

async function fetchProfile(vanityName) {
  const client = getClient();
  const raw = await client.fetchRawProfile(buildProfileUrl(vanityName));
  const data = transformProfile(raw);

  return {
    profileUrl: buildProfileUrl(vanityName),
    vanityName,
    data,
    fetchedAt: new Date().toISOString(),
  };
}

export async function checkLinkedInSession() {
  const client = getClient();
  return client.validateSession();
}

export function resetClient() {
  clientInstance = null;
}
