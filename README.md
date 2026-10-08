# SayPay — say it, review it, pay it

Astro SSR + TypeScript on Cloudflare Workers. The workspace at `/parse` turns an English or Chinese payment intent into a stored AI draft, lets a human edit and confirm it, opens PayPal sandbox approval, and shows completion only after final API read-back. The manual sandbox form remains at `/`.

W1–W3 passed joint review and were pushed (`1c3a994`, `a2a1db9`, `f78cc50`). See [the historical W3 report](docs/W3-REPORT.md) for separate evidence and retained failed attempts. W4 adds sample presentation, a configured payee allowlist and public sandbox deployment; mock and real public acceptance are complete, with joint review pending before push. The stage contracts are [W1 recovery](W1-RECOVERY.md), [W2](W2-PACKET.md), [W3](W3-PACKET.md), [W3 reconciliation](W3-RECONCILIATION.md) and [W4](W4-PACKET.md). Submission copy, video and final README preparation remain W5.

## Fresh-clone setup

Use Node.js 22.12+ and npm (local checks use Node 24). Clone into a new folder and install the pinned dependencies:

```sh
npm ci
```

Copy the empty template once. In PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

Fill these names locally in the root `.env`:

```dotenv
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
LLM_API_BASE=
LLM_API_KEY=
LLM_MODEL=
```

PayPal values must belong to the same **sandbox** REST app. LLM values must select an OpenAI-compatible service/model supporting strict JSON Schema output. No model or provider is chosen by the application. No LLM values are needed for the W1 manual path. Never commit, print, screenshot or send credential values through chat. Do not create a competing `.dev.vars` file.

`APP_URL` defaults to `http://localhost:4321`. `MAX_TRANSACTION_USD` defaults to `200` if omitted; the template restores that historical name. A supplied malformed, nonpositive or non-cent-exact cap blocks payment configuration. The cap is configuration, not a credential. Restart after changing `.env`.

`SANDBOX_PAYEE_ALLOWLIST` is optional: comma-separated sandbox merchant emails, empty/omitted for unrestricted local development. Configured entries are validated and normalized case-insensitively; malformed configuration blocks payment creation. With a configured list, a different merchant is rejected before create on both draft and manual paths. Draft confirmation records BLOCKED with `PAYEE_NOT_ALLOWLISTED`; manual validation uses its existing error view.

```sh
npm run types
npm run dev
```

Open **http://localhost:4321/parse**. Keep that exact origin: the browser, `APP_URL`, return URLs and cancel URLs must agree. Local strict-port checking exits if the port is occupied. Cloudflare documents local env loading in its [secrets guide](https://developers.cloudflare.com/workers/configuration/secrets/).

## W3 workspace: draft → confirmation → sandbox approval → final GET

