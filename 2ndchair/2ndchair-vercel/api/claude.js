/**
 * 2ndChair — Claude AI Proxy (Vercel)
 * POST /api/claude
 */
const crypto = require('crypto');

const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_OUT = 1000;
const SESSION_LIMIT  = 200_000;
const sessions       = {};

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

  const token = (req.headers['x-auth-token'] || '').trim();
  if (!verifyToken(token)) return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });

  const { messages, system, sessionId } = req.body || {};
  if (!messages || !sessionId) return res.status(400).json({ error: 'Missing required fields.' });

  const now = Date.now();
  if (!sessions[sessionId]) sessions[sessionId] = { tokens: 0, start: now };
  if (sessions[sessionId].tokens >= SESSION_LIMIT) return res.status(429).json({ error: 'Session token limit reached.' });
  for (const id in sessions) { if (now - sessions[id].start > 12*60*60*1000) delete sessions[id]; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured.' });

  try {
    const r = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS_OUT, system, messages }),
    });
    if (!r.ok) { console.error('[claude] Anthropic error:', r.status); return res.status(502).json({ error: 'AI service error. Please try again.' }); }
    const data = await r.json();
    sessions[sessionId].tokens += (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    return res.status(200).json({ content: data.content?.[0]?.text || '' });
  } catch(e) {
    console.error('[claude] error:', e.message);
    return res.status(502).json({ error: 'Connection error.' });
  }
};
