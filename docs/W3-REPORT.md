# SayPay W3 — sandbox acceptance complete; joint review pending

From: Sol (executor and joint planning/review participant)

To: Muse, for joint Muse + Sol review. This report is saved locally; no message/file was transmitted to Muse.

**W3 mock and real acceptance pass locally.** Two human-approved USD 10 sandbox orders are API-verified COMPLETED. USD 250 is blocked at the card and independently at confirmation. Audit survives refresh and a stopped/restarted dev server. Work stayed in `F:\saypay-w1`; `F:\saypay` remains the frozen archive. This source report is a pre-commit snapshot; the final local receipt supplies the resulting hash and post-commit scan. W3 push and W4 await joint review.

## (a) Baseline and approved scope

W3 starts directly on pushed W2 `a2a1db943bba11e291327cbb9468fcb719b632d9`, whose parent is accepted W1 `1c3a9942416562d3f27bb1b4ccea4ef6c6f83341`. `git ls-remote origin refs/heads/main` still returned the W2 hash before W3 commit.

All three reconciliation rulings were followed: restore only `MAX_TRANSACTION_USD=200`; default USD 200 when omitted and fail closed for malformed/nonpositive/non-cent-exact supplied values; preserve currency-agnostic parsing but execute USD only, with explicit visible/audited currency edits; apply one shared cap to both draft and manual pre-create paths. Currency rejection precedes USD cap comparison. Cap parsing/comparison and monetary validation use integer cents.

JSON drafts/audit are behind `DraftStore`, backed by SQLite Durable Object KV, one object per anonymous browser workspace. Atomic revision replacement persists confirmed fields before create. This is KV-equivalent Workers storage, not D1. No frozen D1 code, new dependency/credential, allowlist, injection demo button, remote provisioning or public deployment was added.

Implementation anchors: [shared policy](F:/saypay-w1/src/lib/payment-policy.ts:5), [confirmation claim](F:/saypay-w1/src/lib/intent-flow.ts:94), [approved finishing](F:/saypay-w1/src/lib/intent-flow.ts:137), [manual cap](F:/saypay-w1/src/pages/orders/create.ts:17), [JSON revision store](F:/saypay-w1/src/lib/journal.ts:13), [Worker export](F:/saypay-w1/src/worker.ts:8).

## (b) Complete W3 inventory

35 proposed source/document paths: 23 new, 12 modified. New authored directory: `F:\saypay-w1\src\pages\workspace`. Existing `.env`, LICENSE, package/lockfile, W1 `flow.ts`, core W2 parser/schema/prompt and the frozen archive were not edited. Shared header/footer describe W3; the manual form's fields/source are retained.

