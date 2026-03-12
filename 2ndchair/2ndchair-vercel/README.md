# 2ndChair — AI Litigation Command Center

Real-time AI analysis for defense attorneys. Live transcript, instant objections, case law, and strategy during trial.

## Deploy to Netlify

1. Drag `2ndchair.zip` to [netlify.com/drop](https://netlify.com/drop)
2. Go to **Site Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `APP_PASSWORD` | Your chosen access password |
| `APP_SECRET` | Random 64-char hex string (see below) |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `DEEPGRAM_API_KEY` | From console.deepgram.com |

Generate `APP_SECRET`:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Redeploy (drag zip again) after adding env vars

## File Structure

```
2ndchair/
├── public/
│   ├── index.html          ← Landing page
│   └── app.html            ← The app (password-gated)
├── netlify/functions/
│   ├── auth.js             ← Login: validates APP_PASSWORD, issues token
│   ├── claude.js           ← AI proxy: validates token, calls Anthropic
│   └── deepgram.js         ← Mic proxy: validates token, returns DG key
├── netlify.toml            ← Routing + security headers
└── .env.example            ← Required env vars
```

## How Auth Works

Simple HMAC token system — no database, no Supabase, nothing to break:

1. User enters `APP_PASSWORD` in the login screen
2. `auth.js` compares it to the env var, issues a signed 12-hour token
3. Every API call sends that token in `X-Auth-Token`
4. `claude.js` and `deepgram.js` verify the signature using `APP_SECRET`

## Persistent Storage

- **Theme** (dark/light): `localStorage` key `2ndchair-theme`
- **Case context** (jurisdiction, case type, facts): `localStorage` key `2ndchair-context`
- **Previous session**: `localStorage` key `2ndchair-prev-session`
- **Auth session**: `sessionStorage` key `2ndchair-auth` (clears on tab close)
