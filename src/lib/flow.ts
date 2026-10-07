import { AppError } from './errors';
import { requireCredentials } from './config';
import type { ManualOrder, OrderStatus, PayPalConfiguration, PayPalOrder, PayPalService } from './types';

const encoder = new TextEncoder();
const signaturePrefix = 'saypay-w1-v1:';
export function amountString(value: string): string {
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value)) throw new AppError('order form', 'INVALID_AMOUNT', 'Enter a positive USD amount with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new AppError('order form', 'INVALID_AMOUNT', 'Enter a USD amount greater than zero.');
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
export function submittedOrder(form: FormData): ManualOrder {
  const field = (name: string) => typeof form.get(name) === 'string' ? (form.get(name) as string).trim() : '';
  const payeeEmail = field('payeeEmail');
  const description = field('description');
  if (payeeEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payeeEmail)) throw new AppError('order form', 'INVALID_PAYEE_EMAIL', 'Enter the actual sandbox merchant email.');
  if (field('currency') !== 'USD') throw new AppError('order form', 'USD_REQUIRED', 'The W1 flow uses USD only.');
  if (!description || encoder.encode(description).length > 127) throw new AppError('order form', 'INVALID_DESCRIPTION', 'Enter a purpose of 1 to 127 UTF-8 bytes so PayPal can return it without truncation.');
  return { payeeEmail: payeeEmail.toLowerCase(), amount: amountString(field('amount')), currency: 'USD', description, reference: crypto.randomUUID() };
}
async function signingKey(config: PayPalConfiguration): Promise<CryptoKey> {
  requireCredentials(config);
  const key = await crypto.subtle.importKey('raw', encoder.encode(config.clientSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const derived = await crypto.subtle.sign('HMAC', key, encoder.encode(`saypay-w1-order-binding:${config.clientId}`));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function orderMessage(order: ManualOrder): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify(['saypay-w1-v1', order.reference, order.payeeEmail.toLowerCase(), order.amount, order.currency, order.description]));
}
export async function signSubmittedOrder(order: ManualOrder, config: PayPalConfiguration): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(config), orderMessage(order)));
  return signaturePrefix + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifiedSubmission(order: PayPalOrder, config: PayPalConfiguration): Promise<ManualOrder> {
  const unit = order.purchase_units?.[0];
  const signature = unit?.custom_id;
  if (order.intent !== 'CAPTURE' || order.purchase_units?.length !== 1 || !unit || !unit.reference_id || !unit.description || !unit.payee?.email_address || unit.amount?.currency_code !== 'USD' || typeof unit.amount.value !== 'string' || typeof signature !== 'string' || !signature.startsWith(signaturePrefix) || !/^[a-f0-9]{64}$/.test(signature.slice(signaturePrefix.length))) {
    throw new AppError('PayPal read-back', 'UNBOUND_ORDER', 'This order does not contain this W1 app’s authenticated submitted fields. Capture is blocked.', 422);
  }
  let amount: string;
  try { amount = amountString(unit.amount.value); } catch { throw new AppError('PayPal read-back', 'ORDER_AMOUNT_INVALID', 'PayPal returned an unsupported order amount. Capture is blocked.', 422); }
  const submitted: ManualOrder = { reference: unit.reference_id, payeeEmail: unit.payee.email_address.toLowerCase(), amount, currency: 'USD', description: unit.description };
  const hex = signature.slice(signaturePrefix.length);
  const bytes = Uint8Array.from(hex.match(/../g)!, pair => Number.parseInt(pair, 16));
  if (!await crypto.subtle.verify('HMAC', await signingKey(config), bytes, orderMessage(submitted))) throw new AppError('PayPal read-back', 'SUBMISSION_MISMATCH', 'PayPal’s payee, amount, currency, purpose, or reference differs from the submitted order. Capture is blocked.', 422);
  return submitted;
}
export function orderToken(value: string | null): string {
  if (!value || !/^[A-Za-z0-9]{1,64}$/.test(value)) throw new AppError('PayPal return', 'INVALID_ORDER_TOKEN', 'A valid PayPal order token is required. Use the return URL supplied by PayPal.');
  return value;
}
export function approvalUrl(order: PayPalOrder): string {
  const link = order.links?.find(l => l.rel === 'payer-action' || l.rel === 'approve');
  let url: URL;
  try { url = new URL(link?.href ?? ''); } catch { throw new AppError('PayPal create', 'APPROVAL_LINK_MISSING', `PayPal created order ${order.id} but did not supply an approval link. Do not submit another order without checking this one.`, 502); }
  if (url.protocol !== 'https:' || !(url.hostname === 'sandbox.paypal.com' || url.hostname.endsWith('.sandbox.paypal.com'))) throw new AppError('PayPal create', 'UNSAFE_APPROVAL_URL', 'PayPal returned an unexpected approval destination. Redirect is blocked.', 502);
  return url.href;
}
function statusResult(order: PayPalOrder, submitted: ManualOrder): OrderStatus {
  if (order.status !== 'COMPLETED') return { orderId: order.id, paypalStatus: order.status, completed: false, transactionId: null, submitted };
  const captures = order.purchase_units?.[0]?.payments?.captures ?? [];
  const capture = captures.length === 1 ? captures[0] : null;
  let matches = false;
  try { matches = !!capture && capture.amount?.currency_code === 'USD' && amountString(capture.amount.value) === submitted.amount; } catch { /* Fail closed for malformed money. */ }
  if (!capture || capture.status !== 'COMPLETED' || !capture.id || !matches) throw new AppError('PayPal final read-back', 'CAPTURE_NOT_VERIFIED', 'PayPal’s completed order does not have one verified completed capture matching the submitted amount. No success is assumed.', 502);
  return { orderId: order.id, paypalStatus: order.status, completed: true, transactionId: capture.id, submitted };
}
export async function readOrderStatus(token: string, service: PayPalService, config: PayPalConfiguration): Promise<OrderStatus> {
  const id = orderToken(token);
  const order = await service.getOrder(id);
  if (order.id !== id) throw new AppError('PayPal read-back', 'ORDER_ID_MISMATCH', 'The PayPal response does not match this return token. Capture is blocked.', 502);
  return statusResult(order, await verifiedSubmission(order, config));
}
export async function finishApprovedOrder(token: string, service: PayPalService, config: PayPalConfiguration): Promise<OrderStatus> {
  const before = await readOrderStatus(token, service, config);
  if (before.paypalStatus !== 'APPROVED') return before;
  // The reference lives on the PayPal order and survives app restarts. A stable ID prevents duplicate capture actions.
  const requestId = `cap-${before.submitted.reference.replaceAll('-', '').slice(0, 32)}`;
  await service.captureOrder(before.orderId, requestId);
  const after = await readOrderStatus(before.orderId, service, config);
  if (JSON.stringify(after.submitted) !== JSON.stringify(before.submitted)) throw new AppError('PayPal final read-back', 'SUBMISSION_CHANGED', 'The submitted fields changed between approval and final read-back. No success is assumed.', 502);
  return after;
}
