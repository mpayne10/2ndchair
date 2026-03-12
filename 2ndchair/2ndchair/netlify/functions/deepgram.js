/**
 * 2ndChair — Deepgram Token Proxy
 * Returns Deepgram API key to authenticated clients.
 *
 * Required env vars:
 *   DEEPGRAM_API_KEY  — from console.deepgram.com
 *   APP_SECRET        — same secret used by auth.js
 */

const crypto = require('crypto');

const HEADERS = {
  'Content-Type':              'application/json',
  'Cache-Control':             'no-store',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
};

function respond(status, body) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify(body) };
}

function verifyToken(token) {
  try {
    const secret = process.env.APP_SECRET;
    if (!secret) return null;
    const [payload, sig] = (token || '').split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST')   return respond(405, { error: 'Method not allowed' });

  const token = (event.headers['x-auth-token'] || '').trim();
  if (!verifyToken(token)) {
    return respond(401, { error: 'Unauthorized' });
  }

  const dgKey = (process.env.DEEPGRAM_API_KEY || '').trim();
  if (!dgKey) {
    return respond(503, { error: 'deepgram_not_configured' });
  }

  return respond(200, { key: dgKey });
};