| Absolute file | Treatment and W3 justification |
| --- | --- |
| `F:\saypay-w1\W3-PACKET.md` | New verbatim W2 PASS/push ruling and W3 packet. |
| `F:\saypay-w1\W3-RECONCILIATION.md` | New verbatim approved cap/currency/manual rulings. |
| `F:\saypay-w1\.env.example` | Restore historical cap configuration; credential templates stay empty. |
| `F:\saypay-w1\README.md` | Full reproduction flow, backing/recovery limits and W4 boundary. |
| `F:\saypay-w1\docs\W3-REPORT.md` | New pre-commit R7 evidence/inventory. |
| `F:\saypay-w1\wrangler.jsonc` | Custom Worker, object binding and SQLite class migration. |
| `F:\saypay-w1\worker-configuration.d.ts` | Regenerated binding/RPC types and env names only. |
| `F:\saypay-w1\src\worker.ts` | New Astro handler delegation and journal object RPC. |
| `F:\saypay-w1\src\lib\journal-types.ts` | New small store interface, entry/revision/transition types. |
| `F:\saypay-w1\src\lib\journal.ts` | New bounded JSON KV, atomic revision writes, pagination. |
| `F:\saypay-w1\src\lib\payment-policy.ts` | New single integer-cent USD/cap policy for both create paths/card. |
| `F:\saypay-w1\src\lib\intent-flow.ts` | New stored parsing/clarification, edits, confirmation, API reconciliation and audit failures. |
| `F:\saypay-w1\src\lib\workspace-runtime.ts` | New server env bridge and HttpOnly workspace cookie/object selection. |
| `F:\saypay-w1\src\lib\workspace-request.ts` | New bounded same-origin form/visible edits; reject execution/AI metadata. |
| `F:\saypay-w1\src\lib\workspace-actions.ts` | New explicit edit/confirm and return/status/cancel handlers, safe error redirects. |
| `F:\saypay-w1\src\lib\parsing-request.ts` | Export existing bounded body reader for reuse only. |
| `F:\saypay-w1\src\lib\paypal.ts` | W3 callback paths/reference option; preserve W1 defaults/brand. |
| `F:\saypay-w1\src\lib\runtime.ts` | Expose lazy cap policy for manual create. |
| `F:\saypay-w1\src\pages\orders\create.ts` | Authorized shared cap before sign/create; existing error handling. |
| `F:\saypay-w1\src\pages\parse.astro` | SSR input/clarification, stored editable card/status and audit; parse never creates. |
| `F:\saypay-w1\src\pages\workspace\confirm.ts` | New confirm-by-ID POST. |
| `F:\saypay-w1\src\pages\workspace\edit.ts` | New validate-edits-only POST. |
| `F:\saypay-w1\src\pages\workspace\return.ts` | New read-back/approved capture/final GET callback. |
| `F:\saypay-w1\src\pages\workspace\status.ts` | New read-only API status/token recovery. |
| `F:\saypay-w1\src\pages\workspace\cancel.ts` | New audit cancellation, no capture. |
| `F:\saypay-w1\src\components\ConfirmationCard.astro` | New editable fields, confidence/ambiguities/flags, policy block and verified status. |
| `F:\saypay-w1\src\components\AuditTrail.astro` | New input/answers/versions/currencies, IDs/absence and transitions. |
| `F:\saypay-w1\src\components\DraftResult.astro` | Unique read-only snapshot IDs and uncalibrated-confidence labels. |
| `F:\saypay-w1\src\components\Layout.astro` | Shared stage/footer no longer falsely call confirmation a future stage. |
| `F:\saypay-w1\src\styles\w3.css` | New responsive editorial layout, fields/audit, focus/reduced-motion rules. |
| `F:\saypay-w1\tests\journal-fixture.ts` | New mock JSON KV/transaction with serialized reopen. |
| `F:\saypay-w1\tests\intent-flow.test.ts` | New mocked LLM/PayPal flow, audit, currency/cap, claim and failure tests. |
| `F:\saypay-w1\tests\workspace-routes.test.ts` | New actual-handler crafted POST/manual cap/metadata/body/import tests. |
| `F:\saypay-w1\tests\parsing-boundary.test.ts` | Move authorized boundary to complete core-parser graph; retain stateless/manual checks. |
| `F:\saypay-w1\scripts\read-paypal-order.mjs` | New independent read-only API/HMAC receipt verifier; no create/capture. |

New ignored evidence in `F:\saypay-w1\artifacts`: `W3-REAL-EVIDENCE.json`, `W3-INDEPENDENT-GET.json`, `W3-JOURNAL-SECRET-SCAN.json`, `W3-TOOL-LOG-SECRET-SCAN.json`, `W3-EXTERNAL-TOOL-PATHS.txt`, `w3-restart-rows.json`, `w3-audit-after-refresh.txt`, `w3-audit-after-restart.txt`, `w3-normal-edited-card.png`, `w3-normal-awaiting-approval.png`, `w3-normal-buyer-review.png`, `w3-normal-completed.png`, `w3-clarification-question.png`, `w3-clarification-awaiting-approval.png`, `w3-clarification-completed.png`, `w3-cap-blocked-card.png`, `w3-cap-server-block.png`, `w3-mobile-390.png`. The final receipt enumerates the subsequently created pre/post-scan JSON, commit receipt JSON and final English report there.

The [updated path ledger](F:/saypay-w1/artifacts/created-paths.txt) includes current project files/directories and generated Git/build/cache/state paths, retaining earlier removed-generated records. [External tool paths](F:/saypay-w1/artifacts/W3-EXTERNAL-TOOL-PATHS.txt) list generated logs under `C:\Users\tkzzni\AppData\Roaming\xdg.config\.wrangler\logs`. Earlier evidence was retained. New local workspace DB: `F:\saypay-w1\.wrangler\state\v3\do\saypay-DraftJournal\a7fdfe7c21516c03791256e7a1c86affbf54b94a3a51947f6e9ec7d58bb32a9f.sqlite`; metadata/sidecars are in the ledger.

## (c) Routes, execution and storage

| Route | Behavior |
| --- | --- |
| GET/POST `/parse` | Read workspace / start intent or answer stored clarification; no create. |
| POST `/workspace/edit` | Persist validated edits only; no PayPal write. |
| POST `/workspace/confirm` | ID + revision + visible edits; retrieve/re-validate, persist claim/snapshot, create and redirect. |
| GET `/workspace/return` | Reconcile API signature and stored snapshot; capture only APPROVED; final GET determines completion. |
| GET `/workspace/status` | Read-only GET, including existing-token recovery of an unknown create outcome. |
| GET `/workspace/cancel` | Audit browser cancellation; no capture or claim of PayPal void/deletion. |
| POST `/orders/create` | Existing manual handler plus authorized pre-create cap. |

