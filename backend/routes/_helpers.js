const jwt = require('jsonwebtoken');

function error(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message: message || code,
      requestId: null,
      fieldErrors: null,
      details: null,
    },
  });
}

function extractBearer(req) {
  const auth = req.headers.authorization || '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

function requireUser(req, res) {
  const token = extractBearer(req);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.organizationId) {
      error(res, 401, 'UNAUTHENTICATED', 'User is not linked to an organization.');
      return null;
    }
    return payload;
  } catch (err) {
    error(res, 401, 'TOKEN_EXPIRED', 'Invalid or expired token.');
    return null;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );
}

function toCamel(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out;
}

function pageParams(req) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 500);
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

module.exports = {
  error,
  extractBearer,
  requireUser,
  isUuid,
  toCamel,
  pageParams,
};
