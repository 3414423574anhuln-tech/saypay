# W4 deployment — account-owner secret entry

Target: Worker `saypay` on the existing authenticated Cloudflare account; SQLite Durable Object class `DraftJournal`, binding `DRAFT_JOURNAL`, migration `w3-journal-v1`. Work in `F:\saypay-w1`. No new credential is required.

Provisioned URL: [public workspace](https://saypay.3414423574anhuln.workers.dev/parse). The remote journal served its first empty audit list and now persists both completed public acceptance records. The account owner completed all five hidden input commands; `wrangler secret list --name saypay` verified the five names as `secret_text`, without reading their values. Normal and injection runs each completed a human-approved USD 10.00 sandbox payment, independently verified through PayPal GET.

Sol builds/tests/scans and provisions the Worker first. The public origin is then supplied as `APP_URL`, with `PAYPAL_ENV=sandbox`, `MAX_TRANSACTION_USD=200` and `SANDBOX_PAYEE_ALLOWLIST` containing the existing sandbox merchant. These noncredential deployment values are set through Wrangler deployment arguments; no actual configured LLM value belongs in the source config.

Once Sol identifies the provisioned Worker, the account owner runs these commands in a local PowerShell terminal. Each command requests a hidden interactive value. Read the corresponding value from the existing local `.env` yourself; enter it at the prompt. Do not include a value in command arguments or chat. Do not send screenshots of secret entry.

```powershell
Set-Location -LiteralPath 'F:\saypay-w1'
.\node_modules\.bin\wrangler.cmd secret put PAYPAL_CLIENT_ID --name saypay
.\node_modules\.bin\wrangler.cmd secret put PAYPAL_CLIENT_SECRET --name saypay
.\node_modules\.bin\wrangler.cmd secret put LLM_API_BASE --name saypay
.\node_modules\.bin\wrangler.cmd secret put LLM_API_KEY --name saypay
.\node_modules\.bin\wrangler.cmd secret put LLM_MODEL --name saypay
```

The five names use the already selected sandbox app and LLM settings; no fallback is selected. Wrangler stores these as encrypted server bindings. `secret put` deploys a version immediately, so real acceptance starts only after all five entries are complete. `.env` is not uploaded. Sol subsequently checks names only with `wrangler secret list`, verifies the public URL, then requests at most two human sandbox buyer approvals. If authentication requires renewal, the owner completes the exact login/authorization step; Sol does not approve it.

[Cloudflare secrets documentation](https://developers.cloudflare.com/workers/configuration/secrets/) documents interactive secret input and immediate deployment. [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) documents variable replacement; the deployed arguments must be retained on subsequent deployments. No new secret file, CI integration or public account login feature is introduced.