UUID IDs and HttpOnly SameSite=Lax cookie separate anonymous browser workspaces. Local JSON persists under ignored `.wrangler/state/v3/do/`; clearing the cookie, deleting state or cloning fresh does not recover this journal. Records are bounded to 128,000 serialized bytes, twenty entries per page, with no auto-purge or user login. README states these limits.

Edits deliberately change allowed fields; posted AI/order metadata cannot become authority. Totals are recomputed and mismatch blocks. Persisted confirmed fields precede create, survive provider failures and cannot create a replacement order. Every API read-back is compared to them, including the extra GET inside W1 finishing before capture. Two-minute capture claims block concurrent callbacks/cancellation; a later explicit retry uses W1's stable capture request ID. No global exactly-once or payment-reversal claim is made.

[Cloudflare's storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) documents synchronous KV/atomic transactions; [Astro's integration](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) documents custom Worker exports. Local restart evidence verifies this project's use; no remote persistence/deployment is claimed.

## (d) Mock/local evidence — separate from real APIs

Final `npm test`: **114 tests / 6 files**, 37 W3 additions on the 77-test baseline. `npm run check`: **53 files, 0 errors/warnings/hints**. `npm run deploy:check`: build and Wrangler dry-run pass, **721.94 KiB / gzip 182.15 KiB**, `DRAFT_JOURNAL`, assets and local APP_URL bindings; no deploy. `git diff --check` is clean.

Mocks use real W2 parsing/schema and W1 PayPal client with mocked fetches: parse → edit → confirm-by-ID → signed CAPTURE create → APPROVED → capture → final GET COMPLETED, plus stored clarification. Mock capture response intentionally says PENDING; success comes from subsequent GET. Original/confirmed versions, transitions, IDs and failures survive serialized mock-store reopen.

Negative cases cover metadata/duplicate fields, total mismatch, empty/invalid email, unknown workspace ID, stale/parallel confirms, origin/body bounds, create timeout, LLM/storage failures and a changed signed order before capture. Direct crafted USD 250 POST through the actual confirm handler and USD 250 through the actual manual handler both prove **zero create calls**. Import inspection verifies all three surfaces share the one policy. Tests preserve original EUR, block currency before USD cap comparison, audit an explicit USD edit, and check default/inclusive boundary/override/invalid cap. Status stays read-only, cancellation never captures and concurrent callbacks do not start another pending capture.

Only the obsolete W2 page boundary is crossed as authorized. Complete core-parser import inspection retains its no-PayPal/storage boundary; manual path has no parser dependency. Mock results are not real API evidence.

Temporary 390 × 844 browser observation: viewport width 390, document width 375, one 335px workspace column, no horizontal overflow; override reset. Semantic SSR forms, focus and reduced-motion CSS are provided. This focused layout check is not an accessibility certification.

## (e) Real sandbox evidence

Existing locally configured DeepSeek/PayPal values were preserved. `SandboxMerchant` is an explicit test display label. Actual email was filled from the user's provided sandbox merchant address, never guessed/mapped by AI. User performed both buyer approvals; sandbox money only.

| Case | Draft ID | Order ID | Final GET / capture ID |
| --- | --- | --- | --- |
| Normal USD 10 | `efe68646-187b-4883-a042-d45f7914e72a` | `2VM594863G265444G` | COMPLETED / `73688554SB107952N` |
| Clarification USD 10 | `3aedc5a1-a099-44ce-b06c-45d8a2cc5696` | `04U56936HA612231R` | COMPLETED / `5DW95972UP708394N` |
| Above cap USD 250 | `896c545a-ae33-4294-a0f5-786e971c1b13` | None | BLOCKED / AMOUNT_CAP_EXCEEDED; USD 200 cap |

Normal input: `Pay SandboxMerchant 10 dollars for avatar design, note: W3 normal acceptance.` AI note `W3 normal acceptance.` became deliberate card edit `W3 normal edited purpose`, with merchant email `sb-47oi0h53224881@business.example.com` filled. Validate-edits-only preceded confirmation. GET verifies edited purpose, USD 10, exact payee/reference and completed capture. Actual transitions: PARSING → DRAFT → validated DRAFT → CONFIRMING → CREATED → APPROVED → CAPTURING → COMPLETED.

