import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  VOYAGER_BASE,
  DECORATIONS,
  QUERY_IDS,
  USER_AGENT,
  LI_TRACK,
} from './constants.js';
import {
  parseCookiesFromEnv,
  buildCookieHeader,
  getCsrfToken,
  validateCookieSet,
} from './cookies.js';
import {
  extractVanityName,
  encodeGraphQlVariables,
  sleep,
  randomDelay,
} from './utils.js';

export class LinkedInSessionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'LinkedInSessionError';
    this.statusCode = 401;
    this.details = details;
  }
}

export class LinkedInProfileNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LinkedInProfileNotFoundError';
    this.statusCode = 404;
  }
}

export class LinkedInRateLimitError extends Error {
  constructor(message, retryAfter = 60) {
    super(message);
    this.name = 'LinkedInRateLimitError';
    this.statusCode = 429;
    this.retryAfter = retryAfter;
  }
}

export class LinkedInRequestsDisabledError extends Error {
  constructor() {
    super(
      'Live LinkedIn requests are disabled. Set LINKEDIN_ENABLE_LIVE_REQUESTS=true only after you have explicitly accepted the account-session risk.'
    );
    this.name = 'LinkedInRequestsDisabledError';
    this.statusCode = 503;
  }
}

export class LinkedInClient {
  constructor({ cookies }) {
    this.cookies = cookies;
    this.csrfToken = getCsrfToken(cookies);
    this.sessionValidatedAt = null;
    this.lastRequestAt = 0;
    // A single cookie jar must never make simultaneous Voyager requests. Apart
    // from being wasteful, request bursts are a common cause of session flags.
    this.requestChain = Promise.resolve();

    const axiosConfig = {
      baseURL: VOYAGER_BASE,
      timeout: 45000,
      validateStatus: () => true,
    };

    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      axiosConfig.proxy = false;
    }

