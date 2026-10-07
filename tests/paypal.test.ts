import { describe, expect, it, vi } from 'vitest';
import { PayPal } from '../src/lib/paypal';
import { config, order, orderId, submitted } from './fixtures';
import { signSubmittedOrder } from '../src/lib/flow';

describe('PayPal sandbox service — mocked response evidence', () => {
  it('uses one OAuth request for create/get/capture/get in the same process', async () => {
    const fakeOrder = await order('CREATED');
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: 'mock-oauth-token', expires_in: 3600 })).mockImplementation(async () => Response.json(fakeOrder));
    const service = new PayPal({ ...config, clientId: 'mock-cache-client' }, request);
    await service.createOrder(submitted, 'mock-binding', 'mock-create-request');
    await service.getOrder(orderId); await service.captureOrder(orderId, 'mock-capture-request'); await service.getOrder(orderId);
    expect(request.mock.calls.filter(args => String(args[0]).endsWith('/v1/oauth2/token'))).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls.every(args => String(args[0]).startsWith('https://api-m.sandbox.paypal.com/'))).toBe(true);
    const create = request.mock.calls[1]![1]!;
    const body = JSON.parse(create.body as string);
    expect(body.intent).toBe('CAPTURE'); expect(body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '10.00' });
    expect(body.payment_source.paypal.experience_context.return_url).toBe('http://localhost:4321/return');
    expect(body.payment_source.paypal.experience_context.cancel_url).toBe('http://localhost:4321/cancel');
    expect((request.mock.calls[3]![1]!.headers as Record<string, string>)['PayPal-Request-Id']).toBe('mock-capture-request');
  });
  it('refreshes the cache sixty seconds before expiry', async () => {
    let clock = 0;
    const response = await order();
    const request = vi.fn<typeof fetch>().mockImplementation(async url => String(url).endsWith('/v1/oauth2/token') ? Response.json({ access_token: 'mock-token', expires_in: 3600 }) : Response.json(response));
    const service = new PayPal({ ...config, clientId: 'mock-refresh-client' }, request, () => clock);
    await service.getOrder(orderId); clock = 3539000; await service.getOrder(orderId);
    expect(request.mock.calls.filter(args => String(args[0]).endsWith('/v1/oauth2/token'))).toHaveLength(1);
    clock = 3540000; await service.getOrder(orderId);
    expect(request.mock.calls.filter(args => String(args[0]).endsWith('/v1/oauth2/token'))).toHaveLength(2);
  });
  it('adds authenticated submission metadata to the PayPal order', async () => {
    const response = await order();
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: 'mock-token', expires_in: 3600 })).mockResolvedValueOnce(Response.json(response));
    const signature = await signSubmittedOrder(submitted, config);
    await new PayPal({ ...config, clientId: 'mock-metadata-client' }, request).createOrder(submitted, signature, submitted.reference);
    const body = JSON.parse(request.mock.calls[1]![1]!.body as string);
    expect(body.purchase_units[0].custom_id).toBe(signature); expect(body.purchase_units[0].reference_id).toBe(submitted.reference);
  });
  it('does not call PayPal when credentials are absent', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(new PayPal({ ...config, clientSecret: '' }, request).getOrder(orderId)).rejects.toMatchObject({ code: 'PAYPAL_NOT_CONFIGURED' });
    expect(request).not.toHaveBeenCalled();
  });
  it('stops before order creation when OAuth rejects the credential pair', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: 'invalid_client' }, { status: 401 }));
    const service = new PayPal({ ...config, clientId: 'mock-rejected-client' }, request);
    await expect(service.createOrder(submitted, 'mock-binding', 'mock-request')).rejects.toMatchObject({ stage: 'PayPal authentication', code: 'invalid_client' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]![0])).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
  });
  it('surfaces the original PayPal issue without its raw response or credential data', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: 'mock-token', expires_in: 3600 })).mockResolvedValueOnce(Response.json({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'PAYEE_ACCOUNT_INVALID' }] }, { status: 422 }));
    await expect(new PayPal({ ...config, clientId: 'mock-error-client' }, request).getOrder(orderId)).rejects.toMatchObject({ stage: 'PayPal status', code: 'PAYEE_ACCOUNT_INVALID' });
  });
});
