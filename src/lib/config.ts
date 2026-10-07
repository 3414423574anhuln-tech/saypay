import { AppError } from './errors';
import type { PayPalConfiguration } from './types';

export function configuration(values: Record<string, unknown>): PayPalConfiguration {
  const read = (key: string) => typeof values[key] === 'string' ? (values[key] as string).trim() : '';
  const appUrl = read('APP_URL') || 'http://localhost:4321';
  let origin: URL;
  try { origin = new URL(appUrl); } catch { throw new AppError('configuration', 'INVALID_APP_URL', 'APP_URL must be the origin used to open this application.', 503); }
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) {
    throw new AppError('configuration', 'INVALID_APP_URL', 'Use an HTTPS origin, or http://localhost:4321 for local sandbox testing.', 503);
  }
  if (read('PAYPAL_ENV') && read('PAYPAL_ENV') !== 'sandbox') throw new AppError('configuration', 'SANDBOX_ONLY', 'This W1 application only supports the PayPal sandbox.', 503);
  return { clientId: read('PAYPAL_CLIENT_ID'), clientSecret: read('PAYPAL_CLIENT_SECRET'), appUrl: origin.origin };
}
export function requireCredentials(config: PayPalConfiguration): void {
  if (!config.clientId || !config.clientSecret) throw new AppError('PayPal configuration', 'PAYPAL_NOT_CONFIGURED', 'Fill PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET locally in this checkout’s .env. Do not send their values through chat.', 503);
}
