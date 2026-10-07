import { signSubmittedOrder } from '../src/lib/flow';
import type { ManualOrder, PayPalConfiguration, PayPalOrder } from '../src/lib/types';

export const config: PayPalConfiguration = { clientId: 'mock-client', clientSecret: 'mock-secret', appUrl: 'http://localhost:4321' };
export const submitted: ManualOrder = { payeeEmail: 'merchant@example.com', amount: '10.00', currency: 'USD', description: 'W1 mock payment', reference: '00000000-0000-4000-8000-000000000001' };
export const orderId = 'MOCKORDER123456789';
export async function order(status = 'CREATED'): Promise<PayPalOrder> {
  return { id: orderId, status, intent: 'CAPTURE', links: [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}` }], purchase_units: [{
    reference_id: submitted.reference, custom_id: await signSubmittedOrder(submitted, config), description: submitted.description,
    payee: { email_address: submitted.payeeEmail }, amount: { currency_code: 'USD', value: submitted.amount },
    ...(status === 'COMPLETED' ? { payments: { captures: [{ id: 'MOCKCAPTURE1234567', status: 'COMPLETED', amount: { currency_code: 'USD', value: '10.00' } }] } } : {}),
  }] };
}
