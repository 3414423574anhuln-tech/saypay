import { AppError, applicationError } from './errors';
import { validateDraft } from './schema';
import { validatedInput } from './parsing-input';
import { enforcePaymentPolicy } from './payment-policy';
import { approvalUrl, finishApprovedOrder, readOrderStatus, signSubmittedOrder, verifiedSubmission } from './flow';
import type { PaymentCap } from './payment-policy';
import type { Draft, ParseResult, ParsingInput } from './draft-types';
import type { DraftStore, IntentEntry, IntentState } from './journal-types';
import type { ManualOrder, OrderStatus, PayPalConfiguration, PayPalService } from './types';

export type DraftEdits = Pick<Draft, 'payee' | 'items' | 'currency' | 'total' | 'note'>;
export interface IntentDependencies {
  store: DraftStore; parse: (input: ParsingInput) => Promise<ParseResult>;
  paypal: PayPalService; paypalConfig: PayPalConfiguration; cap: () => PaymentCap;
  forbiddenValues?: string[]; now?: () => string;
}
export class IntentFlow {
  private now: () => string;
  constructor(private dependencies: IntentDependencies) { this.now = dependencies.now ?? (() => new Date().toISOString()); }
  private secretCheck(value: unknown): void {
    const text = JSON.stringify(value);
    if (this.dependencies.forbiddenValues?.some(secret => secret && text.includes(secret))) throw new AppError('intent input', 'SENSITIVE_INPUT_BLOCKED', 'Configured credentials cannot be included in an intent, draft or audit record.', 422);
  }
  async get(id: string): Promise<IntentEntry> {
    const entry = await this.dependencies.store.get(id);
    if (!entry) throw new AppError('draft storage', 'DRAFT_NOT_FOUND', 'This intent is not in the current workspace.', 404);
    return entry;
  }
  private async save(entry: IntentEntry, patch: Partial<IntentEntry>, state?: IntentState, reason: string | null = null): Promise<IntentEntry> {
    const at = this.now();
    const transitions = [...entry.transitions];
    if (state && (transitions.at(-1)?.state !== state || reason !== transitions.at(-1)?.reason)) transitions.push({ state, at, reason });
    const next = { ...entry, ...patch, ...(state ? { state } : {}), updatedAt: at, transitions };
    this.secretCheck(next);
    return this.dependencies.store.replace(next, entry.revision);
  }
  private async fail(entry: IntentEntry, error: unknown, state: IntentState = 'FAILED', prefix = '', patch: Partial<IntentEntry> = {}): Promise<never> {
    let failure = applicationError(error);
    const safeText = JSON.stringify({ stage: failure.stage, code: failure.code, message: failure.message });
    if (this.dependencies.forbiddenValues?.some(secret => secret && safeText.includes(secret))) failure = new AppError('provider', 'UNSAFE_ERROR_REDACTED', 'A provider error was redacted. No successful payment is assumed.', 502);
    await this.save(entry, { ...patch, error: { stage: failure.stage, code: failure.code, message: failure.message, at: this.now() } }, state, prefix + failure.message);
    throw Object.assign(failure, { draftId: entry.id });
  }
  async reject(id: string, revision: number, error: unknown): Promise<never> {
    const entry = await this.get(id); this.revision(entry, revision); this.editable(entry);
    return this.fail(entry, error, 'BLOCKED', 'At submitted-form validation: ');
  }
  async start(intent: string): Promise<IntentEntry> {
    const input = validatedInput({ intent, answers: [] }); this.secretCheck(input);
    const at = this.now();
    const entry = await this.dependencies.store.create({ id: crypto.randomUUID(), revision: 0, createdAt: at, updatedAt: at, rawIntent: input.intent, answers: [], state: 'PARSING', result: null, aiDraft: null, edited: null, confirmed: null, parseHistory: [], submission: null, orderId: null, captureId: null, paypalStatus: null, error: null, transitions: [{ state: 'PARSING', at, reason: null }] });
    return this.parse(entry);
  }
  async answer(id: string, revision: number, answer: string): Promise<IntentEntry> {
    let entry = await this.get(id); this.revision(entry, revision);
    if (entry.state !== 'CLARIFICATION') throw new AppError('clarification', 'CLARIFICATION_NOT_OPEN', 'This intent is no longer waiting for a clarification answer.', 409);
    const input = validatedInput({ intent: entry.rawIntent, answers: [...entry.answers, answer] }); this.secretCheck(input);
    entry = await this.save(entry, { answers: input.answers, error: null }, 'PARSING');
    return this.parse(entry);
  }
  private async parse(entry: IntentEntry): Promise<IntentEntry> {
    let result: ParseResult;
    try { result = await this.dependencies.parse({ intent: entry.rawIntent, answers: entry.answers }); this.secretCheck(result); }
    catch (error) { return this.fail(entry, error); }
    entry = await this.save(entry, { result, aiDraft: result.kind === 'draft' ? result.draft : null, parseHistory: [...entry.parseHistory, { at: this.now(), result }], error: null }, result.kind === 'draft' ? 'DRAFT' : 'CLARIFICATION');
    if (result.kind === 'draft') {
      try { enforcePaymentPolicy(result.draft.currency, result.draft.total, this.dependencies.cap()); }
      catch (error) { return this.fail(entry, error, 'BLOCKED', 'At draft: '); }
    }
    return entry;
  }
  private revision(entry: IntentEntry, revision: number): void {
    if (revision !== entry.revision) throw new AppError('confirmation', 'STALE_DRAFT', 'Reload the stored card; this version was already changed or claimed.', 409);
  }
  private editable(entry: IntentEntry): void {
    if (!entry.aiDraft || entry.submission || !['DRAFT', 'BLOCKED', 'FAILED'].includes(entry.state)) throw new AppError('confirmation', 'DRAFT_NOT_EDITABLE', 'This intent is already executing or has no complete draft. Use its status/recovery view.', 409);
  }
  private candidate(entry: IntentEntry, edits: DraftEdits): Draft {
    const expected = ['payee', 'items', 'currency', 'total', 'note'];
    if (Object.keys(edits).length !== expected.length || expected.some(key => !Object.hasOwn(edits, key))) throw new AppError('confirmation', 'INVALID_EDIT_FIELDS', 'Only the visible payment fields may be edited.', 422);
    this.secretCheck(edits);
    return validateDraft({ ...entry.aiDraft!, ...edits });
  }
  async edit(id: string, revision: number, edits: DraftEdits): Promise<IntentEntry> {
    let entry = await this.get(id); this.revision(entry, revision); this.editable(entry);
    let candidate: Draft;
    try { candidate = this.candidate(entry, edits); }
    catch (error) { return this.fail(entry, error, 'BLOCKED', 'At edit validation: '); }
    entry = await this.save(entry, { edited: candidate, error: null }, 'DRAFT', 'User edits validated; no order created.');
    try { enforcePaymentPolicy(candidate.currency, candidate.total, this.dependencies.cap()); }
    catch (error) { return this.fail(entry, error, 'BLOCKED', 'At edit validation: '); }
    return entry;
  }
  async confirm(id: string, revision: number, edits: DraftEdits): Promise<string> {
    let entry = await this.get(id); this.revision(entry, revision); this.editable(entry);
    let confirmed: Draft | undefined; let submission: ManualOrder;
    try {
      confirmed = this.candidate(entry, edits);
      enforcePaymentPolicy(confirmed.currency, confirmed.total, this.dependencies.cap());
      if (!confirmed.payee.email) throw new AppError('confirmation', 'PAYEE_EMAIL_REQUIRED', 'Fill the actual sandbox merchant email on the card before confirming.', 422);
      const description = confirmed.note || confirmed.items.map(item => item.name).join('; ');
      if (!description || new TextEncoder().encode(description).length > 127) throw new AppError('confirmation', 'INVALID_DESCRIPTION', 'Use a note or item summary of 1–127 UTF-8 bytes for the PayPal purpose.', 422);
      submission = { reference: entry.id, payeeEmail: confirmed.payee.email.toLowerCase(), amount: confirmed.total.toFixed(2), currency: 'USD', description };
    } catch (error) { return this.fail(entry, error, 'BLOCKED', 'At confirmation: ', confirmed ? { edited: confirmed } : {}); }
    // Atomic revision claim + persisted confirmed snapshot precede every PayPal write.
    entry = await this.save(entry, { confirmed, edited: confirmed, submission, error: null }, 'CONFIRMING', 'Human confirmed the validated stored draft and visible edits.');
    let created;
    try { created = await this.dependencies.paypal.createOrder(submission, await signSubmittedOrder(submission, this.dependencies.paypalConfig), submission.reference); }
    catch (error) { return this.fail(entry, error); }
    entry = await this.save(entry, { orderId: created.id, paypalStatus: created.status, error: null }, 'CREATED');
    try { return approvalUrl(created); }
    catch (error) { return this.fail(entry, error); }
  }
  private assertReadBack(entry: IntentEntry, result: OrderStatus): void {
    this.assertSubmission(entry, result.submitted, result.orderId);
  }
  private assertSubmission(entry: IntentEntry, submitted: ManualOrder, orderId: string): void {
    if (!entry.submission || submitted.reference !== entry.id || JSON.stringify(submitted) !== JSON.stringify(entry.submission) || (entry.orderId && entry.orderId !== orderId)) throw new AppError('PayPal read-back', 'CONFIRMED_DRAFT_MISMATCH', 'The API order differs from this stored confirmed draft. Capture and success are blocked.', 422);
  }
  private async observed(entry: IntentEntry, result: OrderStatus): Promise<IntentEntry> {
    this.assertReadBack(entry, result);
    const state = result.completed ? 'COMPLETED' : result.paypalStatus === 'APPROVED' ? 'APPROVED' : 'CREATED';
    // Preserve cancellation/failure context when a read only reports the order is still CREATED.
    const preserved = !result.completed && (entry.state === 'CANCELLED' || entry.state === 'CAPTURING' || (state === 'CREATED' && entry.state === 'FAILED')) ? entry.state : state;
    return this.save(entry, { orderId: result.orderId, paypalStatus: result.paypalStatus, captureId: result.transactionId, error: null }, preserved);
  }
  async status(id: string, token?: string): Promise<IntentEntry> {
    const entry = await this.get(id);
    const orderId = token || entry.orderId;
    if (!orderId || !entry.submission) throw new AppError('PayPal recovery', 'ORDER_ID_REQUIRED', 'If order creation had an unknown outcome, recover its token from PayPal before retrying. This app does not create a replacement order.', 409);
    if (entry.orderId && entry.orderId !== orderId) throw new AppError('PayPal recovery', 'ORDER_ID_MISMATCH', 'The token does not match this intent.', 422);
    let result: OrderStatus;
    try { result = await readOrderStatus(orderId, this.dependencies.paypal, this.dependencies.paypalConfig); this.assertReadBack(entry, result); }
    catch (error) { return this.fail(entry, error); }
    return this.observed(entry, result);
  }
  async finish(id: string, token: string): Promise<IntentEntry> {
    let entry = await this.status(id, token);
    if (entry.paypalStatus !== 'APPROVED' || entry.state === 'CANCELLED') return entry;
    // A lease survives a restart. Concurrent callbacks wait; a later explicit retry uses W1's stable capture request ID.
    const previousClaim = [...entry.transitions].reverse().find(event => event.state === 'CAPTURING');
    if (entry.state === 'CAPTURING' && previousClaim && Date.parse(this.now()) - Date.parse(previousClaim.at) < 120000) throw new AppError('PayPal capture', 'CAPTURE_IN_PROGRESS', 'Capture is already pending. Read status; if still approved after two minutes, explicitly finish it again using the same capture request ID.', 409);
    entry = await this.save(entry, { error: null }, 'CAPTURING', `Capture claim ${crypto.randomUUID()}`);
    let result: OrderStatus;
    const service = this.dependencies.paypal;
    const bound: PayPalService = {
      createOrder: (...args) => service.createOrder(...args),
      getOrder: async orderId => { const order = await service.getOrder(orderId); this.assertSubmission(entry, await verifiedSubmission(order, this.dependencies.paypalConfig), order.id); return order; },
      captureOrder: async (orderId, requestId) => {
        const current = await this.get(id);
        if (current.state !== 'CAPTURING') throw new AppError('PayPal capture', 'CAPTURE_CLAIM_LOST', 'The stored capture claim changed. Read status before continuing.', 409);
        return service.captureOrder(orderId, requestId);
      },
    };
    try { result = await finishApprovedOrder(token, bound, this.dependencies.paypalConfig); this.assertReadBack(entry, result); }
    catch (error) { return this.fail(await this.get(id), error); }
    // A concurrent read may advance the revision while the provider call is pending.
    return this.observed(await this.get(id), result);
  }
  async cancel(id: string, token: string): Promise<IntentEntry> {
    const entry = await this.get(id);
    if (entry.state === 'CAPTURING') throw new AppError('PayPal cancellation', 'CAPTURE_IN_PROGRESS', 'Capture is already pending. Read the PayPal status; cancellation cannot undo it.', 409);
    if (!entry.orderId || entry.orderId !== token || entry.state === 'COMPLETED') throw new AppError('PayPal cancellation', 'CANCEL_TOKEN_MISMATCH', 'This cancellation does not match an open checkout in this workspace.', 422);
    return this.save(entry, {}, 'CANCELLED', 'Browser checkout cancelled; this does not void the PayPal order. No capture called.');
  }
}
