# W5 acceptance sweep — documentation review gate

W4 is accepted and pushed at `de3930ae9b32de88b5030821653b253404782f70`. W5 changes only documentation/submission materials. Feature code, dependencies and deployment configuration remain frozen. This document records the pre-recording gate, not completion of the owner's submission.

## Evidence map

| Item | Evidence and status |
| --- | --- |
| Public deployed workspace | Rechecked in W5: `/parse` rendered, generation enabled, prior two COMPLETED public journal records visible. Local receipt: `artifacts/w5-public-reachable.txt` and `.png`. |
| Normal intent → payment | Prior accepted W4 public run: order `4DJ39811GD143364Y`, capture `3TB92882XN884805L`, final GET COMPLETED at USD 10.00. Not rerun in W5. |
| Missing-amount clarification → payment | Prior accepted W3: original/answer persisted on same intent; order `04U56936HA612231R`, capture `5DW95972UP708394N`, COMPLETED USD 10.00. See [W3 report](W3-REPORT.md). Not rerun in W5. |
| Injection example → payment | Prior accepted W4 public run: order `31008011RG766653D`, capture `7T328202BX572623D`, COMPLETED USD 10.00; amount_tampering snippet retained. Not rerun in W5. |
| Independent API truth | Accepted W4 filtered independent GET receipts in local `artifacts/W4-PAYPAL-GET.json`; W3 in `artifacts/W3-INDEPENDENT-GET.json`. These are historical stage evidence, not new W5 requests. |
| Cap enforcement | Prior W3 real BLOCKED `AMOUNT_CAP_EXCEEDED`, no order; accepted W4 mock crafted-POST cap/allowlist checks include zero create calls. |
| Public repository and MIT | W5 anonymous GitHub page showed Public and MIT in About. `git ls-remote origin refs/heads/main` and the clean clone confirmed W4 HEAD. The web reader's cached README lagged; it is not used to infer remote HEAD. |
| Final README and full submission fields | [README](../README.md) and [submission copy](SUBMISSION.md), English, bounded claims and fresh-clone instructions. |
| Video package | [Timed script, exact UI path and mechanical frame checklist](VIDEO-SCRIPT.md); [English SRT](VIDEO-CAPTIONS.srt). Planned 2:55. Actual recording length, visibility, contents and safety are pending owner verification. |
| Secret scans | Pre/post W5 commit receipts are local `artifacts/W5-PRECOMMIT-SECRET-SCAN.json`, `W5-POSTCOMMIT-SECRET-SCAN.json` and additional exact-value scan receipts. Final counters/hash are supplied in the local gate report. A planned scan is not a passed scan; consult those receipts. |
| W5 local commit and review | Final hash/parent/diff inventory are supplied in `artifacts/W5-READY-REPORT.md` after commit. W5 push awaits joint review. |
| Public YouTube video | Pending owner recording/upload and frame-by-frame confirmation after materials review. |
| Devpost submission | Pending owner action and platform project URL receipt. Internal target Nov 10; no completion claim before receipt. |

## Separate clean-clone reproduction

`F:\saypay-w1\artifacts\w5-clean-clone` was cloned from the public remote at pushed W4 HEAD into a new folder. The candidate final README was copied there as documentation only, since W5 is not yet pushed. No app source or prior journal state was copied.

Node 24.14.0 / npm 11.9.0: `npm ci` installed pinned dependencies (309 added, 310 audited, zero reported vulnerabilities at that check); only the five required configuration names were populated privately in the clone's ignored `.env` from existing local configuration. `npm run types` passed. `npm run dev` served `/parse` with HTTP 200, and the browser loaded an enabled workspace at `http://localhost:4321/parse`. No intent or payment was submitted in the clone. The dev process was then stopped; no clone state was moved anywhere.

Receipt: local `artifacts/W5-REPRODUCIBILITY.json`, `w5-clean-clone-workspace.txt` and `.png`. A clean-clone workspace load is the packet's W5 reproduction check; it does not replace the prior full PayPal-chain acceptance. The clone, its private config, generated files and dedicated `artifacts/w5-npm-cache` remain ignored local artifacts.

## W5 video staging — no payments

Three new deployed journal records were staged, separate from acceptance:

| Rehearsal | Intent ID | Observed result |
| --- | --- | --- |
| Normal | `2de1fc87-31ce-4876-9831-be5097c88725` | USD 10 DRAFT; deliberate merchant/note edits saved; no confirmed version/order/capture. |
| Exact malicious sample | `e6348ced-3cc8-4306-bae0-12bd52bef6e6` | Initial CLARIFICATION requesting amount despite a message that 10 was preserved; flag retained. One answer `10 dollars` on the same ID produced USD 10 DRAFT, flag retained, no order/capture. |
| Above cap | `851d001d-2c40-446b-9f37-e5311ee28d44` | USD 250 BLOCKED, AMOUNT_CAP_EXCEEDED, disabled confirm, no order/capture. |

Local text/screenshot receipts use the `w5-normal-rehearsal`, `w5-injection-clarification`, `w5-injection-resolved` and `w5-cap-rehearsal` prefixes. The resolved injection text includes the clarification answer and transitions. Screenshots are visible excerpts; text carries the fuller audit.

The extra clarification is a verified observation. Its precise cause cannot be established from the retained audit because raw provider output before grounding is not retained. `src/lib/parsing-input.ts` passes provider clarification through and also promotes ambiguity sentences mentioning required fields; either path could account for the screen. No source change was made. The video script includes this observed branch and a stop condition for unresolved/wrong outputs instead of guaranteeing a one-step draft.

## Remaining joint/owner gate

Items 1–3 are prepared for joint copy/script review. Sol's final local report provides the completed scans and commit receipt before declaring **ready to submit** at that review gate. This phrase means materials are ready for review; it does not authorize skipping that review or assert that an upload/submission exists.

After joint review and any plain-push authorization, the owner records the deployed flow, checks every frame, uploads a public English-captioned video, pastes the reviewed copy, replaces the video placeholder, and submits. The owner returns the Devpost project URL. Do not close W5 until those remaining items are evidenced.

The [official rules](https://paypalaihackathon.devpost.com/rules) list Nov 12, 2026, noon Pacific as the submission deadline and Dec 1–15 as judging. Nov 10 is the project's earlier internal target. Current platform/team declarations and account-owner actions remain the owner's responsibility. No new payment was run to manufacture acceptance evidence.
