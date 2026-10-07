import { AppError } from './errors';
import type { Draft, InjectionFlag, MissingField, ParseResult } from './draft-types';

const string = { type: 'string' };
const flagSchema = { type: 'object', additionalProperties: false, required: ['type', 'snippet'], properties: { type: string, snippet: string } };
export const draftSchema = {
  type: 'object', additionalProperties: false,
  required: ['payee', 'items', 'currency', 'total', 'note', 'confidence', 'ambiguities', 'injection_flags'],
  properties: {
    payee: { type: 'object', additionalProperties: false, required: ['name', 'email'], properties: { name: string, email: string } },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'quantity', 'unit_amount'], properties: { name: string, quantity: { type: 'integer' }, unit_amount: { type: 'number' } } } },
    currency: string, total: { type: 'number' }, note: string, confidence: { type: 'number' },
    ambiguities: { type: 'array', items: string }, injection_flags: { type: 'array', items: flagSchema },
  },
} as const;
export const parsingSchema = {
  type: 'object', additionalProperties: false, required: ['draft', 'clarification'],
  properties: {
    draft: { anyOf: [draftSchema, { type: 'null' }] },
    clarification: { anyOf: [{ type: 'object', additionalProperties: false, required: ['question', 'missing_fields', 'injection_flags'], properties: {
      question: string, missing_fields: { type: 'array', items: { type: 'string', enum: ['amount', 'payee', 'currency', 'items'] } },
      injection_flags: { type: 'array', items: flagSchema },
    } }, { type: 'null' }] },
  },
} as const;

function fail(code = 'INVALID_DRAFT_SCHEMA', message = 'The AI returned fields that do not match the draft schema. No draft or payment was accepted.'): never {
  throw new AppError('draft validation', code, message, 422);
}
export function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function keys(value: unknown, names: string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}
function text(value: unknown, max = 1000): value is string { return typeof value === 'string' && value.length <= max; }
export function cents(value: unknown): bigint {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) return fail('INVALID_MONEY', 'Amounts must be finite, nonnegative numbers with at most two decimal places.');
  const [whole, fraction = ''] = String(value).split('.');
  const result = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) return fail('AMOUNT_RANGE', 'The amount is outside the exact monetary range supported by this draft format.');
  return result;
}
export function flags(value: unknown): InjectionFlag[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(flag => !keys(flag, ['type', 'snippet']) || !text(flag.type, 100) || !flag.type.trim() || !text(flag.snippet, 4000) || !flag.snippet.trim())) return fail();
  return value.map(flag => ({ type: flag.type, snippet: flag.snippet }));
}
export function validateDraft(value: unknown): Draft {
  if (!keys(value, [...draftSchema.required]) || !keys(value.payee, ['name', 'email']) || !text(value.payee.name, 120) || !text(value.payee.email, 254)) return fail();
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 20) return fail();
  if (!text(value.currency, 3) || !/^[A-Z]{3}$/.test(value.currency) || !text(value.note, 1000) || typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) return fail();
  if (value.payee.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.payee.email)) return fail('INVALID_PAYEE_EMAIL', 'The AI returned an invalid payee email. An unknown email must stay empty.');
  if (!Array.isArray(value.ambiguities) || value.ambiguities.length > 20 || value.ambiguities.some(item => !text(item) || !item.trim())) return fail();
  let total = 0n;
  const items = value.items.map(item => {
    if (!keys(item, ['name', 'quantity', 'unit_amount']) || !text(item.name, 127) || !item.name.trim() || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return fail();
    total += cents(item.unit_amount) * BigInt(item.quantity);
    return { name: item.name, quantity: item.quantity, unit_amount: item.unit_amount as number };
  });
  if (total <= 0n || total > BigInt(Number.MAX_SAFE_INTEGER)) return fail('INVALID_TOTAL', 'The draft needs a positive, exactly representable total.');
  if (cents(value.total) !== total) return fail('TOTAL_MISMATCH', 'The AI total disagrees with quantity × unit amount. The server blocked this draft.');
  const recomputed = Number(total) / 100;
  if (cents(recomputed) !== total) return fail('AMOUNT_RANGE', 'The total cannot be represented exactly by this draft format.');
  return { payee: { name: value.payee.name, email: value.payee.email }, items, currency: value.currency, total: recomputed, note: value.note, confidence: value.confidence, ambiguities: [...value.ambiguities], injection_flags: flags(value.injection_flags) };
}
export function validateParsingResult(value: unknown): ParseResult {
  if (!keys(value, ['draft', 'clarification']) || (value.draft === null) === (value.clarification === null)) return fail('INVALID_PARSE_RESULT', 'The AI must return either one draft or one clarification question.');
  if (value.clarification === null) return { kind: 'draft', draft: validateDraft(value.draft) };
  const clarification = value.clarification;
  if (value.draft !== null || !keys(clarification, ['question', 'missing_fields', 'injection_flags']) || !text(clarification.question) || !clarification.question.trim() || !Array.isArray(clarification.missing_fields) || !clarification.missing_fields.length || clarification.missing_fields.length > 4 || clarification.missing_fields.some(field => !['amount', 'payee', 'currency', 'items'].includes(field))) return fail('INVALID_CLARIFICATION', 'The AI returned an incomplete clarification question. No draft was accepted.');
  return { kind: 'clarification', question: clarification.question, missing_fields: [...new Set(clarification.missing_fields)] as MissingField[], injection_flags: flags(clarification.injection_flags) };
}
