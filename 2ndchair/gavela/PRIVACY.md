# Gavela.ai — Privacy & Data Flow

This document describes exactly what data Gavela.ai collects, processes, and stores. It is intended for:
- Attorneys evaluating Gavela for their practice
- Law firm IT/compliance reviewers
- SOC 2 auditors

---

## What Gavela Collects

### Data you enter
| Data | Where it goes | Stored? |
|---|---|---|
| State, county, case type, phase | Browser memory only (session modal) | ❌ No |
| Case facts, defense theory, witness names | Sent to Anthropic API as system prompt context | ❌ Not by Gavela |
| Your questions / transcript text | Sent to Anthropic API | ❌ Not by Gavela |
| AI responses | Displayed in browser, held in browser memory | ❌ No |

### Data we log (server-side)
Our Netlify function logs the following **only**:

```json
{
  "ts": "2025-01-15T14:32:01.000Z",
  "session": "sess_k3x9mq_1736950321000",
  "tokens_in": 1240,
  "tokens_out": 380,
  "session_total": 4500,
  "cost_usd_est": "0.000786"
}
```

**We do not log:** prompt content, case facts, attorney names, client names, questions asked, or AI responses. Ever.

---

## Anthropic (AI Provider)

All AI processing is performed by Anthropic's Claude API.

- **Data sent:** your system prompt (case context) + conversation messages
- **Anthropic's retention:** by default, Anthropic may retain API inputs/outputs for up to 30 days for safety purposes. Enterprise customers can request zero-retention via a Data Processing Agreement (DPA).
- **Action required:** Before onboarding paying attorney clients, the Gavela operator should request and sign Anthropic's **DPA** at [anthropic.com/legal](https://anthropic.com/legal).

---

## Netlify (Hosting)

Netlify hosts the frontend and serverless functions.

- Standard Netlify access logs (IP address, timestamp, HTTP method, path) are retained per Netlify's policy
- The `ANTHROPIC_API_KEY` is stored encrypted in Netlify's environment variable store
- Netlify SOC 2 Type II report available at [netlify.com/security](https://netlify.com/security)

---

## Attorney-Client Privilege

Gavela is a **legal research and analysis tool**, analogous to Westlaw or Clio. Use of Gavela does not waive attorney-client privilege over the underlying communications or case strategy.

- Case facts entered into Gavela are entered by the attorney as a tool for their own legal analysis
- Gavela does not store, sell, or share case information with third parties
- The attorney remains in control of what context they choose to provide

Attorneys should review their state bar's ethics opinions on use of AI tools and cloud services before use in active matters.

---

## Data Retention

| Data type | Retention |
|---|---|
| Browser session (case context, chat history) | Cleared on tab/browser close |
| Server-side audit logs (token counts only) | 90 days (Netlify log retention) |
| Anthropic API data | Per Anthropic's policy (~30 days default; 0 days with DPA) |

---

## Security Controls

- All traffic encrypted via TLS 1.3 (enforced by Netlify)
- Security response headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- API key stored in encrypted environment variables, never in code or logs
- Per-session rate limiting and token caps
- No third-party analytics or tracking scripts

---

## Contact

For privacy inquiries, data requests, or to request our DPA:
**privacy@gavela.ai** *(configure when domain is live)*
