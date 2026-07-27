# VitalStay — Stage 2A Persistence Patch

This patch adds persistent storage to the Stage 1 backend using Upstash Redis REST / Vercel KV-style environment variables.

## New Capabilities

- 24-hour raw signal cache with TTL
- Recommendation history with 30-day TTL
- Duplicate-prevention keys with 24-hour TTL
- Audit events for consent, suppression, recommendation generation, and duplicate prevention
- Admin state endpoint
- Admin audit endpoint

## Required Environment Variables

These should already exist from the Upstash/Vercel integration:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

Do not put real token values in GitHub.

## Files Added

```text
api/_lib/store.js
api/_lib/audit.js
api/_lib/retention.js
api/_lib/history.js
api/admin/state.js
api/admin/audit.js
```

## Files Updated

```text
api/process-guest.js
api/process-all.js
```

## Test URLs After Deploy

```text
https://vitalstay.vercel.app/api/admin/state
https://vitalstay.vercel.app/api/admin/audit
https://vitalstay.vercel.app/api/process-guest?guest=g1
https://vitalstay.vercel.app/api/process-all
```

## Expected Behavior

First run generates recommendations and stores them. A second run on the same day should drop duplicates with reason:

```text
Duplicate recommendation already generated today
```

Raw signal records automatically expire after 24 hours.
