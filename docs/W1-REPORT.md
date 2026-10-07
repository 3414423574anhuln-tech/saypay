# SayPay W1 recovery — implementation and pre-commit evidence report

To: Muse + Sol (joint planning/review layer)

**Status: the W1 implementation and real application sandbox chain are verified. Order `6CJ230299F372393H` completed after user-performed buyer approval. A separate read-only GET confirmed `COMPLETED`, matching submitted fields and capture `3K382600KB1662720`. This is the pre-commit evidence snapshot; the exact commit hash and full post-commit scan will be recorded in the local final delivery file `F:\saypay-w1\artifacts\W1-FINAL-REPORT.md`. Joint Muse + Sol review is pending; no push or public deployment has occurred.** All implementation work is in `F:\saypay-w1`. The previous `F:\saypay` folder remains the read-only source archive. Preserved later-stage work was not carried into this checkout.

The authoritative specification is the supplied v1.1 attachment. As R2 requires, no root `PROJECT-SPEC.md` was added. `W1-RECOVERY.md` contains the recovery packet; the README now describes only the manual W1 chain.

## (a) Checkout verification

Recorded before any selective port, after cloning into the previously nonexistent `F:\saypay-w1`:

```text
> git status --short --branch
## main...origin/main

> git log --oneline
c1423b0 docs: initial README and .env.example
eb8e481 Initial commit

> git remote -v
origin  https://github.com/3414423574anhuln-tech/saypay.git (fetch)
origin  https://github.com/3414423574anhuln-tech/saypay.git (push)
```

The two-commit ancestry and remote were checked again before the W1 commit. `git diff --cached --name-only` is empty. `LICENSE` is unchanged. No initialization, history rewrite, force push, or clone into the archive occurred.

## (b) Exact selective port and additional W1 files

