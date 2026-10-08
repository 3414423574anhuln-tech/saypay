import { env } from 'cloudflare:workers';
import { configuration } from './config';
import { PayPal } from './paypal';
import { paymentCap } from './payment-policy';

export function runtime() {
  const config = configuration({ ...env });
  return { config, paypal: new PayPal(config), cap: () => paymentCap({ ...env }) };
}
