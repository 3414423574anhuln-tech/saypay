import { env } from 'cloudflare:workers';
import { configuration } from './config';
import { PayPal } from './paypal';

export function runtime() {
  const config = configuration({ ...env });
  return { config, paypal: new PayPal(config) };
}
