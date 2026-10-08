import type { Draft, ParseResult } from './draft-types';
import type { ManualOrder } from './types';

export type IntentState = 'PARSING' | 'CLARIFICATION' | 'DRAFT' | 'BLOCKED' | 'CONFIRMING' | 'CREATED' | 'APPROVED' | 'CAPTURING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export interface AuditFailure { stage: string; code: string; message: string; at: string }
export interface IntentEntry {
  id: string; revision: number; createdAt: string; updatedAt: string;
  rawIntent: string; answers: string[]; state: IntentState;
  result: ParseResult | null; aiDraft: Draft | null; edited: Draft | null; confirmed: Draft | null;
  parseHistory: { at: string; result: ParseResult }[];
  submission: ManualOrder | null; orderId: string | null; captureId: string | null; paypalStatus: string | null;
  error: AuditFailure | null;
  transitions: { state: IntentState; at: string; reason: string | null }[];
}
export interface JournalPage { entries: IntentEntry[]; next: string | null }
export interface DraftStore {
  create(entry: IntentEntry): Promise<IntentEntry>;
  get(id: string): Promise<IntentEntry | null>;
  replace(entry: IntentEntry, expectedRevision: number): Promise<IntentEntry>;
  list(before?: string): Promise<JournalPage>;
}
export type StoreResult<T> = { ok: true; value: T } | { ok: false; error: { stage: string; code: string; message: string; httpStatus: number } };
