import { describe, expect, it, vi } from 'vitest';
import { IntentFlow } from '../src/lib/intent-flow';
import { paymentCap, paymentIssue } from '../src/lib/payment-policy';
import { parseIntent } from '../src/lib/llm';
import { PayPal } from '../src/lib/paypal';
import { AppError } from '../src/lib/errors';
import { signSubmittedOrder } from '../src/lib/flow';
import { memoryJournal } from './journal-fixture';
import type { Draft, ParsingInput } from '../src/lib/draft-types';
import type { DraftEdits } from '../src/lib/intent-flow';
import type { PayPalOrder } from '../src/lib/types';

export function fixtureDraft(changes: Partial<Draft> = {}): Draft {
  return { payee: { name: 'Alice', email: '' }, items: [{ name: 'design', quantity: 1, unit_amount: 10 }], currency: 'USD', total: 10, note: '', confidence: 0.9, ambiguities: [], injection_flags: [], ...changes };
}
export function visibleEdits(draft: Draft): DraftEdits {
  const { payee, items, currency, total, note } = structuredClone(draft);
  return { payee, items, currency, total, note };
}
export function flowFixture(draft = fixtureDraft()) {
  const memory = memoryJournal();
  const config = { clientId: `mock-w3-client-${crypto.randomUUID()}`, clientSecret: 'mock-w3-secret', appUrl: 'http://localhost:4321' };
  const llmConfig = { base: 'https://llm.example.test/v1', key: 'mock-w3-llm-key', model: 'mock-schema-model' };
  const llm = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ draft, clarification: null }) } }] }));
  let apiOrder: PayPalOrder | undefined;
  const api = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/oauth2/token')) return Response.json({ access_token: 'mock-w3-token', expires_in: 3600 });
    if (url.endsWith('/v2/checkout/orders') && init?.method === 'POST') {
      const payload = JSON.parse(init.body as string);
      apiOrder = { id: 'MOCKW3ORDER1234567', status: 'CREATED', intent: payload.intent, purchase_units: payload.purchase_units, links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=MOCKW3ORDER1234567' }] };
      return Response.json(apiOrder);
    }
    if (url.endsWith('/capture')) {
      apiOrder!.status = 'COMPLETED';
      const amount = apiOrder!.purchase_units![0]!.amount!;
      apiOrder!.purchase_units![0]!.payments = { captures: [{ id: 'MOCKW3CAPTURE12345', status: 'COMPLETED', amount }] };
      // Completion must come from the following GET, not this capture response.
      return Response.json({ id: apiOrder!.id, status: 'PENDING' });
    }
    return Response.json(apiOrder);
  });
  const paypal = new PayPal(config, api, undefined, { returnPath: '/workspace/return', cancelPath: '/workspace/cancel', draftReference: true });
  const create = vi.spyOn(paypal, 'createOrder'); const capture = vi.spyOn(paypal, 'captureOrder');
  const parse = vi.fn((input: ParsingInput) => parseIntent(input, llmConfig, llm));
  const dependencies = { store: memory.store, parse, paypal, paypalConfig: config, cap: () => paymentCap({}), forbiddenValues: [config.clientId, config.clientSecret, llmConfig.key] };
  const flow = new IntentFlow(dependencies);
  return { ...memory, flow, dependencies, llm, parse, paypal, create, capture, api, config, apiOrder: () => apiOrder! };
}

