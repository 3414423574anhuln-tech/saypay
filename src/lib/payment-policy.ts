import { AppError } from './errors';
import { cents } from './schema';

export interface PaymentCap { cents: bigint; label: string }
export function paymentCap(values: Record<string, unknown>): PaymentCap {
  const raw = values.MAX_TRANSACTION_USD;
  const text = raw === undefined ? '200' : typeof raw === 'string' ? raw.trim() : '';
  try {
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error();
    const [whole, fraction = ''] = text.split('.');
    const amount = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error();
    return { cents: amount, label: `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}` };
  } catch { throw new AppError('payment configuration', 'INVALID_TRANSACTION_CAP', 'MAX_TRANSACTION_USD must be a positive USD amount with at most two decimal places. Payment creation is blocked.', 503); }
}
export function paymentIssue(currency: string, total: number, cap: PaymentCap): AppError | null {
  if (currency !== 'USD') return new AppError('payment validation', 'USD_REQUIRED', `W3 executes USD only. This draft remains ${currency}; change the currency explicitly to USD before confirmation. No conversion or order was made.`, 422);
  if (cents(total) > cap.cents) return new AppError('payment validation', 'AMOUNT_CAP_EXCEEDED', `Attempted USD ${total.toFixed(2)} exceeds the USD ${cap.label} transaction cap. No PayPal order was created.`, 422);
  return null;
}
export function enforcePaymentPolicy(currency: string, total: number, cap: PaymentCap): void {
  const issue = paymentIssue(currency, total, cap); if (issue) throw issue;
}
