# ER-Sync fix pass

## Blockers
- Added the missing hospital seed (`backend/data/seed/hospitals.json`, 10 simulated Lagos hospitals). Startup fails loudly if it is missing; reset returns a real error.
- `POST /emergencies` now triages, matches and dispatches (referral to hospital #1). New `/dispatch`, `/arrived`, `/close` routes.

## Workflow
- Referral response window enforced (TIMEOUT + auto failover); failover re-scores on live data.
- Accept requires a free bed (409) and reserves one bed per patient where possible.
- Case lifecycle: en route -> arrived -> closed, beds released.
- `PATCH /hospitals/{id}/beds` changes real bed rows (frontend +/- uses it).
- LIMITED ED status penalised; stale-data exclusion matches the docs (60 min, CRITICAL/HIGH).
- OSRM routing wired in with circuit-breaker fallback. AI factory import fixed.
- Reset cancels live cases; stats use real matching latency, real failover count, timed-out count.
- Notifications endpoint + Alerts panel.

## Security
- Header personas only in DEMO_MODE; anonymous = PATIENT (not admin); `X-Demo-Hospital` honoured.
- Staff can only answer referrals / update cases for their own hospital.
- Login was crashing (`user.verify_password` did not exist) - fixed. `/auth/demo-tokens` gated on DEMO_MODE.
- CORS no longer `*`; production secret key randomised.

## Frontend
- Score display fixed (was x100), also in the Explain modal.
- Hospital dashboard polls for new referrals, shows case severity/description/deadline, shows real server errors.
- Timestamps parsed as UTC (were an hour off in Lagos).
- Governor Command: live case status, retry/arrived/close buttons, alerts panel, honest offline states.
- Analytics: removed invented fallback numbers and the hard-coded "100% safety" card.
- Unused staff portal: canonical specialist/facility names, real bed endpoint.

## Tests
- 35 passing (was 17 passing, 3 failing). Added pytest-asyncio, isolated test DB, 15 API flow tests.