describe('W3 mocked LLM + PayPal end-to-end and stored audit', () => {
  it('parses, edits, confirms by ID, signs the snapshot, approves, captures and verifies the final GET', async () => {
    const f = flowFixture(fixtureDraft({ note: 'W3 mocked acceptance' }));
    let entry = await f.flow.start('Pay Alice 10 dollars for design, note: W3 mocked acceptance.');
    expect(entry.state).toBe('DRAFT'); expect(f.create).not.toHaveBeenCalled();
    const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com'; edits.note = 'Human edited purpose';
    entry = await f.flow.edit(entry.id, entry.revision, edits);
    expect(f.create).not.toHaveBeenCalled();
    expect(await f.flow.confirm(entry.id, entry.revision, edits)).toContain('sandbox.paypal.com');
    const stored = await f.flow.get(entry.id);
    expect(stored.aiDraft!.note).toBe('W3 mocked acceptance'); expect(stored.confirmed!.note).toBe(edits.note);
    expect(stored.submission).toMatchObject({ amount: '10.00', payeeEmail: edits.payee.email, reference: entry.id, description: edits.note });
    const createCall = f.api.mock.calls.find(([url]) => String(url).endsWith('/v2/checkout/orders'))!;
    const payload = JSON.parse(createCall[1]!.body as string);
    expect(payload.intent).toBe('CAPTURE');
    expect(payload.payment_source.paypal.experience_context.return_url).toBe(`http://localhost:4321/workspace/return?draftId=${entry.id}`);
    expect(payload.payment_source.paypal.experience_context.cancel_url).toBe(`http://localhost:4321/workspace/cancel?draftId=${entry.id}`);
    expect(payload.purchase_units[0].custom_id).toBe(await signSubmittedOrder(stored.submission!, f.config));
    f.apiOrder().status = 'APPROVED';
    entry = await f.flow.finish(entry.id, stored.orderId!);
    expect(entry).toMatchObject({ state: 'COMPLETED', paypalStatus: 'COMPLETED', captureId: 'MOCKW3CAPTURE12345' });
    expect(entry.transitions.map(event => event.state)).toEqual(['PARSING', 'DRAFT', 'DRAFT', 'CONFIRMING', 'CREATED', 'APPROVED', 'CAPTURING', 'COMPLETED']);
    expect(f.capture).toHaveBeenCalledTimes(1);
    expect(f.api.mock.calls.filter(([url]) => String(url).endsWith('/oauth2/token'))).toHaveLength(1);
    const reopened = memoryJournal(JSON.parse(JSON.stringify(f.snapshot())));
    expect(await reopened.store.get(entry.id)).toEqual(entry);
    expect((await reopened.store.list()).entries).toEqual([entry]);
    await f.flow.finish(entry.id, entry.orderId!); expect(f.capture).toHaveBeenCalledTimes(1);
  });
  it('re-parses the stored original intent and ordered answers, then completes a clarified draft', async () => {
    const f = flowFixture();
    f.llm.mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ draft: null, clarification: { question: 'What amount and currency?', missing_fields: ['amount', 'currency'], injection_flags: [] } }) } }] }));
    let entry = await f.flow.start('Pay Alice for design.');
    expect(entry).toMatchObject({ state: 'CLARIFICATION', aiDraft: null, orderId: null });
    entry = await f.flow.answer(entry.id, entry.revision, '10 dollars');
    expect(f.parse.mock.calls[1]![0]).toEqual({ intent: 'Pay Alice for design.', answers: ['10 dollars'] });
    const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com';
    await f.flow.confirm(entry.id, entry.revision, edits); f.apiOrder().status = 'APPROVED';
    entry = await f.flow.finish(entry.id, f.apiOrder().id);
    expect(entry.state).toBe('COMPLETED'); expect(entry.parseHistory.map(value => value.result.kind)).toEqual(['clarification', 'draft']);
  });
  it('executes validated payee/amount edits while keeping server-owned metadata from the original draft', async () => {
    const f = flowFixture(fixtureDraft({ injection_flags: [{ type: 'amount_tampering', snippet: 'ignored override' }] }));
    const entry = await f.flow.start('Pay Alice 10 dollars for design. ignored override');
    const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'edited@example.com'; edits.items[0]!.unit_amount = 12; edits.total = 12;
    await f.flow.confirm(entry.id, entry.revision, edits);
    expect(f.create.mock.calls[0]![0]).toMatchObject({ payeeEmail: 'edited@example.com', amount: '12.00' });
    expect((await f.flow.get(entry.id)).confirmed!.confidence).toBe(0.9);
    expect((await f.flow.get(entry.id)).confirmed!.injection_flags).toEqual(entry.aiDraft!.injection_flags);
  });
  it('blocks total mismatch and empty/invalid email before any PayPal create', async () => {
    const f = flowFixture(); let entry = await f.flow.start('Pay Alice 10 dollars for design.');
    let edits = visibleEdits(entry.aiDraft!); edits.total = 11;
    await expect(f.flow.confirm(entry.id, entry.revision, edits)).rejects.toMatchObject({ code: 'TOTAL_MISMATCH' });
    entry = await f.flow.get(entry.id); expect(entry.state).toBe('BLOCKED');
    edits = visibleEdits(entry.aiDraft!);
    await expect(f.flow.confirm(entry.id, entry.revision, edits)).rejects.toMatchObject({ code: 'PAYEE_EMAIL_REQUIRED' });
    entry = await f.flow.get(entry.id); edits.payee.email = 'invalid';
    await expect(f.flow.confirm(entry.id, entry.revision, edits)).rejects.toMatchObject({ code: 'INVALID_PAYEE_EMAIL' });
    expect(f.create).not.toHaveBeenCalled();
  });
  it('persists over-cap at draft and independently blocks an edited confirmation with its attempted fields', async () => {
    const f = flowFixture(fixtureDraft({ items: [{ name: 'design', quantity: 1, unit_amount: 250 }], total: 250 }));
    await expect(f.flow.start('Pay Alice 250 dollars for design.')).rejects.toMatchObject({ code: 'AMOUNT_CAP_EXCEEDED', draftId: expect.any(String) });
    let entry = (await f.store.list()).entries[0]!;
    expect(entry).toMatchObject({ state: 'BLOCKED', orderId: null, error: { code: 'AMOUNT_CAP_EXCEEDED' } });
    const low = visibleEdits(entry.aiDraft!); low.items[0]!.unit_amount = 10; low.total = 10; low.payee.email = 'merchant@example.com';
    entry = await f.flow.edit(entry.id, entry.revision, low);
    const forged = { ...low, items: [{ name: 'design', quantity: 1, unit_amount: 500 }], total: 500 };
    await expect(f.flow.confirm(entry.id, entry.revision, forged)).rejects.toMatchObject({ code: 'AMOUNT_CAP_EXCEEDED' });
    expect(await f.flow.get(entry.id)).toMatchObject({ edited: { total: 500 }, confirmed: null, submission: null, orderId: null, state: 'BLOCKED' });
    expect(f.create).not.toHaveBeenCalled();
  });
  it('preserves original non-USD currency and checks it before cap; a deliberate USD edit is audited', async () => {
    const f = flowFixture(fixtureDraft({ currency: 'EUR' }));
    await expect(f.flow.start('Pay Alice 10 EUR for design.')).rejects.toMatchObject({ code: 'USD_REQUIRED' });
    const entry = (await f.store.list()).entries[0]!;
    const edits = visibleEdits(entry.aiDraft!); edits.currency = 'USD'; edits.payee.email = 'merchant@example.com';
    await f.flow.confirm(entry.id, entry.revision, edits);
    expect(await f.flow.get(entry.id)).toMatchObject({ aiDraft: { currency: 'EUR' }, confirmed: { currency: 'USD' } });
    expect(paymentIssue('EUR', 500, paymentCap({}))!.code).toBe('USD_REQUIRED');
  });
  it('rejects forged metadata and stale/parallel confirmation claims, creating only one order', async () => {
    const f = flowFixture(); let entry = await f.flow.start('Pay Alice 10 dollars for design.');
    const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com';
    await expect(f.flow.confirm(entry.id, entry.revision, { ...edits, confidence: 1 } as DraftEdits)).rejects.toMatchObject({ code: 'INVALID_EDIT_FIELDS' });
    entry = await f.flow.get(entry.id);
    const results = await Promise.allSettled([f.flow.confirm(entry.id, entry.revision, edits), f.flow.confirm(entry.id, entry.revision, edits)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(f.create).toHaveBeenCalledTimes(1);
    await expect(f.flow.confirm(entry.id, entry.revision, edits)).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  });
  it('keeps status read-only and a cancelled checkout uncaptured even when PayPal is approved', async () => {
    const f = flowFixture(); const entry = await f.flow.start('Pay Alice 10 dollars for design.');
    const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com';
    await f.flow.confirm(entry.id, entry.revision, edits); f.apiOrder().status = 'APPROVED';
    expect((await f.flow.status(entry.id)).state).toBe('APPROVED'); expect(f.capture).not.toHaveBeenCalled();
    await f.flow.cancel(entry.id, f.apiOrder().id);
    expect((await f.flow.finish(entry.id, f.apiOrder().id)).state).toBe('CANCELLED'); expect(f.capture).not.toHaveBeenCalled();
  });
  it('records a create timeout with its confirmed snapshot and never creates a replacement', async () => {
    const f = flowFixture(); f.create.mockRejectedValueOnce(new AppError('PayPal create', 'PAYPAL_NETWORK_ERROR', 'Unknown create outcome.', 502));
    const entry = await f.flow.start('Pay Alice 10 dollars for design.'); const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com';
    await expect(f.flow.confirm(entry.id, entry.revision, edits)).rejects.toMatchObject({ code: 'PAYPAL_NETWORK_ERROR' });
    const failed = await f.flow.get(entry.id);
    expect(failed).toMatchObject({ state: 'FAILED', confirmed: { total: 10 }, submission: { amount: '10.00' }, orderId: null, error: { stage: 'PayPal create', code: 'PAYPAL_NETWORK_ERROR' } });
    await expect(f.flow.confirm(entry.id, failed.revision, edits)).rejects.toMatchObject({ code: 'DRAFT_NOT_EDITABLE' }); expect(f.create).toHaveBeenCalledTimes(1);
  });
  it('records LLM failures and blocks configured credential text before storage or provider calls', async () => {
    const f = flowFixture(); f.parse.mockRejectedValueOnce(new AppError('AI parsing', 'HTTP_429', 'Provider unavailable.', 502));
    await expect(f.flow.start('Pay Alice 10 dollars for design.')).rejects.toMatchObject({ code: 'HTTP_429' });
    expect((await f.store.list()).entries[0]).toMatchObject({ state: 'FAILED', error: { stage: 'AI parsing', code: 'HTTP_429' } });
    await expect(f.flow.start('Pay Alice 10 dollars mock-w3-llm-key')).rejects.toMatchObject({ code: 'SENSITIVE_INPUT_BLOCKED' });
    expect((await f.store.list()).entries).toHaveLength(1); expect(f.parse).toHaveBeenCalledTimes(1);
  });
  it('blocks a mismatched signed order on the second GET before capture', async () => {
    const f = flowFixture(); const entry = await f.flow.start('Pay Alice 10 dollars for design.');
    const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com'; await f.flow.confirm(entry.id, entry.revision, edits);
    f.apiOrder().status = 'APPROVED';
    const originalGet = f.paypal.getOrder.bind(f.paypal); let reads = 0;
    vi.spyOn(f.paypal, 'getOrder').mockImplementation(async id => {
      const order = await originalGet(id);
      if (++reads === 2) { const other = { ...(await f.flow.get(entry.id)).submission!, reference: crypto.randomUUID() }; order.purchase_units![0]!.reference_id = other.reference; order.purchase_units![0]!.custom_id = await signSubmittedOrder(other, f.config); }
      return order;
    });
    await expect(f.flow.finish(entry.id, f.apiOrder().id)).rejects.toMatchObject({ code: 'CONFIRMED_DRAFT_MISMATCH' }); expect(f.capture).not.toHaveBeenCalled();
    expect((await f.flow.get(entry.id)).error!.stage).toBe('PayPal read-back');
  });
  it('allows one capture claim while concurrent status reads preserve CAPTURING', async () => {
    const f = flowFixture(); const entry = await f.flow.start('Pay Alice 10 dollars for design.'); const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com';
    await f.flow.confirm(entry.id, entry.revision, edits); f.apiOrder().status = 'APPROVED';
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    const original = PayPal.prototype.captureOrder;
    let entered!: () => void; const claimed = new Promise<void>(resolve => { entered = resolve; });
    f.capture.mockImplementation(async (...args) => { entered(); await pending; return original.apply(f.paypal, args); });
    const finishing = f.flow.finish(entry.id, f.apiOrder().id); await claimed;
    expect((await f.flow.status(entry.id)).state).toBe('CAPTURING');
    await expect(f.flow.finish(entry.id, f.apiOrder().id)).rejects.toMatchObject({ code: 'CAPTURE_IN_PROGRESS' });
    await expect(f.flow.cancel(entry.id, f.apiOrder().id)).rejects.toMatchObject({ code: 'CAPTURE_IN_PROGRESS' });
    release(); expect((await finishing).state).toBe('COMPLETED'); expect(f.capture).toHaveBeenCalledTimes(1);
  });
  it('blocks writes when persisting the confirmed claim fails', async () => {
    const f = flowFixture(); const entry = await f.flow.start('Pay Alice 10 dollars for design.'); const edits = visibleEdits(entry.aiDraft!); edits.payee.email = 'merchant@example.com';
    vi.spyOn(f.store, 'replace').mockRejectedValueOnce(new AppError('draft storage', 'STORAGE_UNAVAILABLE', 'Unavailable.', 503));
    await expect(f.flow.confirm(entry.id, entry.revision, edits)).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' }); expect(f.create).not.toHaveBeenCalled();
    expect((await f.flow.get(entry.id)).submission).toBeNull();
  });
});