All destination paths below are relative to **`F:\saypay-w1\`**. This inventory was reported before staging and names the W1-only publishable change set.

Eight files were initially copied individually from the same relative paths under `F:\saypay\`, then narrowed where necessary:

| Destination | W1 justification / final treatment |
| --- | --- |
| `astro.config.mjs` | Astro SSR with the Cloudflare adapter; sessions disabled, strict local ports, generated preview secret asset excluded before disk output. |
| `package.json` | Fixed Astro/TypeScript/Workers tools and W1 commands; removed database commands. |
| `package-lock.json` | Reproducible dependency installation; updated for the security override below. |
| `tsconfig.json` | Strict Astro/TypeScript checking. |
| `wrangler.jsonc` | Workers entrypoint/assets/local origin; removed D1 and later-stage bindings. |
| `worker-configuration.d.ts` | Regenerated with `npm run types`; final project bindings are ASSETS and APP_URL. Generator trailing whitespace normalized. |
| `src/env.d.ts` | Astro types only; removed later-stage session declarations. |
| `src/lib/paypal.ts` | Server-only sandbox OAuth cache and create/get/capture wrappers; manual-order payload only, native fetch forwarded without an instance receiver. |

The GET/read-back → APPROVED → capture → final GET algorithm from `src/lib/application.ts` was reworked in **`src/lib/flow.ts`**, without importing or copying its parser, storage, audit, or guardrails paths. `application.ts` itself was not ported. `flow.ts` provides exact USD normalization, authenticated submitted-field verification, sandbox approval-link checking, stable capture request IDs, and final completed-capture verification. These checks implement R4's payment correctness requirements; they do not implement the W4 cap or injection demo.

Additional files authored specifically for W1:

| File | W1 justification |
| --- | --- |
| `W1-RECOVERY.md` | Preserve the supplied recovery contract as required by R2. |
| `README.md` (existing file rewritten) | Reproducible manual W1 setup, sandbox buyer action, origin, and final API-status instructions. |
| `.env.example` (existing file edited) | Empty PayPal credential template, sandbox setting, no LLM prerequisite. |
| `.gitignore` (existing file edited) | Ignore Workers state, competing secret sources, and local evidence; preserve existing exclusions. |
| `src/lib/types.ts` | Only manual-order, PayPal response, service, and verified-status types. |
| `src/lib/config.ts` | Require the two PayPal credentials and a valid matching app origin; sandbox only. |
| `src/lib/errors.ts` | Safe stage/code/message errors without raw credential-bearing responses. |
| `src/lib/runtime.ts` | Read server Worker bindings and construct the PayPal service. |
| `src/pages/index.astro` | Plain server-rendered manual form and read-only token lookup. |
| `src/pages/orders/create.ts` | Deliberate form submission, origin check, server creation, sandbox redirect. |
| `src/pages/return.astro` | Token recovery and approved-order completion with final GET verification. |
| `src/pages/status.astro` | Read-only PayPal status page and explicit approved-order recovery link. |
| `src/pages/cancel.astro` | Plain cancelled-checkout page; no PayPal service call. |
| `src/pages/error.astro` | Visible create/configuration failure and unknown-outcome guidance. |
| `src/components/Layout.astro` | Minimal shared semantic page frame and sandbox label. |
| `src/components/Status.astro` | Minimal API status, submitted fields, capture ID, and recovery links. |
| `src/styles/w1.css` | Small responsive form/status stylesheet, focus visibility, reduced-motion support. |
| `src/middleware.ts` | No-store/same-origin referrer policy and basic response headers; preserves native form Origin checking, no session or persistence. |
| `tests/fixtures.ts` | Newly authored synthetic responses and authenticated metadata; no earlier test artifact copied. |
| `tests/paypal.test.ts` | Focused mock request-count, refresh, payload, missing-credential and error-code checks. |
| `tests/flow.test.ts` | Focused mock read-back/capture, mismatch, pending-capture and recovery checks. |
| `scripts/scan-secrets.mjs` | Working-tree, index, full reachable-history and secret-file scan; values never printed. |
| `docs/W1-REPORT.md` | This gate report, scope inventory, and separate evidence categories. |

**Deliberately left in `F:\saypay`:** `llm.ts`, `prompt.ts`, `schema.ts`, parser/application entry path, full Workspace UI and browser script, guardrails, D1 store/migrations/audit code and UI, old tests, old README, demo/acceptance documents, and all old artifacts, dependencies, build output, caches, and database state. None is a dependency of the new manual route.

**Local-only creations in `F:\saypay-w1`, excluded from the proposed commit:**

- `.env`: created from the empty template, then filled and corrected by the user locally. Values remain undisplayed, ignored and unstaged; the corrected pair successfully created the acceptance order. No root `.dev.vars` was created.
- `artifacts/w1-form.jpg`: newly captured W1 form with a missing-credentials notice; no credential value or fake completed payment.
- `artifacts/w1-real-submission.jpg`: manual USD 10.00 acceptance submission fields, before the local origin issue was corrected; no credential values.
- `artifacts/w1-auth-error.jpg`: the application's real OAuth `invalid_client` error, without credential values.
- `artifacts/w1-awaiting-approval.jpg`: GET-verified acceptance order and submitted fields with `PAYER_ACTION_REQUIRED`, without credential values.
- `artifacts/W1-real-evidence.json`: separate real-run receipt containing reportable order fields/status/IDs only; now records verified completion and capture ID.
- `artifacts/w1-completed.jpg`: new independent read-only GET status proof, with COMPLETED and capture ID; no credentials.
- `artifacts/W1-FINAL-REPORT.md`: local final R7 delivery report to be generated after commit, with the exact hash and post-commit scan.
- `artifacts/created-paths.txt`: absolute file/directory inventory of the new checkout, including tool-generated descendants.
- `.git/`: created by the authorized clone, retaining the two original commits.
- `node_modules/`, `.astro/`, `.wrangler/`, `dist/`: newly generated by installation, type checking, local development, build and dry run; nothing copied from the archive.
- Authored directories: `docs/`, `scripts/`, `src/`, `src/components/`, `src/lib/`, `src/pages/`, `src/pages/orders/`, `src/styles/`, `tests/`, `artifacts/`.

The clone also created the four original repository files at `F:\saypay-w1\README.md`, `.env.example`, `.gitignore`, and `LICENSE`; the first three were subsequently edited as listed above. The inventory records tool-generated files by their absolute locations rather than treating dependencies/build output as authored source.

Temporary paths created and removed during credentialed validation: `F:\saypay-w1\src\pages\_w1-network-probe.ts` was renamed to `src\pages\w1-network-probe.ts`, then removed after a credential-free Worker fetch diagnosis. Neither is in the proposed commit. Cloudflare's build tooling also generated `F:\saypay-w1\dist\server\.dev.vars` from local `.env`; this derived file was identified without printing values and removed while preserving the root `.env`. The final build configuration removes that asset before writing output, and the scanner now checks build files for the exact configured values. It is not required as a second local credential source. No file was deleted from the frozen archive.

**Dependency finding and repair:** `npm audit --json` initially reported five high-severity entries, all connected to Miniflare's `sharp 0.35.4`. The [maintainer advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) identifies `0.35.5` as patched. A package override pins `sharp` to `0.35.5` while retaining the selected direct Astro/Workers versions. Final `npm ci --no-audit` succeeded; `npm ls sharp --all` reports Astro using `0.35.5 overridden` and Miniflare using `0.35.5 deduped`. Final `npm audit --json` reports zero vulnerabilities. No force-fix/downgrade was used.

**No-persistence verification choice:** R4 requires comparing final fields with the original submission, while allowing recovery solely from PayPal's order token. The app signs the submitted payee/amount/currency/description/reference in PayPal's `custom_id`, using a domain-separated key derived from the existing sandbox app credentials. GET returns those fields; the server verifies their signature before capture and after final read-back. The completed capture amount/ID/status is separately checked. No local order state, extra credential, cookie, D1 or KV is needed. PayPal's [official Orders schema](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json) documents these metadata fields. Both the real pre-approval GET and final completed-order GET preserved these fields and passed signature verification; the completed capture amount and ID also passed verification. Credential rotation invalidates older tags, as the README states.

**Browser/runtime defects found and corrected before the Orders API was reached:**

- Native form submissions were initially rejected with 403 in both the in-app browser and Chrome. The response's `no-referrer` policy makes non-CORS form POST serialize Origin as `null`, as specified in the [Fetch standard](https://raw.githubusercontent.com/whatwg/fetch/main/fetch.bs). The earlier inline HTTP checks manually supplied Origin and missed this browser behavior. The response policy is now `same-origin`; Astro's origin check and the route's explicit matching-origin check remain enabled. The corrected native browser submission reached the PayPal authentication stage.
- Workerd's native fetch threw `TypeError` / `Illegal invocation` when stored and invoked as a PayPal instance method. A temporary credential-free runtime probe returned 401 for direct native fetch but failed for the method receiver. Forwarding through an arrow function returned 401 for both cases. The probe was removed; no standalone create/approve/capture smoke test was rerun.
- A local restart had attempted to fall back from occupied port 4321 to 4322. Strict port configuration now prevents that fallback, consistent with [Vite's documented behavior](https://vite.dev/config/server-options#server-strictport). The verified current origin remains `http://localhost:4321`; a duplicate dev-server invocation was refused instead of starting another server.

