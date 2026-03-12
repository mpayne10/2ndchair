/**
 * 2ndChair — Auth bridge (legacy endpoint, now just returns ok)
 * Real auth is handled by Supabase directly from the frontend.
 * This endpoint is kept so old references don't 404.
 */
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok: true })
});
