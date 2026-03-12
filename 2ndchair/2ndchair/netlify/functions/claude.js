/**
 * 2ndChair — Claude AI Proxy
 * Netlify Serverless Function
 *
 * Security:
 *  - API key never exposed to client
 *  - Prompt content never logged (attorney-client privilege)
 *  - Per-session rate limiting
 *  - Auth token validated on every request
 */

const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_OUT = 1000;
const SESSION_LIMIT  = 200_000; // tokens per session

const crypto = require('crypto');

// In-memory session store
const sessions = {};

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

const HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options':    'nosniff',
  'X-Frame-Options':           'DENY',
  'Cache-Control':             'no-store',
  'Content-Type':              'application/json',
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
};

function respond(status, body) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST')   return respond(405, { error: 'Method not allowed' });

  // Auth
  const token = (event.headers['x-auth-token'] || '').trim();
  const auth  = verifyToken(token);
  if (!auth) return respond(401, { error: 'Session expired or invalid. Please log in again.' });

  // Parse body
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid request.' }); }

  const { messages, system, sessionId } = body;
  if (!messages || !sessionId) return respond(400, { error: 'Missing required fields.' });

  // Rate limiting
  const now = Date.now();
  if (!sessions[sessionId]) sessions[sessionId] = { tokens: 0, requests: 0, start: now };
  const sess = sessions[sessionId];

  if (sess.tokens >= SESSION_LIMIT) {
    return respond(429, { error: 'Session token limit reached. Start a new session.' });
  }

  // Clean old sessions (> 12 hours)
  for (const id in sessions) {
    if (now - sessions[id].start > 12 * 60 * 60 * 1000) delete sessions[id];
  }

  // Call Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return respond(500, { error: 'AI service not configured.' });

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS_OUT, system, messages }),
    });

    if (!res.ok) {
      console.error('[claude] Anthropic error:', res.status);
      return respond(502, { error: 'AI service error. Please try again.' });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Track tokens
    sess.tokens   += (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    sess.requests += 1;

    console.log(`[claude] session=${sessionId} tokens=${sess.tokens} req=${sess.requests}`);
    return respond(200, { content: text });

  } catch(err) {
    console.error('[claude] fetch error:', err.message);
    return respond(502, { error: 'Connection error. Please try again.' });
  }
};