## (c) Built routes

| Route | Behavior |
| --- | --- |
| `GET /` | Manual payee/amount/USD/purpose form; deliberate sandbox-create button and token lookup. |
| `POST /orders/create` | Validate form/origin, sign submitted fields, create CAPTURE order server-side, redirect to sandbox approval. |
| `GET /return?token=...` | GET order; authenticate submitted fields; capture only APPROVED; GET again; display success only for a verified COMPLETED capture. |
| `GET /status?token=...` | GET/read-back only; never captures. |
| `GET /cancel?token=...` | Cancelled checkout, no capture/service call; optional read-only status link. |
| `GET /error` | Escaped stage/code/message and recovery guidance. |

The API base is fixed to `https://api-m.sandbox.paypal.com`. No browser code contains PayPal credentials or calls PayPal REST endpoints.

## (d) Mock/local evidence — separate from the real sandbox receipt

These results were produced in the new W1 checkout, not inherited from the archive:

- `npm ci --no-audit`: successful installation from the final lockfile (309 packages added).
- `npm run types`: successful; regenerated ASSETS/APP_URL project types, no D1 binding.
- `npm test`: **2 files, 26 tests passed**. Token-cache evidence: one OAuth call for create/get/capture/get (five total fetch calls); no refresh at 3,539 seconds, refresh at 3,540 seconds for a 3,600-second token. Flow evidence: GET APPROVED → capture → GET COMPLETED, and failures/mismatches never report verified completion. Non-APPROVED states and read-only status do not capture; retry uses a stable capture request ID. Added OAuth rejection coverage verifies that `invalid_client` stops after the token request without calling the Orders create endpoint.
- `npm run check`: **0 errors, 0 warnings, 0 hints** across 23 checked files.
- `npm run deploy:check`: successful Astro server build and Wrangler dry run; **no deployment**. Project bindings ASSETS/APP_URL. The configured credentials are absent from all final build files; generated preview secrets are excluded.
- `npm audit --json`: **0 vulnerabilities** at this checkpoint.
- Six local HTTP checks: root 200 with missing-credential notice; cancel 200; missing return token 400; status without credentials 503; create without credentials 303 to PAYPAL_NOT_CONFIGURED; alternate-origin page displays the APP_URL mismatch. No-store/no-cookie checked on the four GET checks. No real PayPal call was made.
- Browser inspection: manual fields, fixed USD, explicit create button disabled when credentials are absent; phone-width viewport had no horizontal overflow. Temporary viewport override was reset. Screenshot: `F:\saypay-w1\artifacts\w1-form.jpg`.
- After credentials were filled, the native Chrome form reached the sandbox OAuth request. The earlier browser-only 403 and Workerd receiver defects were corrected as above. Cross-origin POST protection remains enabled.

