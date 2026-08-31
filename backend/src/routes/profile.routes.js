import { Router } from 'express';
import { fetchLinkedInProfile, checkLinkedInSession } from '../linkedin/profileService.js';
import { extractVanityName, buildProfileUrl } from '../linkedin/utils.js';
import {
  getCachedProfile,
  setCachedProfile,
  logRequest,
  isDatabaseConnected,
} from '../db/index.js';
import {
  LinkedInSessionError,
  LinkedInProfileNotFoundError,
  LinkedInRateLimitError,
} from '../linkedin/client.js';

const router = Router();

function getCacheTtl() {
  return Number(process.env.CACHE_TTL_SECONDS) || 3600;
}

function buildSuccessResponse({ data, profileUrl, vanityName, cached, fetchedAt }) {
  return {
    success: true,
    meta: {
      profileUrl,
      vanityName,
      fetchedAt,
      cached,
      source: 'linkedin-voyager-api',
      schemaVersion: '1.0.0',
    },
    data,
  };
}

/**
 * GET /api/profile?url=https://www.linkedin.com/in/username
 * POST /api/profile  { "url": "https://www.linkedin.com/in/username" }
 */
async function handleProfileLookup(req, res, next) {
  const started = Date.now();
  const profileUrl = req.query.url || req.body?.url;
  let vanityName;

  try {
    if (!profileUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'Provide a LinkedIn profile URL via ?url= query param or JSON body { "url": "..." }',
        },
      });
    }

    vanityName = extractVanityName(profileUrl);
    const normalizedUrl = buildProfileUrl(vanityName);
    const skipCache = req.query.refresh === 'true' || req.body?.refresh === true;

    if (!skipCache) {
      const cached = await getCachedProfile(vanityName);
      if (cached) {
        await logRequest({
          vanityName,
          profileUrl: normalizedUrl,
          success: true,
          statusCode: 200,
          durationMs: Date.now() - started,
          cached: true,
          ip: req.ip,
        });

        return res.json(
          buildSuccessResponse({
            data: cached.data,
            profileUrl: normalizedUrl,
            vanityName,
            cached: true,
            fetchedAt: cached.fetchedAt.toISOString(),
          })
        );
      }
    }

    const result = await fetchLinkedInProfile(normalizedUrl);

    await setCachedProfile({
      vanityName,
      profileUrl: normalizedUrl,
      data: result.data,
      fetchedAt: new Date(result.fetchedAt),
      ttlSeconds: getCacheTtl(),
    });

    await logRequest({
      vanityName,
      profileUrl: normalizedUrl,
      success: true,
      statusCode: 200,
      durationMs: Date.now() - started,
      cached: false,
      ip: req.ip,
    });

    return res.json(
      buildSuccessResponse({
        data: result.data,
        profileUrl: normalizedUrl,
        vanityName,
        cached: false,
        fetchedAt: result.fetchedAt,
      })
    );
  } catch (error) {
    await logRequest({
      vanityName,
      profileUrl,
      success: false,
      statusCode: error.statusCode || 500,
      durationMs: Date.now() - started,
      cached: false,
      error: error.message,
      ip: req.ip,
    });
    next(error);
  }
}

router.get('/profile', handleProfileLookup);
router.post('/profile', handleProfileLookup);

router.get('/health', async (_req, res) => {
  // Do NOT call LinkedIn on every health check — that burns the session.
  // Use GET /api/health/linkedin to test cookies manually.
  res.json({
    success: true,
    status: 'ok',
    services: {
      api: 'healthy',
      mongodb: isDatabaseConnected() ? 'connected' : 'disabled',
      linkedin: 'not_checked',
    },
    timestamp: new Date().toISOString(),
  });
});

router.get('/health/linkedin', async (_req, res) => {
  try {
    const session = await checkLinkedInSession();
    res.json({
      success: true,
      linkedin: session.valid ? 'connected' : 'disconnected',
      error: session.error || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      linkedin: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/docs', (_req, res) => {
  res.json({
    name: 'LinkedIn Profile API',
    version: '1.0.0',
    endpoints: [
      {
        method: 'GET',
        path: '/api/profile',
        description: 'Fetch structured LinkedIn profile data',
        parameters: [
          { name: 'url', in: 'query', required: true, example: 'https://www.linkedin.com/in/williamhgates' },
          { name: 'refresh', in: 'query', required: false, description: 'Bypass cache when true' },
        ],
      },
      {
        method: 'POST',
        path: '/api/profile',
        description: 'Fetch structured LinkedIn profile data',
        body: { url: 'https://www.linkedin.com/in/williamhgates', refresh: false },
      },
      { method: 'GET', path: '/api/health', description: 'Health check' },
      { method: 'GET', path: '/api/docs', description: 'This documentation' },
    ],
    responseSchema: {
      success: true,
      meta: {
        profileUrl: 'string',
        vanityName: 'string',
        fetchedAt: 'ISO-8601',
        cached: 'boolean',
        source: 'linkedin-voyager-api',
        schemaVersion: '1.0.0',
      },
      data: {
        identity: '{ fullName, headline, location, industry, summary, ... }',
        media: '{ profilePhoto, backgroundPhoto }',
        experience: '[]',
        education: '[]',
        skills: '[]',
        certifications: '[]',
        languages: '[]',
        volunteer: '[]',
        honors: '[]',
        stats: '{ counts }',
      },
    },
  });
});

export default router;

export { LinkedInSessionError, LinkedInProfileNotFoundError, LinkedInRateLimitError };