    this.http = axios.create(axiosConfig);
  }

  buildHeaders(referer) {
    return {
      Host: 'www.linkedin.com',
      accept: 'application/vnd.linkedin.normalized+json+2.1',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'csrf-token': this.csrfToken,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base;profile',
      'x-li-track': LI_TRACK,
      'user-agent': USER_AGENT,
      cookie: buildCookieHeader(this.cookies),
      referer: referer || 'https://www.linkedin.com/feed/',
      origin: 'https://www.linkedin.com',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      priority: 'u=1, i',
    };
  }

  async throttle() {
    const minGap = Number(process.env.LINKEDIN_REQUEST_DELAY_MS) || 1200;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minGap) {
      await sleep(minGap - elapsed + randomDelay(100, 400));
    }
    this.lastRequestAt = Date.now();
  }

  isLoginResponse(response) {
    const location = response.headers?.location || '';
    if (location.includes('/login') || location.includes('/uas/login')) {
      return true;
    }

    const data = response.data;
    if (typeof data === 'string' && data.includes('authwall')) {
      return true;
    }

    if (data?.data?.code === 'UNAUTHORIZED' || data?.status === 401) {
      return true;
    }

    return false;
  }

  handleResponse(response, { authCritical = false, allowNotFound = false } = {}) {
    if (response.status === 999) {
      throw new LinkedInRateLimitError(
        'LinkedIn bot detection triggered. Use fresh cookies with bcookie/bscookie/lidc, avoid rapid requests, or set HTTPS_PROXY to a residential proxy.',
        120
      );
    }

    if (this.isLoginResponse(response)) {
      throw new LinkedInSessionError(
        'LinkedIn session invalid — cookies expired or rejected. Re-copy ALL cookies from your browser (see README).',
        { status: response.status, hint: 'Use LI_COOKIE with full cookie string including bcookie, bscookie, lidc' }
      );
    }

    if (response.status === 429) {
      throw new LinkedInRateLimitError(
        'LinkedIn rate limit reached. Wait before retrying.',
        Number(response.headers['retry-after']) || 60
      );
    }

    if (response.status === 404 && allowNotFound) {
      return null;
    }

    if (response.status === 404) {
      throw new LinkedInProfileNotFoundError('LinkedIn profile not found');
    }

    // 403 on non-auth-critical endpoints = endpoint forbidden, NOT session death
    if (response.status === 403 && !authCritical) {
      return null;
    }

    if (response.status === 401 || (response.status === 403 && authCritical)) {
      throw new LinkedInSessionError(
        'LinkedIn rejected the request. Re-export cookies while logged in — include bcookie, bscookie, lidc in LI_COOKIE.',
        { status: response.status }
      );
    }

    if (response.status >= 300 && response.status < 400) {
      throw new LinkedInSessionError(
        'LinkedIn redirected away from the API — session cookies are likely expired.',
        { status: response.status, location: response.headers?.location }
      );
    }

    if (response.status >= 400) {
      return null;
    }

    return response.data;
  }

  async request(path, options = {}) {
    const { params, method = 'GET', referer, authCritical = false, allowNotFound = false } =
      options;

    const run = async () => {
      await this.throttle();
      const response = await this.http.request({
        url: path,
        method,
        params,
        headers: this.buildHeaders(referer),
        maxRedirects: 0,
      });

      return this.handleResponse(response, { authCritical, allowNotFound });
    };

    const queued = this.requestChain.then(run, run);
    // Keep the queue usable after a failed request while returning the actual
    // failure to its caller.
    this.requestChain = queued.catch(() => undefined);
    return queued;
  }

  async graphql(queryId, variables, referer) {
    const params = {
      includeWebMetadata: 'true',
      variables: encodeGraphQlVariables(variables),
      queryId,
    };

    return this.request('/graphql', { params, referer, authCritical: false });
  }

  /** Lightweight session check — called once, not on every profile fetch */
  async ensureSession() {
    const cacheMs = 5 * 60 * 1000;
    if (this.sessionValidatedAt && Date.now() - this.sessionValidatedAt < cacheMs) {
      return true;
    }

    const data = await this.request('/me', {
      referer: 'https://www.linkedin.com/feed/',
      authCritical: true,
    });

    if (!data) {
      throw new LinkedInSessionError('Could not verify LinkedIn session via /me');
    }

    this.sessionValidatedAt = Date.now();
    return true;
  }

  async resolveProfile(vanityName) {
    const referer = `https://www.linkedin.com/in/${vanityName}/`;

    const data = await this.request('/identity/dash/profiles', {
      params: {
        q: 'memberIdentity',
        memberIdentity: vanityName,
        decorationId: DECORATIONS.TOP_CARD,
      },
      referer,
      authCritical: false,
      allowNotFound: true,
    });

    const element = data?.elements?.[0];
    if (!element?.entityUrn) return null;

    return { element, included: data.included || [], vanityName };
  }

  async fetchProfileView(vanityName) {
    const referer = `https://www.linkedin.com/in/${vanityName}/`;

    const data = await this.request(
      `/identity/profiles/${encodeURIComponent(vanityName)}/profileView`,
      { referer, authCritical: true, allowNotFound: true }
    );

    if (!data || (data.status && data.status !== 200)) {
      return null;
    }

    return data;
  }

  async fetchSkills(publicId) {
    const referer = `https://www.linkedin.com/in/${publicId}/`;

    const data = await this.request(
      `/identity/profiles/${encodeURIComponent(publicId)}/skills`,
      {
        params: { count: 100, start: 0 },
        referer,
        authCritical: false,
      }
    );

    return data?.elements || [];
  }

  async fetchDashFullProfile(profileUrn, vanityName) {
    const profileId = profileUrn.split(':').pop();
    const referer = `https://www.linkedin.com/in/${vanityName}/`;

    return this.request(
      `/identity/dash/profiles/urn:li:fsd_profile:${profileId}`,
      {
        params: { decorationId: DECORATIONS.FULL_PROFILE },
        referer,
        authCritical: false,
      }
    );
  }

  async fetchProfileGraphQL(profileUrn, vanityName) {
    if (process.env.LINKEDIN_USE_GRAPHQL !== 'true') {
      return { profiles: null, components: null };
    }

    const referer = `https://www.linkedin.com/in/${vanityName}/`;

    const profilesData =
      (await this.graphql(QUERY_IDS.PROFILES, { vanityName }, referer)) ||
      (await this.graphql(QUERY_IDS.PROFILES, { profileUrn }, referer));

    await sleep(randomDelay(400, 800));

    const componentsData = await this.graphql(
      QUERY_IDS.PROFILE_COMPONENTS,
      { profileUrn },
      referer
    );

    return { profiles: profilesData, components: componentsData };
  }

  async validateSession() {
    try {
      await this.ensureSession();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Conservative fetch: minimal requests, sequential, profileView-first.
   * Avoids parallel bursts that trigger LinkedIn session invalidation.
   */
  async fetchRawProfile(profileUrl) {
    if (process.env.LINKEDIN_ENABLE_LIVE_REQUESTS !== 'true') {
      throw new LinkedInRequestsDisabledError();
    }

    const vanityName = extractVanityName(profileUrl);
    const referer = `https://www.linkedin.com/in/${vanityName}/`;

    // Do not preflight every lookup with /me: it adds an authenticated request
    // but does not provide profile data. The first profile request itself is
    // the session check, keeping a normal lookup to the smallest request set.
    // Primary: legacy profileView — most stable, single request with rich data
    let profileView = await this.fetchProfileView(vanityName);

    let resolved = null;
    let profileUrn = null;
    let profileId = null;

    if (profileView?.profile) {
      const mini = profileView.profile.miniProfile;
      profileId = mini?.objectUrn?.split(':').pop() || mini?.entityUrn?.split(':').pop();
      profileUrn = profileId ? `urn:li:fsd_profile:${profileId}` : null;
    }

    // Fallback: dash resolve if profileView didn't work
    if (!profileView) {
      resolved = await this.resolveProfile(vanityName);
      if (!resolved) {
        throw new LinkedInProfileNotFoundError(
          `Profile "${vanityName}" not found or not accessible`
        );
      }
      profileUrn = resolved.element.entityUrn;
      profileId = profileUrn.split(':').pop();
    }

    await sleep(randomDelay(500, 900));

    // Skills — separate lightweight call
    const skills = await this.fetchSkills(vanityName);

    // Optional enrichment (off by default — these endpoints often 403 and trigger flags)
    let dashFull = null;
    let graphqlData = { profiles: null, components: null };

    if (process.env.LINKEDIN_USE_ENRICHMENT === 'true' && profileUrn) {
      await sleep(randomDelay(600, 1000));
      dashFull = await this.fetchDashFullProfile(profileUrn, vanityName);
      graphqlData = await this.fetchProfileGraphQL(profileUrn, vanityName);
    }

    return {
      vanityName,
      profileUrn,
      profileId,
      referer,
      resolved,
      graphqlData,
      profileView,
      dashFull,
      skills,
    };
  }
}

export function createLinkedInClientFromEnv() {
  const cookies = parseCookiesFromEnv();
  const { missing, warnings } = validateCookieSet(cookies);

  if (missing.length) {
    throw new Error(`Missing required cookies: ${missing.join(', ')}`);
  }

  if (warnings.length) {
    console.warn(
      `[linkedin] Missing recommended cookies (${warnings.join(', ')}). ` +
        'Session may be invalidated faster. Use full LI_COOKIE export — see README.'
    );
  }

  return new LinkedInClient({ cookies });
}
