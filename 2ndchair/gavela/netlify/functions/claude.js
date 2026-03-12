/**
 * Gavela.ai — Secure Claude Proxy
 * Netlify Serverless Function
 *
 * Security posture:
 *  - API key never exposed to client
 *  - Prompt content never logged (SOC 2 / attorney-client privilege)
 *  - Audit log: session ID + timestamp + token counts only
 *  - Per-session token limits (DoS / cost protection)
 *  - Security response headers on every response
 *  - Raw Anthropic errors stripped before returning to client
 *  - CORS locked to same origin in production
 */

const ANTHROPIC_API   = 'https://api.anthropic.com/v1/messages';
const MODEL           = 'claude-haiku-4-5-20251001';   // fastest for real-time courtroom use
const MAX_TOKENS_OUT  = 1000;
const SESSION_LIMIT   = 200_000;   // input tokens per session (~$0.50 max)

// Auth token verifier — Supabase JWT
const { verifySupabaseToken } = require('./verify-supabase');
function verifyToken(token) {
  return verifySupabaseToken(token);
}

// In-memory session store (resets on cold start — replace with Supabase for persistence)
const sessions = {};

// ── Security headers added to every response ──────────────────────────────
const SECURITY_HEADERS = {
  'Strict-Transport-Security':   'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options':      'nosniff',
  'X-Frame-Options':             'DENY',
  'X-XSS-Protection':            '1; mode=block',
  'Referrer-Policy':             'strict-origin-when-cross-origin',
  'Permissions-Policy':          'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':     "default-src 'none'; frame-ancestors 'none'",
  'Cache-Control':               'no-store',       // never cache AI responses
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, X-Session-ID, X-Auth-Token',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
    body: JSON.stringify(body),
  };
}

// ── Audit log — NO prompt content ever written ────────────────────────────
function auditLog(sessionId, tokensIn, tokensOut, sessionTotal) {
  const entry = {
    ts:           new Date().toISOString(),
    session:      sessionId,
    tokens_in:    tokensIn,
    tokens_out:   tokensOut,
    session_total: sessionTotal,
    cost_usd_est: ((tokensIn * 0.00000025) + (tokensOut * 0.00000125)).toFixed(6),
  };
  // Safe to log — contains zero prompt/response content
  console.log('[GAVELA AUDIT]', JSON.stringify(entry));
  // TODO: persist to Supabase audit_logs table when available
}

// ── Main handler ──────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: SECURITY_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  // API key guard
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[GAVELA] ANTHROPIC_API_KEY not set');
    return respond(500, { error: 'Service configuration error. Contact support.' });
  }

  // Auth token guard — every request must carry a valid session token
  const authToken = (event.headers['x-auth-token'] || '').trim();
  if (!authToken) {
    return respond(401, { error: 'Authentication required.' });
  }
  const authData = verifyToken(authToken);
  if (!authData) {
    return respond(401, { error: 'Session expired or invalid. Please log in again.' });
  }

  // Parse body
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid request format.' });
  }

  const { model, max_tokens, system, messages } = payload;

  // Basic validation — never trust client input
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return respond(400, { error: 'Missing messages array.' });
  }
  if (messages.length > 100) {
    return respond(400, { error: 'Conversation too long. Start a new session.' });
  }

  // Session tracking
  const sessionId = (event.headers['x-session-id'] || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'anon';
  if (!sessions[sessionId]) sessions[sessionId] = { tokens: 0, requests: 0, created: Date.now() };

  const sess = sessions[sessionId];

  // Rate limit: max 60 requests per session
  if (sess.requests >= 60) {
    return respond(429, { error: 'Session request limit reached. Please start a new session.' });
  }

  // Token limit guard
  if (sess.tokens >= SESSION_LIMIT) {
    return respond(429, {
      error: `Session token limit reached (${SESSION_LIMIT.toLocaleString()} tokens). Please start a new session.`,
      session_tokens: sess.tokens,
    });
  }

  // Forward to Anthropic — use server-side values, never trust client-sent model/tokens
  let anthropicRes, anthropicData;
  try {
    anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,                    // always server-controlled
        max_tokens: MAX_TOKENS_OUT,           // always server-controlled
        system:     system  || '',
        messages:   messages,
      }),
    });

    anthropicData = await anthropicRes.json();
  } catch (err) {
    // Never return raw upstream errors to client
    console.error('[GAVELA] Anthropic fetch error:', err.message);
    return respond(502, { error: 'AI service temporarily unavailable. Please try again.' });
  }

  // Handle Anthropic-level errors — strip details before returning
  if (!anthropicRes.ok || anthropicData.error) {
    const code = anthropicRes.status;
    console.error('[GAVELA] Anthropic error:', code, anthropicData.error?.type);

    const clientMessages = {
      401: 'Authentication error. Contact support.',
      429: 'AI service rate limit reached. Please wait a moment and try again.',
      529: 'AI service is overloaded. Please try again shortly.',
    };
    return respond(code === 429 ? 429 : 502, {
      error: clientMessages[code] || 'AI service error. Please try again.',
    });
  }

  // Tally tokens
  const tokensIn  = anthropicData.usage?.input_tokens  || 0;
  const tokensOut = anthropicData.usage?.output_tokens || 0;
  sess.tokens   += tokensIn + tokensOut;
  sess.requests += 1;

  auditLog(sessionId, tokensIn, tokensOut, sess.tokens);

  // Return response + session usage metadata (no content logged server-side)
  return respond(200, {
    content:       anthropicData.content,
    usage:         anthropicData.usage,
    session_tokens: sess.tokens,
    session_limit:  SESSION_LIMIT,
    stop_reason:   anthropicData.stop_reason,
  });
};
