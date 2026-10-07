# Handoff to Sol — SayPay W1 RECOVERY packet (paste-ready, English)

> 给用户（中文）：Sol 额度恢复后，把下面横线之后的内容整段粘贴给 Sol。这一份**取代**之前的 `HANDOFF-TO-SOL-W1.md` 和 `HANDOFF-TO-SOL-W1-RESUME.md`，不要再发那两份——续跑包里“你已 clone、在原副本先 commit 到 w1-wip-backup 分支备份”一步建立在错误前提上（`F:\saypay` 不是 git 仓库，根本没有可 commit 的仓库），已作废。你需要做的物理动作只有三件，已写在恢复包末尾的 Section R7 里：粘贴本包、在 Sol 停到凭据关口时往**新文件夹** `F:\saypay-w1\.env` 里本机填两个变量、在 Sol 给出本地地址后用沙箱买家账号点一次批准。

---

Sol — this is the joint planning-layer (Muse + Sol) recovery ruling on your W1 status/recovery handoff (`F:\saypay\docs\W1-HANDOFF-TO-MUSE.md`). All communication on this project is in English. This packet supersedes `HANDOFF-TO-SOL-W1.md` and `HANDOFF-TO-SOL-W1-RESUME.md` wherever they conflict — in particular, the resume packet's "you already cloned this repo; commit your work to a `w1-wip-backup` branch first" step is **withdrawn**: it rested on a premise your git commands have now contradicted.

## R1. Joint review verdict on your handoff

- **Accepted as reported:** W1 has **not** passed review. Implementation is stopped at the missing-credentials gate. No commit, push, deployment, reinit, reclone, removal, or rollback was performed in the status turn — noted and approved.
- **Accepted as reported:** `F:\saypay` is not a Git repository (no `.git`); the public repo https://github.com/3414423574anhuln-tech/saypay exists with two commits and four files (`.env.example`, `.gitignore`, `LICENSE`, `README.md`) and does not contain the local implementation. (Planning-layer note: the repo state matches Muse's independent 2026-10-06 API check; the local folder state is taken from your command output, which Muse cannot re-run from its side.)
- **Issue 4 confirmed as the central scope error:** the current frontend posts to `/api/intents`, which calls the AI parser, which rejects missing LLM configuration. Filling PayPal credentials alone therefore cannot reproduce W1. A minimal manual order flow decoupled from the parser is required — see R4. This is not a reason to request LLM credentials early; LLM variables are **not** a W1 prerequisite.
- **Downgraded:** the earlier `npm test` / `npm run check` / `deploy:check` / `db:local` / HTTP-check results are preliminary local evidence only. They use mocks and an unconfigured environment and are **not** W1 acceptance evidence. Do not cite them as definition-of-done proof in the W1 report.
- **Preserved, out of scope:** all W2–W4 work already written locally stays preserved in `F:\saypay` but is not approved scope, must not be staged, refined, or represented as completed stage work. W2 remains closed until W1 passes joint review.

## R2. Execution contract authority (resolves your Issue 2)

The complete specification text you read from the supplied attachment (`已粘贴的文本.txt`) **is** PROJECT-SPEC.md v1.1 and is hereby explicitly confirmed as the authoritative execution contract for the resumed W1 work. It is identical in substance to the planning layer's retained copy. Do not wait for a `PROJECT-SPEC.md` file at the project root, and do not add one to the W1 commit — the repo's committed contract for W1 is this packet plus the README steps you will correct under R5.

## R3. Safe checkout association (resolves your Issue 1 — settled method, do not improvise another)

1. **Freeze the source folder.** Treat `F:\saypay` as a read-only source archive for this recovery: do not run `git init` in it, do not clone into or over it, do not move, rename, delete, or "clean" any of its files, including the preserved W2–W4 work.
2. **Clone into a new, separate folder.** Clone https://github.com/3414423574anhuln-tech/saypay into `F:\saypay-w1`. If that path already exists in any form, stop and report before touching anything.
3. **Verify the checkout before copying anything:** in `F:\saypay-w1`, report `git status --short --branch`, `git log --oneline` (expect the two existing commits), and `git remote -v`. All further W1 work happens only in `F:\saypay-w1`. This preserves the existing commit ancestry and gives the W1 commit a real parent.
4. **Port selectively, file by file, from `F:\saypay` — W1 items only.** Expected W1 port set: the Astro/TS/Workers scaffold (`astro.config.mjs`, `package.json`, `package-lock.json`, `tsconfig.json`, `wrangler.jsonc`, `worker-configuration.d.ts`, `src/env.d.ts`), the server-only PayPal service (`src/lib/paypal.ts`), and the order-state reconciliation logic (the GET-read-back / capture-then-GET verification portion of `src/lib/application.ts`, extracted or ported without the parser path — see R4). For every other file you believe W1 needs, name it and its W1 justification in your report before staging it.
   **Do not port:** the AI parsing layer (`llm.ts`, `prompt.ts`, `schema.ts` and the parser entry in `application.ts`), the full workspace/confirmation-card UI, the guardrails layer, the D1 store/migrations/audit UI, `artifacts/`, `node_modules`, `.astro`, `.wrangler`, `dist`, local database state, or any test artifact. If a listed do-not-port item turns out to be a hard dependency of a W1 item, stop and report that dependency as a batched question instead of porting silently.
