/**
 * 2ndChair — Supabase Token Verifier
 * Validates token by calling Supabase's /auth/v1/user endpoint.
 * Simple, robust, no crypto needed on our side.
 *
 * Required env vars:
 *   SUPABASE_URL       — https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY  — anon/public key from Supabase dashboard
 */

async function verifySupabaseToken(token) {
  if (!token) return null;

  const url     = process.env.SUPABASE_URL || 'https://mwhdgtupytlepwawwzqn.supabase.co';
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!anonKey) {
    console.error('[verify] SUPABASE_ANON_KEY not set');
    return null;
  }

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
      }
    });

    if (!res.ok) {
      console.warn('[verify] Supabase rejected token, status:', res.status);
      return null;
    }

    const user = await res.json();
    if (!user?.id) return null;

    console.log('[verify] Token valid for user:', user.email);
    return user;
  } catch(e) {
    console.error('[verify] Supabase verification error:', e.message);
    return null;
  }
}

module.exports = { verifySupabaseToken };
