/**
 * 2ndChair — Deepgram Token Proxy
 * Verifies Supabase JWT, returns Deepgram API key.
 *
 * Required env vars:
 *   DEEPGRAM_API_KEY     — from console.deepgram.com
 *   SUPABASE_JWT_SECRET  — from Supabase Project Settings → API → JWT Secret
 */

const { verifySupabaseToken } = require('./verify-supabase');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  const token = (event.headers['x-auth-token'] || '').trim();
  console.log('[deepgram-token] token length:', token.length);

  const payload = verifySupabaseToken(token);
  if (!payload) {
    console.error('[deepgram-token] invalid token');
    return {
      statusCode: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const dgKey = process.env.DEEPGRAM_API_KEY;
  if (!dgKey) {
    return {
      statusCode: 503,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'deepgram_not_configured' })
    };
  }

  console.log('[deepgram-token] success for user:', payload.email || payload.sub);
  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: dgKey })
  };
};