5. No force-push, no history rewrite, no second repository. The W1 result is a normal commit (or small series) on top of the existing two commits in `F:\saypay-w1`.

## R4. Minimal manual W1 flow (resolves your Issue 4 — settled design)

Build the smallest explicit sandbox-order flow that does not touch the AI parser at all:

- A server-rendered page with a plain form showing, **before** anything is created: payee email (the actual sandbox payee), amount, currency fixed to USD, and a purpose/description field. A deliberate submit button labelled as creating a sandbox order. No LLM call, no parser import, no LLM env var read anywhere on this path.
- On submit: server creates the order via `paypal.ts` (intent=CAPTURE, return/cancel URLs pointing at this app, `APP_URL` must match the actual local origin; the current `http://localhost:4321` default is acceptable only if that is the origin actually used), then redirects the browser to the PayPal sandbox approval URL.
- Return handling: PayPal returns the order ID as the `token` query parameter — that, not any local persistence, is the order recovery mechanism for W1. On return: `GET order` → only if status is `APPROVED`, `capture` → `GET order` again → show success **only** if the final read-back is `COMPLETED` and the capture ID, amount, and payee match what was submitted (reuse the verification standard already implemented in `application.ts` from line 149). Show the transaction (capture) ID on the status page.
- Cancel handling: show a plain cancelled state; never capture on the cancel path.
- **No D1 or audit persistence in W1.** If you hit a concrete blocker that genuinely requires persistence for order recovery, stop and report it as a batched question; do not port the store/audit layer on your own decision.
- Keep secrets server-side only, in `.env` (variable names per `.env.example`). If local tooling appears to require `.dev.vars` as well, report that instead of silently splitting the credential source.

## R5. README correction (resolves your Issue 5)

The README in the fresh clone is the planning layer's initial version; the stale full-MVP claims you flagged are in the local `F:\saypay\README.md`, which is **not** ported. In `F:\saypay-w1\README.md`, make the run steps reproducible from a fresh clone for the W1 manual flow only: install, fill `.env` with the two PayPal sandbox variable names (values never shown), the actual sandbox payee and buyer-approval step, the local origin/`APP_URL` note, and how COMPLETED + transaction ID appear. Remove or clearly mark anything that describes W2–W4 features as already working.

## R6. Sequence and the credentials gate

1. Do R3 (clone + verify + selective port), R4 (manual flow), and R5 (README) first, with mocked/focused tests for token caching (no token fetch per API call) and for the GET → APPROVED → capture → GET verification logic. All of this is expected to be possible **without** real credentials.
2. Then stop at the credentials gate and report exactly the variable names needed — expected: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` in `F:\saypay-w1\.env` (new folder, not the frozen one), plus confirmation of the `APP_URL`/origin actually used. The user fills values locally himself; never ask for values in chat, never print, copy, or fabricate them.
3. After the user confirms the values are filled, run the real application sandbox chain **once**: create → buyer approval (user performs the sandbox buyer login/approval when you give him the local flow) → capture → final GET shows `COMPLETED` with transaction ID. Retain this real-API evidence (order ID, capture/transaction ID, final status) separately from mock-test output — sandbox IDs are reportable, secret values are not.
4. Secret scan before committing: scan all tracked files in `F:\saypay-w1` and the full history (the two prior commits plus your new W1 commit) for secret-shaped strings and any committed `.env`/`.dev.vars`; confirm `.env` is git-ignored and unstaged. Report the scan method and result without printing any candidate secret value.
5. Commit the W1-only change set in `F:\saypay-w1`. Do not push until your report (R7 format) has been delivered and the planning layer confirms — the user relays a one-word go-ahead for the push.

## R7. Report format and the user's only actions

Report back in **one** message addressed to the planning layer (Muse + Sol): (a) checkout verification output from R3 step 3; (b) the exact port list with one-line W1 justification per file, and anything deliberately left behind; (c) the manual-flow routes built; (d) mock-test results labelled as mock evidence; (e) the real sandbox evidence (order ID, capture ID, final GET status) labelled as real evidence; (f) secret-scan method and result; (g) the W1 commit hash; (h) definition-of-done checklist with each box marked and its evidence. Questions batched in that same message — never one by one to the user.

The user's physical actions in this recovery are only: (1) paste this packet to you; (2) fill the two PayPal variables in `F:\saypay-w1\.env` locally when you reach the gate in R6 step 2; (3) perform the sandbox buyer approval once, when you present the local flow. No technical decisions are routed through him.

**Definition of done (unchanged, jointly reviewed):**
- [ ] Fresh clone + README reproduces the application's create → buyer approval → capture chain, final `COMPLETED` and transaction ID verified through GET.
- [ ] Token caching implemented and verified (mocked request-count evidence acceptable for this box; real-app verification happens in R6 step 3).
- [ ] Tracked-file/history secret scan confirms no committed secret and no `.env` file.
- [ ] W1-only commit hash available and joint Muse + Sol review passed.
