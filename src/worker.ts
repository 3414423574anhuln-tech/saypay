import { DurableObject } from 'cloudflare:workers';
import { handle } from '@astrojs/cloudflare/handler';
import { JsonJournal } from './lib/journal';
import { applicationError } from './lib/errors';
import type { IntentEntry, JournalPage, StoreResult } from './lib/journal-types';

// One object per browser workspace, not a global journal. Values are JSON audit/draft records.
export class DraftJournal extends DurableObject<Env> {
  private journal = new JsonJournal(this.ctx.storage.kv, operation => this.ctx.storage.transactionSync(operation));
  private result<T>(operation: () => T): StoreResult<T> {
    try { return { ok: true, value: operation() }; }
    catch (error) { const failure = applicationError(error); return { ok: false, error: { stage: failure.stage === 'server' ? 'draft storage' : failure.stage, code: failure.code === 'INTERNAL_ERROR' ? 'STORAGE_FAILURE' : failure.code, message: failure.message, httpStatus: failure.httpStatus } }; }
  }
  create(entry: IntentEntry): StoreResult<IntentEntry> { return this.result(() => this.journal.create(entry)); }
  get(id: string): StoreResult<IntentEntry | null> { return this.result(() => this.journal.get(id)); }
  replace(entry: IntentEntry, expectedRevision: number): StoreResult<IntentEntry> { return this.result(() => this.journal.replace(entry, expectedRevision)); }
  list(before?: string): StoreResult<JournalPage> { return this.result(() => this.journal.list(before)); }
}
export default { fetch(request: Request, env: Env, ctx: ExecutionContext) { return handle(request, env, ctx); } };
