import { describe, expect, it, vi } from 'vitest';
import { amountString, approvalUrl, finishApprovedOrder, orderToken, readOrderStatus, signSubmittedOrder, submittedOrder, verifiedSubmission } from '../src/lib/flow';
import { configuration } from '../src/lib/config';
import type { PayPalService } from '../src/lib/types';
import { config, order, orderId, submitted } from './fixtures';

describe('manual W1 return and verification — mocked evidence', () => {
  it('GETs APPROVED, captures, then GETs again to verify completion and capture ID', async () => {
    const calls: string[] = [];
    let reads = 0;
    const service: PayPalService = {
      createOrder: vi.fn(),
      getOrder: vi.fn(async () => { calls.push('GET'); return order(++reads === 1 ? 'APPROVED' : 'COMPLETED'); }),
      captureOrder: vi.fn(async () => { calls.push('CAPTURE'); return order('APPROVED'); }),
    };
    const result = await finishApprovedOrder(orderId, service, config);
    expect(calls).toEqual(['GET', 'CAPTURE', 'GET']); expect(result.completed).toBe(true); expect(result.transactionId).toBe('MOCKCAPTURE1234567');
  });
  it.each(['CREATED', 'PAYER_ACTION_REQUIRED', 'VOIDED', 'COMPLETED'])('does not capture API status %s', async status => {
    const service: PayPalService = { createOrder: vi.fn(), getOrder: vi.fn(async () => order(status)), captureOrder: vi.fn() };
    const result = await finishApprovedOrder(orderId, service, config); expect(service.captureOrder).not.toHaveBeenCalled(); expect(result.completed).toBe(status === 'COMPLETED');
  });
  it('never captures on read-only status lookup, even if approved', async () => {
    const service: PayPalService = { createOrder: vi.fn(), getOrder: vi.fn(async () => order('APPROVED')), captureOrder: vi.fn() };
    await readOrderStatus(orderId, service, config); expect(service.captureOrder).not.toHaveBeenCalled();
  });
  it.each(['amount', 'payee', 'description', 'reference', 'currency'])('blocks modified %s before capture', async changed => {
    const altered = await order('APPROVED'); const unit = altered.purchase_units![0]!;
    if (changed === 'amount') unit.amount!.value = '11.00';
    if (changed === 'payee') unit.payee!.email_address = 'someone-else@example.com';
    if (changed === 'description') unit.description = 'Changed purpose';
    if (changed === 'reference') unit.reference_id = 'another-reference';
    if (changed === 'currency') unit.amount!.currency_code = 'EUR';
    const service: PayPalService = { createOrder: vi.fn(), getOrder: vi.fn(async () => altered), captureOrder: vi.fn() };
    await expect(finishApprovedOrder(orderId, service, config)).rejects.toHaveProperty('code'); expect(service.captureOrder).not.toHaveBeenCalled();
  });
  it('rejects orders without app binding metadata and mismatched order IDs', async () => {
    const unbound = await order('APPROVED'); delete unbound.purchase_units![0]!.custom_id;
    await expect(verifiedSubmission(unbound, config)).rejects.toMatchObject({ code: 'UNBOUND_ORDER' });
    const service: PayPalService = { createOrder: vi.fn(), getOrder: vi.fn(async () => ({ ...await order('APPROVED'), id: 'OTHERORDER' })), captureOrder: vi.fn() };
    await expect(finishApprovedOrder(orderId, service, config)).rejects.toMatchObject({ code: 'ORDER_ID_MISMATCH' }); expect(service.captureOrder).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'DECLINED'])('never calls a %s capture completed', async status => {
    const response = await order('COMPLETED'); response.purchase_units![0]!.payments!.captures![0]!.status = status;
    const service: PayPalService = { createOrder: vi.fn(), getOrder: vi.fn().mockResolvedValueOnce(await order('APPROVED')).mockResolvedValueOnce(response), captureOrder: vi.fn(async () => order('COMPLETED')) };
    await expect(finishApprovedOrder(orderId, service, config)).rejects.toMatchObject({ code: 'CAPTURE_NOT_VERIFIED' });
  });
  it('requires a capture ID and matching capture amount after final GET', async () => {
    for (const failure of ['amount', 'id']) {
      const completed = await order('COMPLETED'); const capture = completed.purchase_units![0]!.payments!.captures![0]!;
      if (failure === 'amount') capture.amount.value = '9.00'; else capture.id = '';
      const service: PayPalService = { createOrder: vi.fn(), getOrder: vi.fn(async () => completed), captureOrder: vi.fn() };
      await expect(readOrderStatus(orderId, service, config)).rejects.toMatchObject({ code: 'CAPTURE_NOT_VERIFIED' });
    }
  });
  it('keeps a stable capture request ID for recovery from the same order token', async () => {
    const service: PayPalService = { createOrder: vi.fn(), getOrder: vi.fn(async () => order('APPROVED')), captureOrder: vi.fn(async () => order('APPROVED')) };
    await finishApprovedOrder(orderId, service, config); await finishApprovedOrder(orderId, service, config);
    const calls = vi.mocked(service.captureOrder).mock.calls; expect(calls[0]![1]).toBe(calls[1]![1]); expect(calls[0]![1].length).toBeLessThanOrEqual(38);
  });
  it('verifies submitted fields across service instances without local order state', async () => {
    const response = await order('APPROVED'); expect(await verifiedSubmission(response, { ...config })).toEqual(submitted);
    expect(await signSubmittedOrder(submitted, config)).toBe(response.purchase_units![0]!.custom_id);
  });
  it('validates manual fields using exact cents without AI or cap logic', () => {
    expect(amountString('10.1')).toBe('10.10'); expect(amountString('0010.00')).toBe('10.00');
    expect(() => amountString('0')).toThrow(); expect(() => amountString('1.001')).toThrow();
    const form = new FormData(); form.set('payeeEmail', submitted.payeeEmail); form.set('amount', '10'); form.set('currency', 'USD'); form.set('description', submitted.description);
    expect(submittedOrder(form)).toMatchObject({ amount: '10.00', payeeEmail: submitted.payeeEmail, currency: 'USD' });
    form.set('description', 'a'.repeat(128)); expect(() => submittedOrder(form)).toThrow();
  });
  it('rejects malformed tokens and non-sandbox approval URLs', async () => {
    expect(() => orderToken('../another')).toThrow();
    const response = await order(); response.links = [{ rel: 'approve', href: 'https://www.paypal.com/checkoutnow' }]; expect(() => approvalUrl(response)).toThrow();
  });
  it('defaults the local origin and rejects accidental live configuration', () => {
    expect(configuration({}).appUrl).toBe('http://localhost:4321'); expect(() => configuration({ PAYPAL_ENV: 'live' })).toThrow();
  });
});
