// Independent, read-only acceptance evidence. No create/capture endpoints and no credential output.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHmac, timingSafeEqual } from 'node:crypto';
const values = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'));
const ids = process.argv.slice(2);
if (!ids.length || ids.some(id => !/^[A-Za-z0-9]{1,64}$/.test(id))) throw new Error('Supply existing PayPal sandbox order IDs only.');
if (!values.PAYPAL_CLIENT_ID || !values.PAYPAL_CLIENT_SECRET) throw new Error('Fill PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET locally.');
const base = 'https://api-m.sandbox.paypal.com';
async function json(path, init) {
  const response = await fetch(base + path, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (response.status >= 300 && response.status < 400) throw new Error('PayPal verification: redirect blocked.');
  if (!response.ok) throw new Error(`PayPal verification HTTP_${response.status}.`);
  return response.json();
}
const auth = await json('/v1/oauth2/token', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${values.PAYPAL_CLIENT_ID}:${values.PAYPAL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
if (typeof auth.access_token !== 'string') throw new Error('Invalid PayPal authentication response.');
const receipts = [];
for (const id of ids) {
  const order = await json(`/v2/checkout/orders/${id}`, { headers: { Authorization: `Bearer ${auth.access_token}` } });
  const unit = order.purchase_units?.[0];
  const bound = !!unit && order.id === id && order.intent === 'CAPTURE' && order.purchase_units.length === 1 && unit.amount?.currency_code === 'USD' && typeof unit.amount.value === 'string' && typeof unit.payee?.email_address === 'string';
  if (!bound) throw new Error('Unbound or unexpected PayPal read-back.');
  const key = createHmac('sha256', values.PAYPAL_CLIENT_SECRET).update(`saypay-w1-order-binding:${values.PAYPAL_CLIENT_ID}`).digest();
  const expected = createHmac('sha256', key).update(JSON.stringify(['saypay-w1-v1', unit.reference_id, unit.payee.email_address.toLowerCase(), unit.amount.value, 'USD', unit.description])).digest();
  const signature = String(unit.custom_id ?? '');
  if (!/^saypay-w1-v1:[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature.slice('saypay-w1-v1:'.length), 'hex'), expected)) throw new Error('Authenticated submitted fields do not match.');
  const captures = unit.payments?.captures ?? [];
  const completed = order.status === 'COMPLETED' && captures.length === 1 && captures[0].status === 'COMPLETED' && captures[0].id && captures[0].amount?.currency_code === 'USD' && captures[0].amount.value === unit.amount.value;
  if (order.status === 'COMPLETED' && !completed) throw new Error('Completed capture did not reconcile.');
  const receipt = { orderId: id, paypalStatus: order.status, authenticatedFields: true, reference: unit.reference_id, payeeEmail: unit.payee.email_address, currency: 'USD', amount: unit.amount.value, description: unit.description, completed: !!completed, captureId: completed ? captures[0].id : null };
  // A provider cannot smuggle a configured credential into this evidence output.
  if ([values.PAYPAL_CLIENT_ID, values.PAYPAL_CLIENT_SECRET, values.LLM_API_KEY].some(secret => secret && JSON.stringify(receipt).includes(secret))) throw new Error('Sensitive evidence output blocked.');
  receipts.push(receipt);
}
console.log(JSON.stringify({ kind: 'Independent real PayPal GET; read-only verification', verifiedAt: new Date().toISOString(), receipts }, null, 2));
