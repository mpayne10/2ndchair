/**
 * 2ndChair — Auth API Route (Vercel)
 * POST /api/auth
 */
const crypto = require('crypto');

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) { crypto.timingSafeEqual(ba, ba); return false; }
  return crypto.timingSafeEqual(ba, bb);
}

function generateToken() {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error('APP_SECRET not set');
  const payload = Buffer.from(JSON.stringify({ iat: Date.now(), exp: Date.now() + 12*60*60*1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { APP_PASSWORD, APP_SECRET } = process.env;
  if (!APP_PASSWORD || !APP_SECRET) return res.status(500).json({ error: 'Auth service not configured.' });

  const { password = '' } = req.body || {};
  if (!safeCompare(password, APP_PASSWORD)) return res.status(401).json({ error: 'Incorrect password.' });

  try {
    return res.status(200).json({ token: generateToken() });
  } catch(e) {
    return res.status(500).json({ error: 'Auth error.' });
  }
};
