import { describe, expect, it } from 'vitest';
import { sandboxPayees, enforcePayeePolicy } from '../src/lib/payment-policy';

describe('W4 configured sandbox payee policy', () => {
  it('preserves unrestricted local behavior when omitted or blank', () => {
    for (const values of [{}, { SANDBOX_PAYEE_ALLOWLIST: '' }, { SANDBOX_PAYEE_ALLOWLIST: '  ' }]) {
      expect(sandboxPayees(values)).toEqual([]);
      expect(() => enforcePayeePolicy('other@example.test', sandboxPayees(values))).not.toThrow();
    }
  });
  it('normalizes configured and submitted case, removes duplicates and blocks another recipient', () => {
    const emails = sandboxPayees({ SANDBOX_PAYEE_ALLOWLIST: ' Merchant@Example.Test , merchant@example.test,second@example.test' });
    expect(emails).toEqual(['merchant@example.test', 'second@example.test']);
    expect(() => enforcePayeePolicy('MERCHANT@EXAMPLE.TEST', emails)).not.toThrow();
    expect(() => enforcePayeePolicy('other@example.test', emails)).toThrow(expect.objectContaining({ code: 'PAYEE_NOT_ALLOWLISTED' }));
  });
  it.each(['not-an-email', 'merchant@example.test,', ',merchant@example.test', 'merchant@example.test,not-an-email', false, Array(21).fill('merchant@example.test').join(',')])('fails closed for invalid configuration %s', value => {
    expect(() => sandboxPayees({ SANDBOX_PAYEE_ALLOWLIST: value })).toThrow(expect.objectContaining({ stage: 'payment configuration', code: 'INVALID_PAYEE_ALLOWLIST' }));
  });
});