Clarification input: `Pay SandboxMerchant for avatar design, note: W3 clarification acceptance.` Real question asked amount/currency; answer `10 dollars` produced draft on the same ID. Merchant email filled before confirm. GET verifies USD 10, purpose `W3 clarification acceptance` and completed capture. Audit includes original/answer/AI/confirmed versions and CLARIFICATION → PARSING → DRAFT before execution.

Above-cap input: `Pay SandboxMerchant 250 dollars for avatar design, note: W3 cap acceptance.` Real USD 250 draft was BLOCKED and confirm disabled. For independent server enforcement on that same record, validate-edits-only temporarily reduced item/total to USD 10, enabling the old card; changing both back to USD 250 then confirming returned AMOUNT_CAP_EXCEEDED. Audit retains attempted USD 250 edits, no accepted confirmed/submission/order, and both draft/confirmation block reasons. It never reached approval. This real UI-state bypass and the mock raw crafted POST are explicitly different evidence.

Independent `node scripts/read-paypal-order.mjs 2VM594863G265444G 04U56936HA612231R` verifies both GET receipts/HMAC using Node crypto and emits only [filtered receipts](F:/saypay-w1/artifacts/W3-INDEPENDENT-GET.json), no create/capture. The app had already reconciled its own final GET before showing success.

Refresh retained all three real records. Stop dev session 39451, final checks, then new session 37419 from the same state directory: new GET retained the same five records (three acceptance plus two early attempts), with acceptance states COMPLETED/COMPLETED/BLOCKED. Expanded raw inputs, versions, IDs/absence and transitions are in [refresh evidence](F:/saypay-w1/artifacts/w3-audit-after-refresh.txt), [restart evidence](F:/saypay-w1/artifacts/w3-audit-after-restart.txt) and [restart states](F:/saypay-w1/artifacts/w3-restart-rows.json).

Early attempts remain, excluded from acceptance: email-only `54603c2b-99c7-48b4-85ba-607025275228` elicited an extra display-name clarification, no order. Named/email `3d313ab2-1d3f-4921-99ff-839af31d81b1` failed AI parsing/INVALID_LLM_JSON, no accepted draft/order, no downgrade/fallback. Its record remains FAILED. Raw malformed provider output was not logged, so its content/cause is unverified; only the observed validation failure is established. No core-parser change hid either outcome. [Structured real evidence](F:/saypay-w1/artifacts/W3-REAL-EVIDENCE.json) and screenshots retain this history.

## (f) Secret scan

Existing scanner compares all three credential values in memory against publishable working files, staged content, build output and all reachable historical file versions; selected patterns, dotenv assignments and forbidden secret paths are also checked. No values are printed; `.env` is ignored/never staged. Index-aware scan runs immediately before commit and again after; final receipt supplies counters/results.

Separate exact-value scans: **6 persisted Durable Object files, 10 Wrangler log files, zero findings**. Screenshots show app/sandbox status, no configured values/passwords. Ignored plaintext artifacts are also exact-value checked before delivery. A clean scan is bounded evidence, not universal secret detection.

## (g) Commit and delivery gate

W3 normal commit sits directly on pushed W2, using existing author identity per command. This source cannot contain its own final hash; [final local English report](F:/saypay-w1/artifacts/W3-FINAL-REPORT.md) supplies hash/parent/inventory, clean-ahead status and post-commit scan. No force, rebase, history rewrite or W3 push. License and dependencies retained.

## (h) Definition of done / batched planning notes

- [x] Mock edited/clarified end-to-end, confirm-by-ID validation, metadata and total-mismatch rejection.
- [x] Crafted confirm POST and manual handler over-cap: zero create; single-policy imports verified.
- [x] Real normal: visible note edit, user approval, final GET COMPLETED + transaction ID.
- [x] Real clarification: stored original/answers, user approval, final GET COMPLETED + transaction ID.
- [x] Real over-cap: card + independent confirmation block, no order, BLOCKED reason.
- [x] All three real records/versions/IDs/transitions after refresh and dev restart.
- [x] README full flow/honest storage limits; W4 demo/deployment absent.
- [ ] Final pre/post-commit scans/hash/clean-ahead receipt — supplied after this snapshot in the linked final report.
- [ ] Joint Muse + Sol PASS and W3 push authorization — deliberately pending.

**To Muse + Sol, batched:** No technical question blocks W3 acceptance. Review the concrete implementation/evidence and issue continue/adjust, including explicit authorization before plain push of this single W3 commit. Carry the observed extra email-only name question and occasional rejected invalid JSON into subsequent fixture hardening; neither was accepted by inventing payment data. W4 remains closed until W3 joint PASS. User completed both buyer approvals; no new credential/technical decision is requested from him.
