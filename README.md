# SayPay — W1 payment service

**Say it. Review it. Pay it.**

This checkout implements the W1 **manual PayPal sandbox payment chain**. It has an Astro SSR + TypeScript scaffold for Cloudflare Workers, server-side OAuth token caching, create/get/capture wrappers, a plain manual order form, and API-verified status pages.

AI parsing, the product confirmation card, injection demonstrations, and audit persistence are later stages. This W1 path does not import a parser, read LLM settings, or require a database. The [W1 recovery packet](W1-RECOVERY.md) is the execution contract for this recovery.

**Acceptance status:** the real application completed its one USD 10.00 sandbox acceptance order after user-performed buyer approval. The return handler completed capture, and an independent read-only PayPal GET verified `COMPLETED`, the matching submitted fields, and transaction ID `3K382600KB1662720` (order `6CJ230299F372393H`). Joint W1 review remains pending. The earlier standalone sandbox smoke test is prior evidence; it is not a receipt from this application. Mock tests, type checks, build checks, and real evidence are reported separately in `docs/W1-REPORT.md`. No public deployment is claimed.

## Fresh-clone setup

Use Node.js 22.12+ and npm (tested with Node 24). Clone this repository into a new folder, then run:

```sh
npm ci
npm run types
```

Copy `.env.example` to `.env`. In PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

Fill **only these two required secrets** locally:

```dotenv
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
```

Use the Client ID and Secret of your PayPal **sandbox** REST app. Values must never be committed, printed, shown in screenshots, or sent through chat. No LLM key is needed for W1.

Start the app:

```sh
npm run dev
```

Open **`http://localhost:4321`**. The Worker configuration defaults `APP_URL` to this exact origin. Do not switch to `127.0.0.1` or silently use another port: the browser origin, `APP_URL`, and return/cancel URLs must match. The local server uses strict port checking and exits when its port is occupied; stop the conflicting process or explicitly change the origin before testing. Local `.env` loading is supported by [Cloudflare's tools](https://developers.cloudflare.com/workers/configuration/secrets/); do not create a competing `.dev.vars` file.

## Reproduce create → approve → capture → final GET

1. On the manual form, enter the **actual sandbox merchant/payee email**, amount (USD 10.00 for the W1 acceptance run), currency fixed to USD, and an English purpose. All fields are visible before order creation. PayPal describes buyer/personal and merchant/business sandbox accounts in its [sandbox account guide](https://developer.paypal.com/sandbox-testing/accounts).
2. Deliberately submit **Create sandbox order and open PayPal**. The server validates the form, creates a CAPTURE-intent sandbox order, and redirects to PayPal's sandbox approval URL. It does not approve the order.
3. The buyer performs sandbox login and approval using a sandbox buyer account, separately from the server credentials. Never use a real-money checkout.
4. PayPal returns to `/return?token=ORDER_ID`. This `token` is the order recovery mechanism. The server GETs that order and verifies its authenticated submitted fields. Only `APPROVED` permits capture. It then GETs the order again; only a final `COMPLETED` order with a matching completed capture shows success and a **transaction/capture ID**.
5. Save the displayed **order ID, transaction ID, and final API status** as real acceptance evidence. Refreshing a completed return performs GET verification without sending a new capture request.
6. If checkout loops, copy the order token from its URL and use the form's **Read an existing order** lookup. `/status?token=ORDER_ID` reads only and never captures. If the API reports `APPROVED`, use its explicit approved-order completion link. The browser's appearance does not establish the order state.
7. `/cancel` shows a cancelled checkout and never calls capture. It does not claim that PayPal voided or deleted the order; the optional status link remains read-only.

An unresolved create timeout is not safe proof that no order exists. Check the sandbox dashboard before creating a replacement. A pending or malformed capture never displays success. API failures show their stage and original error code, without raw credential-bearing responses.

## No local order persistence

The PayPal return token locates the order after a server restart. To verify that the payee, amount, currency, purpose, and reference still match what this app submitted, create includes an HMAC tag in PayPal's `purchase_units[].custom_id`. The server derives a domain-separated signing key from its existing sandbox app credentials; it needs no additional secret or browser cookie.

The GET response must carry fields matching that tag before capture. The final capture amount must also match. An order created elsewhere without the binding tag is rejected. This metadata is an integrity check, not a locally stored order/audit record. It uses fields documented in [PayPal's Orders specification](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json). Rotating the app credentials makes earlier tags unverifiable; finish the W1 run with unchanged credentials.

The OAuth cache holds only completed token strings in server memory, refreshed 60 seconds before expiry. It is reused across API calls in the same Worker process and resets when that process restarts. Capture requests use a stable request ID derived from the order reference. The app never requests a live PayPal base URL.

## Focused verification

```sh
npm test
npm run check
npm run deploy:check
npm run scan:secrets
```

Service tests use explicit mocked responses. They cover token request counts and refresh, GET/APPROVED/capture/GET sequencing, changed submitted fields, pending captures, and read-only status behavior. They do not constitute real sandbox evidence.

The secret scanner checks current tracked/nonignored files, staged changes, and every file in every reachable commit for selected credential patterns and forbidden `.env`/`.dev.vars` paths. If `.env` is configured locally, it also compares the two PayPal credential values against those files and built output in memory. It reports filenames/codes, never candidate values. A clean scan is not a guarantee against every possible secret format. `.env.example` is an intentionally empty template and may be committed.

## Worker shape and stage gate

`wrangler.jsonc` selects the official Astro Cloudflare entrypoint and static assets. There are no D1, KV, or audit bindings. Astro sessions are disabled. Workers logs contain stage/error codes, not credentials; incoming request logs are disabled. `deploy:check` packages locally and does not deploy.

The build configuration removes Cloudflare's generated preview `.dev.vars` asset before writing output. Local credentials remain in the root `.env`; the secret scanner also checks built output against those values. Use `npm run dev` for the credentialed W1 acceptance run. Built preview does not receive a duplicate local credential file.

The lockfile overrides Miniflare's `sharp` dependency to `0.35.5`, the patched release named in the [maintainer's security advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). This keeps the selected Astro/Workers versions while removing the reported vulnerable image dependency.

All W1 work must pass the recovery packet's acceptance checklist and joint Muse + Sol review before pushing or starting W2. The MIT license remains at the repository root.
