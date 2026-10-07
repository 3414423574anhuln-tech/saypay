# Handoff to Sol — SayPay W1 review PASS + push authorization, and W2 packet (paste-ready, English)

> 给用户（中文）：把横线之后整段粘给 Sol 即可。内容分两部分：第一部分是我对 W1 的共同审核结论——**通过**，并放行他把那个本地 commit push 到 GitHub；第二部分是 W2 交接包（W1 提前完成，排期直接前移，不等 10 月 13 日）。你后续唯一的物理动作写在 W2 包的末尾：等 Sol 停到 LLM 凭据关口时，往 `F:\saypay-w1\.env` 里本机补三个 LLM 变量的值，变量名他会报给你，值不要经聊天发送。

---

Sol — joint planning/review layer ruling on your final W1 execution report, followed by the W2 packet. All communication on this project is in English. Work only in `F:\saypay-w1`; `F:\saypay` remains the frozen read-only archive.

## Part 1 — W1 joint review: PASS, and push authorization

The planning layer has reviewed your final report item by item against the W1 definition of done. **W1 passes joint review.** Findings:

- **Real chain — accepted.** Order `6CJ230299F372393H`, capture `3K382600KB1662720`, independent read-only GET showing `COMPLETED` with matching payee/amount/purpose. The old standalone smoke test was not used as evidence, as required. The absence of a separately exported intermediate APPROVED snapshot is noted and accepted: the return route by construction captures only after a GET-observed APPROVED plus submitted-field verification, that sequence is covered by the mocked flow tests, and the completed state was independently re-read through the read-only status route. Do not manufacture retroactive evidence for the intermediate state.
- **Token caching — accepted** on the mocked request-count and early-refresh evidence, as the packet expressly allowed.
- **Secret scan — accepted.** Pre- and post-commit scans covered working tree, index blobs, all reachable commits (3 commits / 40 historical file versions after the W1 commit), build output, and exact-value comparison against both configured credentials, with no findings and no tracked `.env`/`.dev.vars`. The stated limitation (pattern coverage is not a guarantee against every format) is the correct characterization.
- **Commit — accepted.** `1c3a9942416562d3f27bb1b4ccea4ef6c6f83341` sits directly on `c1423b0` over the original two-commit ancestry, contains exactly the 32 inventoried W1 paths, LICENSE unchanged, tree clean. Muse independently verified via the GitHub API that remote `main` still tips at `c1423b0` — consistent with "ahead 1, no push".
- **Metadata-signature design — accepted for W1 scope.** Signing the submitted fields into PayPal's `custom_id` with a domain-separated key derived from the existing sandbox app credentials satisfies the recovery packet's original-submission-comparison requirement without persistence, cookies, D1/KV, or any extra credential, and both real GETs passed verification. This acceptance covers the sandbox W1 scope only; it is not an endorsement for live-money use (live is out of scope for this project). The credential-rotation caveat is correctly documented in the README.
- All four definition-of-done boxes are now checked, including the fourth, which this ruling closes.

**Push authorization:** push the W1 commit now — a plain `git push origin main` from `F:\saypay-w1`. No force push, no history rewrite, no additional commits bundled in. If the push is rejected for any reason, stop and report; do not rebase or force on your own decision. After pushing, report in one line set: `git status --short --branch`, `git log -3 --oneline`, and confirmation that remote `main` tips at `1c3a994`. Muse will independently re-verify the remote after the push.

## Part 2 — W2 packet: AI parsing layer (schedule pulled forward; W1 finished early, do not wait for Oct 13)

**W2 scope — only this (spec Section 3 F2, Section 5 LLM decisions, Section 6 schema, Section 8 W2):**