describe('W3 exact cap configuration', () => {
  it('defaults to USD 200 and respects a cent-exact override and inclusive boundary', () => {
    expect(paymentCap({})).toEqual({ cents: 20000n, label: '200.00' });
    expect(paymentCap({ MAX_TRANSACTION_USD: '12.34' }).cents).toBe(1234n);
    expect(paymentIssue('USD', 200, paymentCap({}))).toBeNull(); expect(paymentIssue('USD', 200.01, paymentCap({}))!.code).toBe('AMOUNT_CAP_EXCEEDED');
  });
  it.each(['', '0', '-1', '0.001', '200.001', 'Infinity', 'abc', '1e3', '90071992547409.92', 200])('fails closed for %s', raw => {
    expect(() => paymentCap({ MAX_TRANSACTION_USD: raw })).toThrow(expect.objectContaining({ code: 'INVALID_TRANSACTION_CAP' }));
  });
});

describe('W3 mock JSON storage interface', () => {
  it('enforces immutable input/revisions and survives serialized read-back', async () => {
    const f = flowFixture(); const entry = await f.flow.start('Pay Alice 10 dollars for design.');
    await expect(f.store.replace({ ...entry, rawIntent: 'changed' }, entry.revision)).rejects.toMatchObject({ code: 'IMMUTABLE_INTENT' });
    await expect(f.store.replace(entry, entry.revision - 1)).rejects.toMatchObject({ code: 'STALE_DRAFT' });
    expect(memoryJournal(f.snapshot()).journal.get(entry.id)).toEqual(entry);
    f.kv.put(`draft:${entry.id}`, '{invalid'); expect(() => f.journal.get(entry.id)).toThrow(expect.objectContaining({ code: 'CORRUPT_DRAFT' }));
  });
  it('paginates twenty entries without gaps or repeats', async () => {
    const f = flowFixture(); const original = await f.flow.start('Pay Alice 10 dollars for design.');
    for (let i = 0; i < 25; i++) await f.store.create({ ...original, id: crypto.randomUUID(), createdAt: new Date(Date.UTC(2026, 9, 7, 0, i)).toISOString() });
    const first = await f.store.list(); const second = await f.store.list(first.next!);
    expect(first.entries).toHaveLength(20); expect(second.entries).toHaveLength(6); expect(new Set([...first.entries, ...second.entries].map(entry => entry.id)).size).toBe(26); expect(second.next).toBeNull();
  });
});
