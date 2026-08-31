export function apiKeyAuth(req, res, next) {
  const configuredKey = process.env.API_KEY;
  // Render and other uptime checks must not consume a LinkedIn request.
  if (req.path === '/health') return next();

  if (!configuredKey) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_CONFIGURED',
          message: 'The public API is disabled until API_KEY is configured.',
        },
      });
    }
    return next();
  }

  const provided =
    req.headers['x-api-key'] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.query.api_key;

  if (provided !== configuredKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid API key required. Pass via X-API-Key header.',
      },
    });
  }

  next();
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const payload = {
    success: false,
    error: {
      code: err.name || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
    meta: {
      path: req.path,
      timestamp: new Date().toISOString(),
    },
  };

  if (err.retryAfter) {
    payload.error.retryAfter = err.retryAfter;
    res.set('Retry-After', String(err.retryAfter));
  }

  if (!isProduction && err.stack) {
    payload.error.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
