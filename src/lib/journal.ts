import { AppError } from './errors';
import type { IntentEntry, JournalPage } from './journal-types';

export interface JsonKV {
  get(key: string): unknown;
  put(key: string, value: string): void;
  list(options: { prefix: string; reverse: boolean; limit: number; end?: string }): Iterable<[string, unknown]>;
}
export function draftId(value: string): string {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) throw new AppError('draft storage', 'INVALID_DRAFT_ID', 'Open a draft from this workspace.', 400);
  return value;
}
export class JsonJournal {
  constructor(private kv: JsonKV, private transaction: <T>(operation: () => T) => T) {}
  get(id: string): IntentEntry | null {
    const raw = this.kv.get(`draft:${draftId(id)}`);
    if (raw === undefined) return null;
    try { const entry = JSON.parse(raw as string) as IntentEntry; if (entry.id !== id || !Number.isSafeInteger(entry.revision)) throw new Error(); return entry; }
    catch { throw new AppError('draft storage', 'CORRUPT_DRAFT', 'The persisted draft could not be read safely. No payment was initiated.', 503); }
  }
  private write(entry: IntentEntry): IntentEntry {
    const raw = JSON.stringify(entry);
    if (new TextEncoder().encode(raw).length > 128000) throw new AppError('draft storage', 'AUDIT_RECORD_TOO_LARGE', 'This intent exceeds the audit record size limit. Existing records remain stored.', 413);
    this.kv.put(`draft:${draftId(entry.id)}`, raw); return JSON.parse(raw) as IntentEntry;
  }
  create(entry: IntentEntry): IntentEntry {
    return this.transaction(() => {
      if (this.get(entry.id)) throw new AppError('draft storage', 'DRAFT_EXISTS', 'This intent already exists. Open the stored card.', 409);
      const saved = this.write({ ...entry, revision: 0 });
      this.kv.put(`index:${entry.createdAt}:${entry.id}`, entry.id); return saved;
    });
  }
  replace(entry: IntentEntry, expectedRevision: number): IntentEntry {
    return this.transaction(() => {
      const current = this.get(entry.id);
      if (!current) throw new AppError('draft storage', 'DRAFT_NOT_FOUND', 'This draft is not in this workspace.', 404);
      if (current.revision !== expectedRevision) throw new AppError('confirmation', 'STALE_DRAFT', 'The card changed or another request already claimed it. Reload the stored card before continuing.', 409);
      if (entry.createdAt !== current.createdAt || entry.rawIntent !== current.rawIntent) throw new AppError('draft storage', 'IMMUTABLE_INTENT', 'The original intent cannot be replaced.', 422);
      return this.write({ ...entry, revision: current.revision + 1 });
    });
  }
  list(before?: string): JournalPage {
    if (before && !/^index:\d{4}-\d{2}-\d{2}T[\d:.]+Z:[a-f0-9-]{36}$/.test(before)) throw new AppError('draft storage', 'INVALID_AUDIT_CURSOR', 'Open the audit page using its navigation links.');
    const rows = [...this.kv.list({ prefix: 'index:', reverse: true, limit: 21, ...(before ? { end: before } : {}) })];
    const visible = rows.slice(0, 20);
    return { entries: visible.map(([, id]) => this.get(id as string)).filter((entry): entry is IntentEntry => !!entry), next: rows.length > 20 ? visible.at(-1)![0] : null };
  }
}