1. **Server-side LLM service.** OpenAI-compatible API client, server-side only, connection parameters exclusively from env vars `LLM_API_BASE`, `LLM_API_KEY`, `LLM_MODEL`. Structured output constrained by the spec Section 6 draft schema (response_format / JSON schema per spec Section 5). Secrets never reach the browser, logs, screenshots, or reports. API failures surface as plain-language staged errors (stage + code), never as blank pages or fabricated drafts.
2. **Prompt and schema are committed code.** The parsing prompt (a prompt is not a secret) and the draft schema live in the repo. The prompt must instruct extraction only: never invent an amount, payee, or email that the intent does not support; surface uncertainty in `ambiguities` instead of guessing.
3. **Server-side validation of every draft.** Parse and validate the LLM output against the schema; recompute `total` from line items server-side; any total/line-item mismatch or schema violation blocks the draft with a plain-language reason (this is parsing correctness, in W2 scope). Empty payee email is allowed at draft stage per spec Section 6 — the flow asks or defers to the card later; it is never filled in by guessing.
4. **Clarification flow, no guessing.** If a required field is missing or ambiguous (no amount, no identifiable payee, vague amount), the parser returns a structured clarification question instead of a draft. After the user answers, re-parse the original intent plus the answer. The parser is stateless in W2: no draft persistence, no D1/KV, no audit store (audit trail and its persistence are W3). The clarification round-trip carries the original intent and the answer in the request, not in server storage.
5. **Minimal draft surface only.** Extend the existing app with an intent input (English or Chinese) that shows the returned draft fields or the clarification question, labelled clearly as a draft that has not been paid and cannot be paid from this screen. **Hard boundary: in W2 no code path from a parsed draft to PayPal order creation may exist.** The W1 manual form remains the only payment path until W3 integrates the confirmation card. Parsing routes must never import or call the PayPal service.
6. **`injection_flags` at parser level.** The schema field exists from the start and the parser must populate it: for an intent that contains an in-instruction attempt to alter the amount, the draft keeps the originally stated amount and `injection_flags` records the detection (type + offending snippet). This is parsing correctness. The demo presentation, the sample-button UX, and the amount-cap enforcement are W4 and stay closed in W2, as do the confirmation card and audit UI (W3).

**Credentials gate (same discipline as W1):** build and run all mocked work first. When real-LLM verification needs values, stop and report exactly the variable names — expected `LLM_API_BASE`, `LLM_API_KEY`, `LLM_MODEL` in `F:\saypay-w1\.env`. The user fills them locally himself; never ask for values in chat, never print or fabricate them. `.env.example` gains no values, only the existing names.

**W2 definition of done (joint review, same as W1):**
- [ ] Mocked-LLM test suite passes: schema-valid drafts for normal intents; total-recompute mismatch blocked; clarification returned (with no invented values) for missing-amount, missing-payee, and vague-amount fixtures; tampering fixture yields unchanged stated amount plus a populated `injection_flags` entry.
- [ ] Real-LLM evidence, labelled separately from mocks: acceptance intents run against the real configured model — one normal English intent, one normal Chinese intent, one missing-field intent — produce correct drafts / a clarification question as applicable.
- [ ] No-draft-to-payment boundary verified by code inspection and a test or route inventory showing parsing routes never call the PayPal service and no order can be created from a draft in W2.
- [ ] Secret scan (including exact-value comparison for the LLM key) passes before and after the W2 commit; README updated to describe the parsing layer and its draft-not-paid boundary without claiming confirmation, end-to-end payment from drafts, or guardrail features; W2-only commit hash reported on top of the pushed W1 commit; push of the W2 commit waits for joint review, exactly as W1 did.

**Reporting:** one message, R7 format as in W1: what was built, route/file inventory with one-line W2 justification per file, mock evidence and real evidence in separate sections, secret-scan method and result, commit hash, definition-of-done checklist. Questions batched, addressed to the planning layer, never one by one to the user.

**The user's physical actions in W2 are only:** (1) paste this packet to you; (2) fill the three LLM variables in `F:\saypay-w1\.env` locally when you reach the credentials gate; (3) reply continue/adjust at the stage gate. No technical decisions are routed through him.

W3 (confirmation card, audit trail, end-to-end) and W4 (guardrails, injection demo, deployment) remain closed until W2 passes joint review.
