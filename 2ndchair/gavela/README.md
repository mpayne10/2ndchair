# Gavela.ai ⚖

**Real-time courtroom AI assistant for defense attorneys.**

Gavela listens to or receives courtroom statements and instantly surfaces objections, relevant case law, strategy, rebuttals, and warnings — all as the hearing unfolds.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS + HTML/CSS (zero build step) |
| Hosting | Netlify |
| Backend proxy | Netlify Serverless Function (`netlify/functions/claude.js`) |
| AI model | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Auth (planned) | Clerk |
| Payments (planned) | Stripe ($79/month per seat) |
| Usage DB (planned) | Supabase (persist token usage + audit logs) |

---

## Project Structure

```
gavela/
├── public/
│   └── index.html              ← entire frontend (single file, no framework)
├── netlify/
│   └── functions/
│       └── claude.js           ← secure proxy — API key never touches client
├── netlify.toml                ← routing + security headers
├── package.json
├── .env.example                ← copy to .env for local dev
├── .gitignore
└── README.md
```

---

## Local Development

```bash
# 1. Install Netlify CLI
npm install

# 2. Create your local env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 3. Run locally (serves frontend + functions together)
npm run dev
# → http://localhost:8888
```

---

## Deploy to Netlify

### Drag & Drop (quickest)
1. Zip the `gavela/` folder
2. Go to [netlify.com/drop](https://netlify.com/drop) and drag the zip
3. Go to **Site Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
4. Trigger a redeploy

### GitHub (recommended for production)
1. Push this repo to `github.com/Mpayne10/gavela`
2. Connect repo in Netlify dashboard
3. Add `ANTHROPIC_API_KEY` environment variable
4. Auto-deploys on every push to `main`

---

## Security Architecture

### API Key Protection
The Anthropic API key lives **only** in Netlify's encrypted environment variables. Every AI call flows:

```
Browser → /api/claude (same origin) → Netlify Function → Anthropic API
```

The key is never in the frontend, never in the repo, never in logs.

### SOC 2 Readiness

The proxy function implements:

| Control | Implementation |
|---|---|
| Encryption in transit | Netlify enforces HTTPS / TLS 1.3 |
| No prompt content logging | Audit log captures session ID + token counts only |
| Security response headers | HSTS, CSP, X-Frame-Options, nosniff on every response |
| Session token limits | 200k tokens/session max (configurable) |
| Request rate limiting | 60 requests/session max |
| Error sanitization | Raw Anthropic errors stripped before returning to client |
| Cache control | `no-store` on all AI responses |

### Attorney-Client Privilege
- Case facts entered in the setup modal are sent to Anthropic's API as part of the system prompt and are **not stored** by Gavela
- Prompt content is **never written to logs** (only token counts)
- Review Anthropic's [Privacy Policy](https://www.anthropic.com/privacy) and request their **Data Processing Agreement (DPA)** before onboarding paying attorney clients
- See `PRIVACY.md` for the full data flow description

---

## Roadmap

- [ ] Clerk auth — login/signup, protect proxy
- [ ] Stripe — $79/month subscription + webhooks
- [ ] Supabase — persist token usage + audit logs across cold starts
- [ ] Gate proxy — verify Clerk session token in `claude.js` before forwarding
- [ ] Electron wrapper — desktop app for better mic reliability
- [ ] Web Speech API integration — live microphone transcription

---

## Cost Estimate

| Usage | Monthly API Cost |
|---|---|
| 20 sessions/month (typical attorney) | ~$2–5 |
| Selling price | $79/month |
| Gross margin | ~95% |

Model: Claude Haiku — 3–4x faster than Sonnet, optimized for real-time use.