## (e) Real sandbox evidence — COMPLETED

| Evidence | Value |
| --- | --- |
| Environment / application origin | PayPal sandbox; `http://localhost:4321`. |
| Application-created order ID | `6CJ230299F372393H`. |
| Application capture/transaction ID | `3K382600KB1662720`. |
| Independent final GET status | `COMPLETED`, displayed by `GET /status?token=6CJ230299F372393H`. This route only calls PayPal GET. |
| Verified submitted fields | Payee `sb-47oi0h53224881@business.example.com`; USD 10.00; purpose `SayPay W1 sandbox acceptance`; authenticated metadata matches. |
| Completed capture verification | One COMPLETED capture with the ID above, currency USD and matching amount 10.00. |
| User-performed approval | User completed the sandbox checkout, returned to `/return?token=6CJ230299F372393H`, and supplied the completed-page screenshot. |
| Separate local real evidence | `artifacts/W1-real-evidence.json`, `artifacts/w1-completed.jpg`. |

This is the one real application-created acceptance order in the recovery. Earlier local 403/receiver failures and OAuth rejection created no order. After the user corrected the local API credentials, create succeeded and an initial GET reported PAYER_ACTION_REQUIRED. A generic buyer-login rejection was then observed. The user was directed to the Personal sandbox buyer account, retried login, and reached the completed return page. The generic earlier error did not establish its root cause; this report does not claim that a particular password or account caused it. PayPal's [official setup guide](https://developer.paypal.com/api/get-started/) distinguishes Personal sandbox buyer credentials from Business merchant and developer credentials.

The application return implementation only captures after its GET observes APPROVED and verifies the submitted fields. It then GETs again before showing success. The completed return page and the additional read-only status GET both show the same completed order and capture. An intermediate APPROVED response was not separately exported; the real result is recorded independently from the mocked sequencing tests. No extra order, direct standalone smoke test, or agent-performed buyer approval was used. Credentials remain local and undisplayed.

## (f) Secret scan

`npm run scan:secrets` examines current tracked/nonignored files, staged changes, and every file version in every reachable commit. It checks private-key/API-token patterns, populated credential assignments and forbidden secret-file paths. When values are filled in `.env`, it also compares them against publishable/history files and built output in memory; output contains only paths/codes/counts.

The corrected-build gate scan checks **33 current files, 29 build files, both locally configured credential values, and two original commits / seven historical file versions** and finds **no candidates and no tracked secret files**. `.env` is ignored and unstaged; there are zero staged files. No new W1 commit exists yet to scan. Repeat before staging/committing and after the eventual W1 commit. A clean scan is evidence for the covered patterns, not a mathematical guarantee against every secret format.

## (g) W1 commit

This implementation report is written before staging. The W1-only commit will be a normal descendant of `c1423b0`, retaining both original commits. Its exact hash and the post-commit full-history scan are supplied in the local final delivery report `F:\saypay-w1\artifacts\W1-FINAL-REPORT.md`; the commit cannot embed its own hash. The local commit reuses the existing repository author's identity for this user-authorized work without changing global Git settings. No push is authorized until delivery and joint planning approval.

## (h) Definition of done

- [x] Fresh-clone checkout + README reproduce create → human buyer approval → capture. **Real application order `6CJ230299F372393H`; independent final GET COMPLETED; matching completed capture `3K382600KB1662720`.** Installation, origin and manual README steps were exercised in this separate clone; the old smoke test is not used as acceptance evidence.
- [x] Server-side token cache implemented and verified. **26 mock tests pass, including one OAuth request across create/get/capture/get and early refresh**, as R7 allows. Cache is process-local and resets on Worker restart.
- [ ] Tracked-file/full-history scan confirms no committed secret or .env. **Current tree and both original commits passed; final scan including the new commit must pass before delivery.**
- [ ] W1-only commit hash available and joint Muse + Sol review passed. **Commit follows this snapshot; joint review remains pending even after a successful local commit.**

### Batched planning-layer notes

No unresolved implementation or credential question remains. Review the domain-separated metadata HMAC as the implementation of R4's original-submission comparison; both initial and completed real GETs passed this verification. It introduces no persistence or later-stage feature. OAuth and buyer approval blockers are resolved; their earlier causes are not generalized beyond the evidence.

Joint W1 review and the subsequent one-word push go-ahead are the remaining stage gates. W2–W4 remain closed. No push, public deployment, database, AI parser, product confirmation card or injection demo is included.
