/**
 * 2ndChair — Deepgram Token Proxy (Vercel)
 * Returns the Deepgram API key for use in browser WebSocket URLs.
 * The key is never exposed in client-side code — only fetched at mic-start
 * via an authenticated server request.
 * POST /api/deepgram
 */
const crypto = require('crypto');

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Verify app session
  const token = (req.headers['x-auth-token'] || '').trim();
  if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });

  const dgKey = (process.env.DEEPGRAM_API_KEY || '').trim();
  if (!dgKey) return res.status(503).json({ error: 'deepgram_not_configured' });

  // Return the key directly — it's protected behind auth and never in client code
  return res.status(200).json({ key: dgKey });
};
