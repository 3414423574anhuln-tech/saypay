# SayPay — payment intent drafts and sandbox service

**Say it. Review it. Pay it.**

This Astro SSR + TypeScript app for Cloudflare Workers has two separate paths: **W2 intent parsing** produces an unpaid draft or a clarification question at `/parse`; the **W1 manual sandbox form** at `/` performs PayPal create/approve/capture with API-verified status pages and server-side token caching.

The product confirmation card, audit persistence, amount-cap enforcement, injection demo UX and public deployment remain later stages. Parsing has **no path to PayPal order creation**: there is no confirmation/pay button, automatic form population, stored draft or payment API call in W2. The manual payment path does not import a parser or require LLM configuration. The [W1 recovery packet](W1-RECOVERY.md) and [W2 packet](W2-PACKET.md) record the stage contracts.

**W1 accepted and pushed:** the real application completed its one USD 10.00 sandbox acceptance order after user-performed buyer approval. Independent read-only GET verified `COMPLETED`, matching submitted fields and transaction ID `3K382600KB1662720` (order `6CJ230299F372393H`). Joint W1 review passed; commit `1c3a994` is on remote main. The earlier standalone smoke test is not this application's receipt. `docs/W1-REPORT.md` retains the pre-commit evidence snapshot; the accepted ruling is recorded in the W2 packet.

**W2 acceptance status:** mocked parsing checks and real English/Chinese/missing-field cases pass, including a real clarification answer round-trip with the user's configured DeepSeek service. The results remain unpaid drafts. See `docs/W2-REPORT.md` for separate mock/real evidence, earlier failures and the pending joint review. No public deployment is claimed.

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

## W2: parse an intent or clarify missing facts

The W1 setup above still works without LLM credentials. To test W2, add these **three empty-template names** to the same root `.env` and fill their values locally:

```dotenv
LLM_API_BASE=
LLM_API_KEY=
LLM_MODEL=
```

Use an OpenAI-compatible API base (including its version path when required), API key and model that support JSON-schema-constrained output. For the official DeepSeek hostname, the server appends `/responses` and sends the schema in `text.format`; other compatible bases use `/chat/completions` with `response_format`. Both requests specify JSON Schema and `strict: true`, with the same committed schema and validation. Parameters are read exclusively on the server; do not send values through chat, commit them, or show them in screenshots. No default provider or model is selected. Restart `npm run dev` after editing `.env`.

The client uses manual redirect handling and rejects all 3xx responses before using their body or issuing another request. Responses are limited to 128,000 bytes while reading. This preserves the credential boundary and works with the local workerd runtime. A compatible API shape alone does not establish JSON-schema support: if the service rejects the schema format, resolve that compatibility before acceptance; do not downgrade to plain JSON output. [DeepSeek's Responses reference](https://api-docs.deepseek.com/api/create-response/) documents JSON-schema text output, and its [compatibility guide](https://api-docs.deepseek.com/guides/responses_api/) documents stateless requests. W2 sends original intent and ordered answers on each call, with no tools or stored conversation.

1. Open **`http://localhost:4321/parse`**. Enter an English or Chinese intent with a recipient, exact amount and currency, plus any purchase/note.
2. Submit **Generate draft only**. The server calls the configured LLM with the committed prompt and schema, then validates the result. The page displays the Section 6 fields as **DRAFT — not paid**. These fields are read-only and cannot create an order.
3. If required information is missing or ambiguous, the result is a clarification question with **no draft**. Answer it and submit **Re-parse intent with answer**. The request carries the original intent and ordered answers each time; W2 stores no conversation or draft. Start a new intent after eight answers.
4. An unknown payee email stays empty. It may be filled at the later confirmation stage; the parser does not guess one. API failures and invalid outputs show a stage, safe original provider code when available, and a plain-language reason. Refusal, incomplete output, invalid schema and total mismatch do not fabricate a draft or silently fall back to JSON mode.

Monetary validation uses integer cents and recomputes `total` from quantity × unit amount. Input/output source checks reject unsupported amounts, emails, quantities and notes; common missing/vague facts produce clarification. Notes retain their original wording. These checks cover the documented English/Chinese fixtures, not every possible linguistic interpretation; inspect the draft rather than treating model confidence as verified correctness.

The parsing layer recognizes explicit amount-override instructions, removes recognized snippets from extraction input, retains `injection_flags`, and blocks induced amount changes. This is W2 parsing correctness. There are no demo buttons, amount cap or payment integration; those stages remain closed. The strict-output request and refusal handling follow [official OpenAI documentation](https://developers.openai.com/api/docs/guides/structured-outputs); other compatible providers still require real acceptance verification.

## W1: create → approve → capture → final GET

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

Run the checks with the dev server stopped, then restart it before app verification.

```sh
npm test
npm run check
npm run deploy:check
npm run scan:secrets
```

Service tests use explicit mocked responses. W1 tests cover token caching and API reconciliation. W2 tests cover normal English/Chinese drafts, missing/vague facts, stateless clarification round-trips, integer-cent recomputation, schema violations, the specified tampering fixture, provider errors, and the complete parsing import graph's payment boundary. They do not constitute real API evidence.

The secret scanner checks current tracked/nonignored files, staged changes, and every file in every reachable commit for selected credential patterns and forbidden `.env`/`.dev.vars` paths. It also compares any configured PayPal credentials and `LLM_API_KEY` against those files and built output in memory. It reports filenames/codes, never candidate values. A clean scan is not a guarantee against every possible secret format. `.env.example` contains empty credential templates and may be committed.

## Worker shape and stage gate

`wrangler.jsonc` selects the official Astro Cloudflare entrypoint and static assets. There are no D1, KV, or audit bindings. Astro sessions are disabled. Workers logs contain stage/error codes, not credentials; incoming request logs are disabled. `deploy:check` packages locally and does not deploy.

The build configuration removes Cloudflare's generated preview `.dev.vars` asset before writing output. Local credentials remain in the root `.env`; the secret scanner also checks built output against those values. Use `npm run dev` for the credentialed W1 acceptance run. Built preview does not receive a duplicate local credential file.

The lockfile overrides Miniflare's `sharp` dependency to `0.35.5`, the patched release named in the [maintainer's security advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). This keeps the selected Astro/Workers versions while removing the reported vulnerable image dependency.

W1 passed joint review and was pushed. W2 must pass its acceptance checklist and joint Muse + Sol review before its commit is pushed or W3 begins. The MIT license remains at the repository root.
