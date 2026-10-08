import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { IntentFlow } from '../src/lib/intent-flow';
import { paymentCap } from '../src/lib/payment-policy';
import { workspaceForm } from '../src/lib/workspace-request';
import { memoryJournal } from './journal-fixture';
import { config } from './fixtures';
import type { Draft } from '../src/lib/draft-types';
const runtimeMock = vi.hoisted(() => ({ workspace: vi.fn(), manual: vi.fn() }));
vi.mock('../src/lib/workspace-runtime', () => ({ workspaceRuntime: runtimeMock.workspace }));
vi.mock('../src/lib/runtime', () => ({ runtime: runtimeMock.manual }));
import { POST as confirmPost } from '../src/pages/workspace/confirm';
import { POST as editPost } from '../src/pages/workspace/edit';
import { GET as statusGet } from '../src/pages/workspace/status';
import { GET as cancelGet } from '../src/pages/workspace/cancel';
import { POST as manualPost } from '../src/pages/orders/create';

const draft: Draft = { payee: { name: 'Alice', email: 'merchant@example.com' }, items: [{ name: 'design', quantity: 1, unit_amount: 10 }], currency: 'USD', total: 10, note: '', confidence: 0.9, ambiguities: [], injection_flags: [] };
function context(path: string, body?: URLSearchParams, origin = config.appUrl): Parameters<APIRoute>[0] {
  const url = new URL(path, config.appUrl);
  const request = new Request(url, { ...(body ? { method: 'POST', body, headers: { origin } } : {}) });
  return { request, url, cookies: {}, redirect: (destination: string, status = 302) => new Response(null, { status, headers: { location: destination } }) } as unknown as Parameters<APIRoute>[0];
}
function form(id: string, revision: number) {
  return new URLSearchParams({ draftId: id, revision: String(revision), payeeName: 'Alice', payeeEmail: 'merchant@example.com', itemName: 'design', itemQuantity: '1', itemAmount: '10.00', currency: 'USD', total: '10.00', note: '' });
}
beforeEach(() => vi.clearAllMocks());
describe('W3 actual HTTP handlers with mocked runtime dependencies', () => {
  async function setup() {
    const memory = memoryJournal();
    const paypal = { createOrder: vi.fn(), getOrder: vi.fn(), captureOrder: vi.fn() };
    const flow = new IntentFlow({ store: memory.store, parse: async () => ({ kind: 'draft', draft }), paypal, paypalConfig: config, cap: () => paymentCap({}) });
    runtimeMock.workspace.mockReturnValue({ flow, store: memory.store, cap: () => paymentCap({}), appOrigin: config.appUrl, configured: true });
    const entry = await flow.start('Pay Alice 10 dollars for design.');
    return { ...memory, paypal, flow, entry };
  }
  it('blocks a direct crafted POST bypass at the real confirm handler, recording BLOCKED with zero create calls', async () => {
    const f = await setup(); const payload = form(f.entry.id, f.entry.revision); payload.set('total', '250.00'); payload.set('itemAmount', '250.00');
    const response = await confirmPost(context('/workspace/confirm', payload));
    expect(response.status).toBe(303); expect(response.headers.get('location')).toContain('AMOUNT_CAP_EXCEEDED'); expect(f.paypal.createOrder).not.toHaveBeenCalled();
    expect(await f.flow.get(f.entry.id)).toMatchObject({ state: 'BLOCKED', edited: { total: 250 }, confirmed: null, orderId: null, error: { code: 'AMOUNT_CAP_EXCEEDED' } });
  });
  it.each(['orderId', 'reference', 'confidence', 'injection_flags'])('rejects forged client %s metadata before executing a payment', async key => {
    const f = await setup(); const payload = form(f.entry.id, f.entry.revision); payload.set(key, 'forged');
    const response = await confirmPost(context('/workspace/confirm', payload));
    expect(response.headers.get('location')).toContain('INVALID_EDIT_FIELDS'); expect(f.paypal.createOrder).not.toHaveBeenCalled();
    expect((await f.flow.get(f.entry.id)).error!.code).toBe('INVALID_EDIT_FIELDS');
  });
  it('rejects duplicate scalar fields and total mismatch at the confirm handler', async () => {
    const f = await setup(); const payload = form(f.entry.id, f.entry.revision); payload.append('total', '1.00');
    expect((await confirmPost(context('/workspace/confirm', payload))).headers.get('location')).toContain('INVALID_EDIT_FIELDS');
    const entry = await f.flow.get(f.entry.id); const mismatch = form(entry.id, entry.revision); mismatch.set('total', '12.00');
    expect((await confirmPost(context('/workspace/confirm', mismatch))).headers.get('location')).toContain('TOTAL_MISMATCH'); expect(f.paypal.createOrder).not.toHaveBeenCalled();
  });
  it('validates edits without creating an order and rejects another workspace ID', async () => {
    const f = await setup(); const payload = form(f.entry.id, f.entry.revision); payload.set('note', 'Edited purpose');
    expect((await editPost(context('/workspace/edit', payload))).headers.get('location')).toBe(`/parse?draftId=${f.entry.id}`);
    expect((await f.flow.get(f.entry.id)).edited!.note).toBe('Edited purpose'); expect(f.paypal.createOrder).not.toHaveBeenCalled();
    payload.set('draftId', crypto.randomUUID());
    expect((await confirmPost(context('/workspace/confirm', payload))).headers.get('location')).toContain('DRAFT_NOT_FOUND'); expect(f.paypal.createOrder).not.toHaveBeenCalled();
  });
  it('rejects cross-origin or oversized form bodies before any PayPal call', async () => {
    const f = await setup(); const response = await confirmPost(context('/workspace/confirm', form(f.entry.id, f.entry.revision), 'https://other.example.test'));
    expect(response.headers.get('location')).toContain('ORIGIN_MISMATCH'); expect(f.paypal.createOrder).not.toHaveBeenCalled();
    const request = context('/workspace/confirm', new URLSearchParams({ intent: 'x'.repeat(48001) })).request;
    await expect(workspaceForm(request, config.appUrl)).rejects.toMatchObject({ code: 'FORM_TOO_LARGE' });
  });
  it('dispatches status as read-only and cancellation using the stored order when token is absent', async () => {
    const f = await setup(); const status = vi.spyOn(f.flow, 'status').mockResolvedValue(f.entry);
    await statusGet(context(`/workspace/status?draftId=${f.entry.id}`)); expect(status).toHaveBeenCalledWith(f.entry.id, undefined); expect(f.paypal.captureOrder).not.toHaveBeenCalled();
    vi.spyOn(f.flow, 'get').mockResolvedValue({ ...f.entry, orderId: 'MOCKORDER123' });
    const cancel = vi.spyOn(f.flow, 'cancel').mockResolvedValue(f.entry);
    await cancelGet(context(`/workspace/cancel?draftId=${f.entry.id}`)); expect(cancel).toHaveBeenCalledWith(f.entry.id, 'MOCKORDER123'); expect(f.paypal.captureOrder).not.toHaveBeenCalled();
  });
  it('blocks the W1 manual over-cap write at its actual server create handler with zero create calls', async () => {
    const paypal = { createOrder: vi.fn() }; runtimeMock.manual.mockReturnValue({ config, paypal, cap: () => paymentCap({}) });
    const payload = new URLSearchParams({ payeeEmail: 'merchant@example.com', amount: '250.00', currency: 'USD', description: 'Over-cap manual test' });
    const response = await manualPost(context('/orders/create', payload));
    expect(response.headers.get('location')).toContain('AMOUNT_CAP_EXCEEDED'); expect(response.headers.get('location')).toContain('250.00'); expect(response.headers.get('location')).toContain('200.00'); expect(paypal.createOrder).not.toHaveBeenCalled();
  });
  it('inspects one shared policy for the card, draft confirmation and manual create path', () => {
    for (const file of ['src/components/ConfirmationCard.astro', 'src/lib/intent-flow.ts', 'src/pages/orders/create.ts']) expect(readFileSync(file, 'utf8'), file).toMatch(/import.*from ['"][^'"]*payment-policy['"]/);
    expect(readFileSync('src/lib/intent-flow.ts', 'utf8')).toMatch(/enforcePaymentPolicy\(confirmed.currency, confirmed.total/);
    expect(readFileSync('src/pages/orders/create.ts', 'utf8')).toMatch(/enforcePaymentPolicy\(submitted.currency/);
    const card = readFileSync('src/components/ConfirmationCard.astro', 'utf8');
    expect(card).toContain('disabled={!!issue}'); expect(card).toContain('DRAFT — not paid'); expect(card).toContain('uncalibrated');
    expect(readFileSync('src/pages/parse.astro', 'utf8')).not.toMatch(/name="answers"|name="intent" value=\{entry/);
  });
});
