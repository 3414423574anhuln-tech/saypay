# Handoff to Sol — SayPay W3 pre-start reconciliation ruling (paste-ready, English)

> 给用户（中文）：把横线之后整段粘给 Sol 即可，这是对 W3 包的三点补充裁定。Sol 的三个提议我全部核准了，其中变量名那条我自己独立查了历史提交、确认他是对的、我 W3 包里写错了一半。你不需要改 `.env`、不需要填任何新东西，粘完就没你的事了，W3 直接开工。

---

Sol — joint planning/review layer ruling on your W3 pre-start reconciliation report. All three proposals are **approved**, two with clarifications. W3 implementation resumes under the original W3 packet as amended by this ruling; no further gate applies to these three points. Work only in `F:\saypay-w1`.

**Preliminary confirmations.** (1) Your W2 push is independently verified: Muse checked the GitHub API and remote `main` tips at `a2a1db943bba11e291327cbb9468fcb719b632d9`. (2) Your cap-name history is independently verified: Muse read the actual `c1423b0` commit diff — the original `.env.example` line 12 is `MAX_TRANSACTION_USD=200` under a "# Guardrails" heading. Your `git show`/`git diff` account is correct, and stopping at the packet's explicit gate instead of inventing a parallel name was the correct behavior.

**Packet correction, owned by the planning layer.** The W3 packet said the cap variable is "already listed in `.env.example` since repo creation". That was half wrong: the name existed at repo creation (your recovery of it is exact), but the W1 change set removed the line from the current template, so the packet's instruction to "use that existing variable name" pointed at a file that no longer contains it. The correction below replaces that instruction.

## Ruling 1 — Restore `MAX_TRANSACTION_USD=200`: AUTHORIZED, as proposed

- Restore the original entry `MAX_TRANSACTION_USD=200` in `.env.example` as part of the W3 change set. Do not rewrite accepted history; the restoration is a normal forward change.
- Read only this name. An omitted local override means the default, USD 200. A supplied malformed, nonpositive, or non-cent-exact override **blocks configuration** with a plain-language error — it never disables or widens the cap (fail closed).
- Integer cents throughout. One shared cap-policy implementation serves the visible card check and the independent server pre-create check — no duplicated constants or parallel logic.
- This is configuration, not a credential: the user takes no action, and no value is requested from him.

## Ruling 2 — Currency: CONFIRMED as proposed, with gate ordering and audit clarifications

- W3 execution is **USD-only**. The parser stays currency-agnostic (any three-letter currency may appear in a draft); nothing in the W2 layer changes.
- The card preserves and displays the parser's stated currency. A non-USD draft cannot be confirmed: confirmation is blocked with a plain-language reason stating that W3 executes USD only. No exchange-rate conversion, no silent relabelling, no treating EUR 200 as USD 200.
- Gate ordering at confirmation: the currency gate is evaluated before the cap, because the cap is USD-denominated; a non-USD amount never reaches a cap comparison or an order creation.
- The only way a non-USD draft proceeds is a deliberate user edit of the currency field to USD on the confirmation card — an explicit, visible, confirmed edit of the same standing as an amount edit. The audit trail already records both the AI draft and the user-confirmed version; ensure the original currency and the confirmed currency are both visible there, so the edit is never invisible in the record.

## Ruling 3 — Cap coverage on both write paths: CONFIRMED; the packet's "unchanged" is amended

- Your correctness point stands: spec F6 states a per-transaction hard cap, and a draft-path-only cap would leave the manual route able to create a larger order, making any app-wide cap claim false. The packet's "the W1 manual form remains available and unchanged" referred to its UI and its PayPal reconciliation; it is hereby amended for exactly one point.
- Apply the **same shared server-side cap policy** (Ruling 1) in the manual create route (`src/pages/orders/create.ts`) before order creation. On rejection: **zero PayPal create calls**, and the block surfaces through the manual route's existing plain-language error handling, stating the cap and the attempted amount. The manual form's UI, fields, and the W1 create/return/status reconciliation are otherwise unchanged. Manual-route rejections are validation rejections like its existing ones — they do not need F5 audit records; the audit trail governs the W3 intent flow.
- Consequential amendment to the W3 definition of done, mocked-suite box: it must additionally show the **manual route blocked over-cap at its server create handler with zero PayPal create calls**. After this change, the README may state the cap as applying to every payment path in the app — because it will be true.
- Evidence note for the final W3 report: show the shared policy is a single implementation imported by the card check, the draft-flow re-validation, and the manual create handler (import inspection in the style of the W2 boundary tests is acceptable evidence).

Everything else in the W3 packet stands as written, including: no D1 unless a concrete blocker is reported as a batched question; storage behind a small interface; confirm-by-ID with full server re-validation; the three real acceptance runs; secret scans; and the W3 push waiting for joint review. The user's physical actions are unchanged: paste this ruling, two sandbox buyer approvals during the real runs, continue/adjust at the gate.
