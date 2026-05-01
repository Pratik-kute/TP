const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const router = express.Router();

const ACCESS_TTL = parseInt(process.env.JWT_ACCESS_TTL_SECONDS) || 1800;
const REFRESH_TTL = parseInt(process.env.JWT_REFRESH_TTL_SECONDS) || 2592000;

// Validate API key middleware for auth routes
function requireApiKey(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== process.env.API_KEY) {
    return res.status(401).json({ error: { code: 'INVALID_API_KEY', message: 'Invalid API key.' } });
  }
  next();
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, password, password_hash, role, is_active, organization_id, name, avatar')
      .eq('email', email.toLowerCase().trim())
      .limit(1);

    if (error) throw error;
    const row = users && users.length > 0 ? users[0] : null;

    if (!row) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!row.is_active) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    let ok = false;
    if (row.password_hash && row.password_hash !== "") {
      ok = await bcrypt.compare(password, row.password_hash);
    } else if (row.password && row.password !== "") {
      ok = (password === row.password);
      // After successful plaintext match, opportunistically migrate:
      if (ok) {
        const hash = await bcrypt.hash(password, 10);
        await supabase.from('users').update({ password_hash: hash }).eq('id', row.id);
      }
    } else {
      ok = false;
    }

    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (row.role !== "auditor") {
      return res.status(403).json({ error: "This app is for auditors only" });
    }

    const token = jwt.sign(
      { sub: row.id, role: row.role, org: row.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      token,
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        organization_id: row.organization_id,
        full_name: row.name,
        avatar_url: row.avatar
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', requireApiKey, async (req, res) => {
  try {
    const { refreshToken, deviceId } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Refresh token missing.' } });
    }
    const now = new Date().toISOString();
    const { data: tokens } = await supabase
      .from('refresh_tokens')
      .select('*')
      .is('revoked_at', null)
      .gt('expires_at', now);
    let matchedToken = null;
    for (const t of (tokens || [])) {
      const match = await bcrypt.compare(refreshToken, t.token_hash);
      if (match) { matchedToken = t; break; }
    }
    if (!matchedToken) {
      return res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Invalid or expired refresh token.' } });
    }
    // Revoke old token
    await supabase.from('refresh_tokens').update({ revoked_at: now, replaced_by: 'rotated' }).eq('id', matchedToken.id);
    // Get user
    const { data: users } = await supabase.from('users').select('id, email, role, organization_id').eq('id', matchedToken.user_id).limit(1);
    const user = users?.[0];
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'User not found.' } });
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TTL }
    );
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000).toISOString();
    await supabase.from('refresh_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      device_id: deviceId || matchedToken.device_id,
      issued_at: now,
      expires_at: expiresAt,
    });
    return res.json({ accessToken, accessTokenExpiresIn: ACCESS_TTL, refreshToken: rawRefreshToken, refreshTokenExpiresIn: REFRESH_TTL });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', requireApiKey, async (req, res) => {
  try {
    const { refreshToken, allDevices } = req.body;
    if (allDevices && refreshToken) {
      const { data: tokens } = await supabase.from('refresh_tokens').select('id, token_hash, user_id').is('revoked_at', null);
      for (const t of (tokens || [])) {
        const match = await bcrypt.compare(refreshToken, t.token_hash);
        if (match) {
          await supabase.from('refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('user_id', t.user_id);
          break;
        }
      }
    } else if (refreshToken) {
      const { data: tokens } = await supabase.from('refresh_tokens').select('id, token_hash').is('revoked_at', null);
      for (const t of (tokens || [])) {
        const match = await bcrypt.compare(refreshToken, t.token_hash);
        if (match) {
          await supabase.from('refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', t.id);
          break;
        }
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.json({ ok: true });
  }
});

// GET /api/v1/auth/me
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '').trim();
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Invalid or expired token.' } });
    }
    const { data: users } = await supabase.from('users').select('id, name, email, role, department_id, phone, avatar, is_active, organization_id').eq('id', payload.userId).limit(1);
    const user = users?.[0];
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'User not found.' } });
    const { data: orgs } = await supabase.from('organizations').select('id, name, short_name, logo_url, currency, country, contact_email, contact_phone, industry').eq('id', user.organization_id).limit(1);
    const org = orgs?.[0];
    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, departmentId: user.department_id, phone: user.phone || '', avatar: user.avatar, isActive: user.is_active, organizationId: user.organization_id },
      organization: org ? { id: org.id, name: org.name, shortName: org.short_name, logoUrl: org.logo_url, currency: org.currency, country: org.country, contactEmail: org.contact_email, contactPhone: org.contact_phone, industry: org.industry } : null,
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

module.exports = router;
