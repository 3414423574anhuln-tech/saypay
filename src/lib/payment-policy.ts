import { AppError } from './errors';
import { cents } from './schema';

export interface PaymentCap { cents: bigint; label: string }
export function sandboxPayees(values: Record<string, unknown>): readonly string[] {
  const raw = values.SANDBOX_PAYEE_ALLOWLIST;
  if (raw === undefined || raw === '') return [];
  if (typeof raw !== 'string') throw new AppError('payment configuration', 'INVALID_PAYEE_ALLOWLIST', 'SANDBOX_PAYEE_ALLOWLIST must be a comma-separated list of sandbox merchant emails. Payment creation is blocked.', 503);
  if (!raw.trim()) return [];
  const emails = raw.split(',').map(email => email.trim().toLowerCase());
  if (emails.length > 20 || emails.some(email => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AppError('payment configuration', 'INVALID_PAYEE_ALLOWLIST', 'SANDBOX_PAYEE_ALLOWLIST must contain valid emails, with no empty entries and at most twenty entries. Payment creation is blocked.', 503);
  return [...new Set(emails)];
}
export function payeeIssue(email: string, allowed: readonly string[]): AppError | null {
  if (email && allowed.length && !allowed.includes(email.toLowerCase())) return new AppError('payment validation', 'PAYEE_NOT_ALLOWLISTED', 'This demo accepts only the configured sandbox merchants. Choose a sandbox payee shortcut and validate the edit. No PayPal order was created.', 422);
  return null;
}
export function enforcePayeePolicy(email: string, allowed: readonly string[]): void {
  const issue = payeeIssue(email, allowed); if (issue) throw issue;
}
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
  if (currency !== 'USD') return new AppError('payment validation', 'USD_REQUIRED', `This sandbox demo executes USD only. This draft remains ${currency}; change the currency explicitly to USD before confirmation. No conversion or order was made.`, 422);
  if (cents(total) > cap.cents) return new AppError('payment validation', 'AMOUNT_CAP_EXCEEDED', `Attempted USD ${total.toFixed(2)} exceeds the USD ${cap.label} transaction cap. No PayPal order was created.`, 422);
  return null;
}
export function enforcePaymentPolicy(currency: string, total: number, cap: PaymentCap): void {
  const issue = paymentIssue(currency, total, cap); if (issue) throw issue;
}
