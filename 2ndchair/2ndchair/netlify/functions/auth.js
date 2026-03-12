/**
 * 2ndChair — Auth Function
 * Single-password gate. Set APP_PASSWORD in Netlify env vars.
 *
 * POST /api/auth
 * Body: { password }
 * Returns: { token }
 */

const crypto = require('crypto');

const HEADERS = {
  'Content-Type':              'application/json',
  'Cache-Control':             'no-store',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function respond(status, body) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify(body) };
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba); // dummy to prevent timing leak
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function generateToken() {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error('APP_SECRET not set');
  const payload = Buffer.from(JSON.stringify({
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST')   return respond(405, { error: 'Method not allowed' });

  const appPassword = process.env.APP_PASSWORD;
  const appSecret   = process.env.APP_SECRET;

  if (!appPassword || !appSecret) {
    console.error('[auth] Missing APP_PASSWORD or APP_SECRET env vars');
    return respond(500, { error: 'Auth service not configured.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid request.' }); }

  const { password = '' } = body;

  if (!safeCompare(password, appPassword)) {
    console.warn('[auth] Failed login attempt', new Date().toISOString());
    return respond(401, { error: 'Incorrect password.' });
  }

  try {
    const token = generateToken();
    console.log('[auth] Login success', new Date().toISOString());
    return respond(200, { token });
  } catch(err) {
    console.error('[auth] Token error:', err.message);
    return respond(500, { error: 'Auth error.' });
  }
};
