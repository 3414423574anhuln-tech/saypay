# SayPay

**Say it. Review it. Pay it.**

SayPay turns a one-sentence payment intent into a PayPal payment — with a human confirmation step in between. You state what you want to pay for; an AI agent drafts the order; you review and edit the draft on a confirmation card; only after you explicitly confirm does SayPay create the order and capture the payment through PayPal.

> The LLM proposes. The rules engine disposes. The human decides.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) — targeting *Best Use of PayPal + AI* and *Best Use of Agentic Commerce*.

## How it works

1. **Intent** — type a sentence: "Pay Alice 25 dollars for the avatar she drew, note: October commission."
2. **Draft** — the AI parses the intent into a structured order draft (payee, items, currency, total, note). Missing or ambiguous fields are never guessed — SayPay asks.
3. **Confirm** — you review the draft card, edit anything, and confirm. Nothing is charged before this step.
4. **Pay** — SayPay creates the order via the PayPal Orders API, you approve in the PayPal sandbox, and the payment is captured. Status is always read back from the API.

## Guardrails

- **Confirmation-first**: no write API is called before explicit human confirmation.
- **Hard caps**: a per-transaction limit (default USD 200) is enforced at draft time and again before order creation.
- **Injection resistance**: instructions embedded in the intent text that try to alter the amount or payee are detected, flagged on the confirmation card, and never executed silently.
- **Audit trail**: every intent, draft, confirmation, and order status transition is logged and replayable.

## Status

Work in progress — hackathon build in flight. The payment chain (create → approve → capture) is verified end-to-end against the PayPal sandbox.

## Tech stack

- Astro SSR + TypeScript, deployed on Cloudflare Workers
- PayPal REST Orders API v2 (sandbox)
- LLM with structured (JSON-schema) output for intent parsing

## Local development

1. Get sandbox credentials: log in to [developer.paypal.com](https://developer.paypal.com/) with any PayPal account → Apps & Credentials (Sandbox) → create an app.
2. Copy `.env.example` to `.env` and fill in your sandbox Client ID / Secret and LLM settings. **Never commit `.env`.**
3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Use the sandbox **Personal** test account (under Sandbox Accounts in the developer dashboard) to approve payments.

## Roadmap

- Webhook-driven status sync
- Payouts for multi-payee intents
- Voice input

## License

MIT — see [LICENSE](LICENSE).
