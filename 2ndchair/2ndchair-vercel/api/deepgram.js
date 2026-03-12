/**
 * 2ndChair — Deepgram Token Proxy (Vercel)
 * Exchanges DEEPGRAM_API_KEY for a short-lived temporary token.
 * The temp token is safe to use in browser WebSocket URLs.
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

  // Exchange API key for a short-lived temporary token via Deepgram REST API
  try {
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${dgKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        time_to_live_in_seconds: 30  // token valid for 30 seconds — enough to open WS
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[deepgram] token exchange failed:', response.status, err);
      return res.status(502).json({ error: 'Failed to get Deepgram token' });
    }

    const data = await response.json();
    console.log('[deepgram] temp token issued successfully');
    return res.status(200).json({ key: data.key });

  } catch(e) {
    console.error('[deepgram] fetch error:', e.message);
    return res.status(502).json({ error: 'Deepgram service error' });
  }
};
