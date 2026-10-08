import type { ManualOrder, PayPalConfiguration, PayPalOrder, PayPalService } from './types';
import { AppError } from './errors';
import { requireCredentials } from './config';
const base = 'https://api-m.sandbox.paypal.com';
// Only completed token strings are cached. No request-bound promises or user state is shared.
const tokens = new Map<string, { value: string; expires: number; secret: string }>();

export class PayPal implements PayPalService {
  // Workerd rejects native fetch called as an instance method with a foreign receiver.
  constructor(private config: PayPalConfiguration, private request: typeof fetch = (input, init) => fetch(input, init), private now: () => number = Date.now, private checkout: { returnPath: string; cancelPath: string; draftReference?: boolean } = { returnPath: '/return', cancelPath: '/cancel' }) {}
  private async token(): Promise<string> {
    requireCredentials(this.config);
    const { clientId: id, clientSecret: secret } = this.config;
    const cached = tokens.get(id);
    if (cached && cached.secret === secret && cached.expires > this.now()) return cached.value;
    let response: Response;
    try {
      response = await this.request(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000) });
    } catch { throw new AppError('PayPal authentication', 'PAYPAL_NETWORK_ERROR', 'PayPal authentication is unavailable. No order was created.', 502); }
    const body = await this.read(response, 'PayPal authentication');
    if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') throw new AppError('PayPal authentication', 'INVALID_TOKEN_RESPONSE', 'PayPal returned an invalid authentication response.', 502);
    if (tokens.size > 10) tokens.clear();
    tokens.set(id, { value: body.access_token, expires: this.now() + Math.max(0, body.expires_in - 60) * 1000, secret });
    return body.access_token;
  }
  private async read(response: Response, stage: string): Promise<Record<string, unknown>> {
    let body: Record<string, unknown>;
    try { body = await response.json(); } catch { throw new AppError(stage, `HTTP_${response.status}`, 'PayPal returned an unreadable response. Check the order status before retrying.', 502); }
    if (!response.ok) {
      const detail = (body.details as { issue?: string }[] | undefined)?.[0]?.issue;
      const code = detail || (typeof body.name === 'string' ? body.name : typeof body.error === 'string' ? body.error : `HTTP_${response.status}`);
      const message = stage === 'PayPal authentication' && code === 'invalid_client'
        ? 'PayPal did not authorize the supplied sandbox Client ID/Secret pair. Recopy PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET locally from the same sandbox REST app; do not send values through chat.'
        : 'PayPal rejected this step. Review the sandbox configuration or payment details, then check the order status.';
      throw new AppError(stage, code.slice(0, 100), message, 502);
    }
    return body;
  }
  private async call(path: string, stage: string, method = 'GET', payload?: unknown, requestId?: string): Promise<PayPalOrder> {
    const token = await this.token();
    let response: Response;
    try {
      response = await this.request(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(15000) });
    } catch { throw new AppError(stage, 'PAYPAL_NETWORK_ERROR', 'PayPal did not respond in time. The result is unknown; use Check PayPal status before retrying.', 502); }
    if (response.status === 401) tokens.delete(this.config.clientId);
    const body = await this.read(response, stage);
    if (typeof body.id !== 'string' || typeof body.status !== 'string') throw new AppError(stage, 'INVALID_ORDER_RESPONSE', 'PayPal returned incomplete order data. The result is not verified.', 502);
    return body as unknown as PayPalOrder;
  }
  createOrder(order: ManualOrder, signature: string, requestId: string) {
    const callback = (path: string) => { const url = new URL(path, this.config.appUrl); if (this.checkout.draftReference) url.searchParams.set('draftId', order.reference); return url.href; };
    return this.call('/v2/checkout/orders', 'PayPal create', 'POST', {
      intent: 'CAPTURE', purchase_units: [{ reference_id: order.reference, custom_id: signature,
        payee: { email_address: order.payeeEmail }, description: order.description,
        amount: { currency_code: order.currency, value: order.amount },
      }],
      payment_source: { paypal: { experience_context: { brand_name: this.checkout.draftReference ? 'SayPay' : 'SayPay W1', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: callback(this.checkout.returnPath), cancel_url: callback(this.checkout.cancelPath) } } },
    }, requestId);
  }
  getOrder(orderId: string) { return this.call(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'PayPal status'); }
  captureOrder(orderId: string, requestId: string) { return this.call(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'PayPal capture', 'POST', {}, requestId); }
}