1. Enter a recipient, exact amount and currency, purchase and note; select **Generate draft only**. Parsing cannot create an order. Missing or vague required facts produce a clarification question. Answers append to the server-stored original intent and history; the browser cannot replace them. After eight answers, start a new combined intent.
2. Review the editable **DRAFT — not paid** card: payee name/email, items, quantities, unit amounts, currency, total, note, confidence, ambiguities and parsing flags. Confidence is an uncalibrated model estimate. An unknown merchant email stays empty until you fill it. **Validate edits only** persists validated edits without creating an order.
3. W3 executes **USD only**. A non-USD draft keeps its original currency and is visibly blocked. A deliberate currency edit to USD is recorded alongside the original AI currency; no conversion occurs. Both the card and server pre-create validation use one integer-cent cap policy. An over-cap attempt records BLOCKED with cap/attempted amount and creates no order. The same server cap applies to the W1 manual write path.
4. Select **Confirm and open PayPal sandbox**. The server retrieves the draft by ID and validates only the allowed visible edits. It recomputes quantity × unit amount, rejects a posted-total mismatch, validates the payee email, USD currency, cap and PayPal purpose length. Forged execution/AI metadata is rejected. A persisted confirmed snapshot and atomic revision claim precede order creation; stale or double-clicked confirmations do not create another order.
5. The buyer logs in and approves on PayPal using a **Personal sandbox account**. Use test money only. Buyer and Business sandbox account roles are described in [PayPal's sandbox guide](https://developer.paypal.com/sandbox-testing/accounts). The app does not perform buyer approval.
6. PayPal returns to `/workspace/return?draftId=ID&token=ORDER_ID`. The server GETs and reconciles the order against its signed fields and stored confirmed snapshot. Capture runs only for APPROVED. A further GET must verify COMPLETED and one matching completed capture before the card shows completion and transaction/capture ID.
7. **Read PayPal status only** uses `/workspace/status`; it never captures. If sandbox checkout loops, use the existing order token in the recovery view, read status and explicitly finish an approved order. The checkout page's appearance is not authoritative. A completed callback can be refreshed without another capture.
8. `/workspace/cancel` records browser checkout cancellation and never calls capture. It does not void or delete the PayPal order. A W3 cancelled record cannot be completed through its W3 return action. Concurrent capture/cancel actions surface a plain pending-capture error rather than claiming cancellation undid a payment.

A create timeout can leave an unknown outcome. The confirmed snapshot remains stored; recover the existing token with a read-only GET rather than submitting a replacement. A capture claim remains pending for two minutes; read status first, and explicitly finish again if still approved after that interval. Retries reuse W1's stable capture request ID. This is not a claim of global exactly-once delivery. A provider failure shows its stage and safe original code; audit records retain the failure stage. A storage outage leaves the last successfully persisted snapshot available when storage recovers and shows an error, never fake success.

For real W3 acceptance, use three labelled intents: normal (edit at least one card field before confirmation), missing amount (answer the question, then confirm), and above-cap (no approval or order). The first two each require a human sandbox buyer approval. Inspect all three audit records after refresh and dev-server restart.

## Draft and audit storage

`DraftStore` is a small interface for create/get/revision-checked replace/list. The backing store is **one SQLite-backed Durable Object per anonymous browser workspace**, using its key/value API to store JSON draft/audit records and a paginated index. There is no D1 database, user account system, shared global journal or credential in these records. [Cloudflare's storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) documents synchronous KV and atomic transactions; [Astro's Cloudflare integration](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) supports the custom Worker entrypoint exporting the object class.

Local `astro dev` keeps this state under `.wrangler/state/v3/do/`, which is ignored by Git. Page refresh and restarting from the same checkout/state directory preserve records. Deleting local state, using a fresh clone or another browser workspace does not recover that journal. The HttpOnly, SameSite=Lax workspace cookie expires after 30 days; clearing it loses this browser's lookup. It is an anonymous lookup capability, not a user login. Records are not automatically purged; 20 entries display per page, with older-entry navigation. Each serialized intent has a 128,000-byte limit. Existing JSON remains if a larger replacement is rejected. Credentials are read only from server env; configured credential strings are blocked from intent/draft/audit content.

The W4 public Worker provisions the same journal class remotely through the existing binding/migration in `wrangler.jsonc`. Its acceptance records remain available after page refresh in the same browser workspace. Local and remote journals are separate; local persistence is not an exported backup.

## Retained W2 parser guarantees and limits

The core parser still sends the settled closed schema with `strict: true` and validates independently. On the official DeepSeek hostname it uses `/responses` with `text.format`; other compatible hosts use `/chat/completions` with `response_format`. No plain-JSON downgrade, fallback provider or model is selected. The client rejects 3xx without forwarding credentials and bounds provider responses at 128,000 bytes. See [DeepSeek's Responses reference](https://api-docs.deepseek.com/api/create-response/) and [stateless compatibility guide](https://api-docs.deepseek.com/guides/responses_api/). The structured-output request follows [OpenAI's documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

Validation uses integer cents and source checks for supported amounts, recipients, quantities, notes and explicit override snippets. Structured output constrains shape, not semantic truth; these language recognizers cover the documented fixtures, not every interpretation or injection. Inspect the card. Parser output remains currency-agnostic, including a legitimately stated USD 1000 draft; W3's execution policy blocks that draft downstream. The historical read-only W2 draft component is reused only for audit snapshots.

## W1 manual fallback and reconciliation

At `/`, enter the actual sandbox merchant email, USD amount and purpose, then deliberately create the order. The shared cap now also runs before this manual create handler. Other manual fields and W1 API reconciliation are retained. `/return?token=ORDER_ID` verifies signed submitted fields, captures only if APPROVED, then GETs again. `/status?token=ORDER_ID` only reads; `/cancel` only shows browser cancellation. Manual validation rejections do not create W3 intent audit records.

The W1 signature in PayPal `custom_id` binds payee, amount, currency, purpose and reference to a key derived from the existing app credentials. Orders lacking a valid binding cannot be captured by this flow. Rotating credentials makes earlier tags unverifiable. W3 additionally compares the API read-back to its stored confirmed snapshot. Metadata fields are documented in [PayPal's Orders specification](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json).

OAuth tokens are cached in server memory, refreshed 60 seconds before expiry, reused across calls in the same Worker process and reset on restart. The app always uses `https://api-m.sandbox.paypal.com`. W1's accepted real receipt remains order `6CJ230299F372393H`, capture `3K382600KB1662720`; it is separate from W3 evidence.

## Verification and Worker shape

Stop the dev server before checks, then restart for browser acceptance:

```sh
npm test
npm run check
npm run deploy:check
npm run scan:secrets
```

Mocks are labelled separately from actual service evidence. They cover W1 reconciliation/token caching, retained W2 bilingual/schema/source validation, W3 full edited and clarified flows, forged metadata, total mismatch, direct crafted-POST cap bypass, manual-handler cap enforcement, audit read-back, cancellation, failures, stale confirmations and concurrent capture claims.

The scanner compares locally available `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `LLM_API_KEY` and `CLOUDFLARE_API_TOKEN` values in memory against current publishable files, staged content, built output and every file version in reachable Git history; it also checks selected patterns, dotenv assignments and forbidden secret-file paths. It reports codes/paths, never values. W4 acceptance additionally scans local journal state, Wrangler logs, ignored evidence and deployment configuration. Screenshots are visually inspected and exclude configured account addresses. A clean scan does not establish detection of every secret format. `.env` is ignored; `.env.example` has empty credential fields. The build removes generated preview `.dev.vars` before output is written, so local credentials remain only in root `.env`.

`src/worker.ts` exports `DraftJournal` and delegates HTTP requests to Astro's Cloudflare handler. `wrangler.jsonc` configures that entrypoint, static assets and the SQLite-backed object migration. Astro sessions and incoming-request logs are disabled. `deploy:check` builds and packages locally without deploying. No new libraries were added for W3. The existing pinned `sharp` override follows the [maintainer's security advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

The accepted W1–W3 report snapshots remain in `docs/`. The MIT license remains at the root. W4 requires its mock/real acceptance and joint review before its commit is pushed. W5 remains closed.

## W4 samples and deployment preparation

The workspace offers three sample buttons: complete USD 10, missing amount, and the exact malicious amount-replacement instruction. Selection only fills the input; it does not parse, confirm or create. The malicious sample uses the existing parser recognizer, retains USD 10, and displays the exact offending snippet with a plain-language warning. The detector is fixture-scoped, not proof against all injections. Existing amount/currency policy remains the independent backstop; W2 induced-output and W3 over-cap evidence are retained.

Configured sandbox shortcuts fill a payee email and submit **Validate edits only**, keeping the original AI draft and the explicit edit in the audit. They do not map Bob to an email or authorize a payment. Sample filling and shortcuts use small browser scripts; all server forms remain usable without JavaScript. An email-only intent can keep the display name empty; a conflict about recipient identity still requires clarification. Invalid provider JSON remains a staged FAILED record with no fallback or invented draft.

Public demo: **[SayPay sandbox workspace](https://saypay.3414423574anhuln.workers.dev/parse)**. The Worker and remote journal are provisioned, and the owner has entered the five encrypted server bindings. Normal and amount-tampering runs each completed a human-approved USD 10.00 payment, independently verified with PayPal GET. The demo runs entirely on PayPal sandbox fake money. This is not live payment processing.

Deployment secrets are entered interactively by the account owner, never copied to Cloudflare by the assistant. See [deployment steps](docs/W4-DEPLOYMENT.md). All deploys must supply the public `APP_URL`, sandbox environment, USD 200 cap and the existing sandbox merchant allowlist; the source config intentionally keeps local defaults. No LLM base/model/key or PayPal credential value belongs in the repo.
