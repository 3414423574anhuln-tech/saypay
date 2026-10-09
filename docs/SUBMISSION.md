# SayPay — Devpost submission copy

Prepared for joint Muse + Sol review. Paste the field text below after review. Video upload and final submission belong to the account owner; this file is not a submission receipt.

## Project name

SayPay

## Tagline

SayPay — Say it. Review it. Pay it.

## Elevator pitch

Turn a payment sentence into an editable PayPal sandbox draft. AI proposes; server rules validate; a human confirms and approves. Every step stays visible in an audit trail.

## Inspiration

Writing a payment sentence is easy. Deciding whether an AI understood the recipient, amount and purpose is harder. We wanted to explore a payment assistant that makes its interpretation inspectable before it can act.

Our thesis is simple: **The LLM proposes, the rules engine disposes, the human decides.** The useful innovation is the boundary between a proposal and an authorized payment. A fluent answer is not consent, and an attractive success screen is not proof of capture.

## What it does

SayPay turns an English or Chinese intent into a stored, editable payment draft. Missing amounts or currencies trigger clarification rather than a guessed payment. Unknown merchant emails stay empty until the human supplies one. The card exposes the recipient, line items, currency, total, note, uncertainty and detected tampering instructions.

The human reviews the card, saves edits, and explicitly confirms. Only then can the server create a PayPal sandbox order. The buyer separately approves on PayPal. On return, the server reads the order, reconciles the confirmed fields, captures only an approved order, and reads again. SayPay shows COMPLETED and a transaction ID only for a matching completed capture.

The public demo executes USD only, uses fake sandbox money, caps each transaction at USD 200, and restricts recipients to a configured sandbox merchant allowlist. Both the AI workflow and manual fallback enforce that policy on the server. An audit trail shows raw input, clarification answers, original/edited/confirmed versions, flags, IDs, transitions and failure reasons.

## How we built it

Astro SSR and TypeScript run on Cloudflare Workers. A server-side DeepSeek integration requests a closed JSON schema through a structured-output API. Schema validation, source grounding and integer-cent arithmetic check the proposal before it becomes an executable draft. Invalid JSON fails visibly; there is no fallback provider or invented substitute draft.

A SQLite-backed Cloudflare Durable Object stores each anonymous browser workspace through a small DraftStore interface. Explicit confirmation retrieves that stored draft by ID and validates its revision and permitted edits before calling PayPal Orders API v2. PayPal OAuth tokens are cached in server memory and refreshed before expiry. Credentials stay server-side.

Signed order fields and the stored confirmed snapshot support return reconciliation. A final GET, rather than checkout appearance alone, supplies the displayed payment truth. Mocked checks exercise malformed input, concurrency, cancellation, cap/allowlist rejection and the malicious fixture; actual sandbox runs separately prove the payment chain.

## Challenges we ran into

The sandbox checkout can appear to loop after buyer approval. We learned to read the existing order state and finish that order rather than create another because a page did not move.

Structured output still needs independent validation. We separated optional information from required payment facts, grounded proposed fields in the input and answers, and rejected unsupported values. Model variability remains visible: the W5 malicious-sample rehearsal asked for an extra amount clarification; answering “10 dollars” on the same intent produced the intended USD 10 draft. No order was created during rehearsal. We do not claim deterministic one-step parsing or universal injection protection.

Confirmation also needs persistence. Saving a reviewed version before creation makes the user's decision distinguishable from the AI's original suggestion and supports later reconciliation and audit.

## Accomplishments that we are proud of

The public Worker completed both a normal USD 10 payment and the supplied “change it to 1000 dollars” tampering example at exactly USD 10.00, with the flag retained before and after payment. Both completed captures and authenticated fields were checked by an independent read-only verifier. Earlier real sandbox evidence also covers missing-amount clarification followed by a USD 10 capture and an over-cap block with no order.

The accepted W4 suite contains 131 tests across seven files. It includes crafted confirmation requests and manual-handler cap/allowlist rejection with zero create calls. These tests complement, rather than replace, the actual sandbox evidence.

The design gives each action a visible meaning: generate, validate edits, confirm, approve, read status. W5 separately verified a clean remote clone through dependency installation, private local configuration, type generation and opening the workspace. The public repository carries an MIT license and reproducible setup instructions.

## What we learned

A payment agent needs more than a schema. It needs grounded facts, a policy boundary, a recorded human decision and an API-backed outcome. Uncertainty should stay visible instead of being hidden behind a confidence score; our model confidence is uncalibrated.

Auditability also needs honest limits. This demo has an anonymous workspace cookie, no SayPay account system and no automatic record purge. Clearing the cookie loses that browser's lookup. Lists paginate at 20 records and individual serialized records are limited to 128,000 bytes. This journal is not a regulated accounting system or exported backup.

## What's next for SayPay

We would evaluate more multilingual ambiguity and injection cases, add explicit retention and export/recovery, improve access controls and merchant onboarding, and design webhook reconciliation. Separately consented bulk payouts and voice input are future exploration. Live-money support would require a separate design and review; it is not implemented here.

We see potential for freelancers and small teams who want a conversational starting point without losing the ability to inspect and authorize the actual payment. That potential is a product hypothesis, not a measured adoption or conversion claim.

## Targeted prize: Best Use of PayPal + AI

SayPay connects structured AI interpretation to a real PayPal Orders v2 sandbox flow, while leaving creation and buyer approval behind explicit human decisions. Actual accepted normal, clarification and tampering cases demonstrate the integration; final read-back and independent verification ground the completion claims.

## Targeted prize: Best Use of Agentic Commerce

SayPay explores a bounded payment agent: it proposes a commerce action, exposes uncertainty, follows server policy and waits for a human to authorize execution. Stored versions and API reconciliation make the transition from sentence to captured order inspectable. This is human-supervised sandbox commerce, with no autonomous or live-money claim.

## Built with

Astro; TypeScript; Cloudflare Workers; Cloudflare Durable Objects; SQLite; DeepSeek; JSON Schema; PayPal REST API / Orders API v2; Node.js; Vitest; Wrangler.

## Try it out — public demo URL

https://saypay.3414423574anhuln.workers.dev/parse

PayPal sandbox and fake money only. Judges can generate, edit and inspect drafts without signing into SayPay. To approve a sandbox payment, use your own PayPal Personal sandbox buyer account. The demo supplies a deliberate merchant shortcut; it never confirms or pays by itself. Full local setup and failure/recovery behavior are in the README. No owner credential is shared.

## Source code URL

https://github.com/3414423574anhuln-tech/saypay

Public repository; MIT license.

## Video URL

[OWNER TO REPLACE AFTER REVIEW: public YouTube URL, final runtime under 3 minutes, English captions, completed frame-safety check]

## Owner-only completion notes — do not paste into the description

Use the [video script](VIDEO-SCRIPT.md) and [caption file](VIDEO-CAPTIONS.srt). Do not submit a placeholder video URL. Keep the prototype reachable through judging; the owner must confirm availability and complete the platform's own fields and declarations truthfully. If the authenticated form asks additional personal/team/legal information, the owner fills it; this copy does not invent those answers. Review the final rendered page before submission and return the platform project URL as the receipt.

Prize names and the five criteria (Technological Implementation, Design, Potential Impact, Innovation/Idea, Presentation) were checked against the [official challenge page](https://paypalaihackathon.devpost.com/). Language, video, repository and judging requirements were checked against the [official rules](https://paypalaihackathon.devpost.com/rules). The technical, design, potential-use, proposal/consent and narrated-demo paragraphs above address those criteria without claiming scores or eligibility approval.
