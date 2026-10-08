import { AppError } from './errors';
import { cents } from './schema';
import type { Draft, InjectionFlag, MissingField, ParseResult, ParsingInput } from './draft-types';

export function validatedInput(value: ParsingInput): ParsingInput {
  if (typeof value.intent !== 'string' || !value.intent.trim() || value.intent.length > 4000 || !Array.isArray(value.answers) || value.answers.length > 8 || value.answers.some(answer => typeof answer !== 'string' || !answer.trim() || answer.length > 1000)) throw new AppError('intent input', 'INVALID_INTENT', 'Enter an intent of up to 4,000 characters and up to eight clarification answers of 1,000 characters each. No payment was created.');
  return { intent: value.intent.trim(), answers: value.answers.map(answer => answer.trim()) };
}
export function inspectForAmountTampering(text: string): { extraction: string; flags: InjectionFlag[] } {
  const flags: InjectionFlag[] = [];
  // Parsing-only recognizers for explicit override instructions. This is not a general injection detector.
  const pattern = /(?:ignore\s+(?:the\s+)?(?:original\s+)?amount\b[^!?\n]*?(?:change|replace|set|make)\b[^!?\n]*?(?:[.!?](?!\d)|$)|忽略(?:上面|上述|之前|原来|原先|原始)?(?:的)?金额[^。！？\n]*(?:改成|改为|修改为|设置为)[^。！？\n]*(?:[。！？]|$))/gi;
  const extraction = text.replace(pattern, snippet => { flags.push({ type: 'amount_tampering', snippet }); return ' '; }).trim();
  return { extraction, flags };
}
function chineseNumber(text: string): number | null {
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
  const [whole, fraction] = text.split('点');
  if (!whole || text.split('点').length > 2 || (fraction && (!/^[零〇一二三四五六七八九]{1,2}$/.test(fraction)))) return null;
  let total = 0, section = 0, digit = 0;
  if (/^[零〇一二三四五六七八九]+$/.test(whole)) total = Number([...whole].map(c => digits[c]).join(''));
  else for (const char of whole) {
    if (Object.hasOwn(digits, char)) digit = digits[char]!;
    else if (units[char]) { const unit = units[char]!; if (unit === 10000) { total += (section + digit || 1) * unit; section = 0; } else section += (digit || 1) * unit; digit = 0; }
    else return null;
  }
  if (!/^[零〇一二三四五六七八九]+$/.test(whole)) total += section + digit;
  return fraction ? Number(`${total}.${[...fraction].map(c => digits[c]).join('')}`) : total;
}
function moneyFacts(source: string): Set<string> {
  const result = new Set<string>();
  const number = '(?:\\d+(?:\\.\\d{1,2})?|[零〇一二两三四五六七八九十百千万点]+)';
  const currency = '(?:USD|EUR|GBP|CNY|JPY|HKD|dollars?|euros?|pounds?|美元|人民币|欧元|英镑|日元|港元)';
  for (const pattern of [new RegExp(`(${number})\\s*${currency}`, 'gi'), new RegExp(`(?:\\$|${currency})\\s*(${number})`, 'gi')]) {
    for (const match of source.normalize('NFKC').matchAll(pattern)) {
      const token = match[1]!; const value = /^\d/.test(token) ? Number(token) : chineseNumber(token);
      if (value !== null) { try { result.add(String(cents(value))); } catch { /* Unsupported money is never rounded into a fact. */ } }
    }
  }
  return result;
}
function clarification(fields: MissingField[], injection_flags: InjectionFlag[]): ParseResult {
  const questions: Record<MissingField, string> = { amount: 'What exact amount should this payment use?', payee: 'Who should receive this payment? Provide a name or email.', currency: 'Which currency should this payment use?', items: 'What quantities and unit amounts should the line items use?' };
  const unique = [...new Set(fields)];
  return { kind: 'clarification', question: unique.map(field => questions[field]).join(' '), missing_fields: unique, injection_flags };
}
export function groundResult(result: ParseResult, input: ParsingInput, extraction: ParsingInput, detected: InjectionFlag[]): ParseResult {
  const original = [input.intent, ...input.answers].join('\n');
  const source = [extraction.intent, ...extraction.answers].join('\n');
  const modelFlags = result.kind === 'draft' ? result.draft.injection_flags : result.injection_flags;
  if (modelFlags.some(flag => !original.includes(flag.snippet))) throw new AppError('draft validation', 'UNSUPPORTED_INJECTION_FLAG', 'The AI returned a tampering snippet that is absent from the input. The result was blocked.', 422);
  const merged = [...new Map([...detected, ...modelFlags].map(flag => [JSON.stringify(flag), flag])).values()];
  if (merged.length > 20) throw new AppError('draft validation', 'TOO_MANY_INJECTION_FLAGS', 'The input contains too many separate tampering snippets. Rephrase the intent; no draft was accepted.', 422);
  if (result.kind === 'clarification') return { ...result, injection_flags: merged };
  const draft: Draft = { ...result.draft, injection_flags: merged };
  const lower = source.toLowerCase();
  const missing: MissingField[] = [];
  if (draft.payee.email && !lower.includes(draft.payee.email.toLowerCase())) throw new AppError('draft validation', 'UNSUPPORTED_EMAIL', 'The AI added a payee email that is absent from the intent and answers. Unknown emails must stay empty.', 422);
  if ((!draft.payee.name.trim() && !draft.payee.email.trim()) || (draft.payee.name && !lower.includes(draft.payee.name.toLowerCase()))) missing.push('payee');
  const amounts = moneyFacts(source);
  const knownCurrency = new RegExp(`(?:^|[^A-Za-z])${draft.currency}(?![A-Za-z])`, 'i').test(source) || ({ USD: /\$|\bdollars?\b|美元/i, EUR: /\beuros?\b|欧元/i, GBP: /\bpounds?\b|英镑/i, CNY: /人民币/, JPY: /日元/, HKD: /港元/ } as Record<string, RegExp>)[draft.currency]?.test(source);
  if (!knownCurrency) missing.push('currency');
  const escapedPayee = (draft.payee.name || draft.payee.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // An amount explicitly attached to the recipient is grounded even if its currency arrives in a later answer.
  if (knownCurrency && escapedPayee) for (const match of source.matchAll(new RegExp(`(?:\\b(?:pay|send|transfer)\\s+(?:to\\s+)?${escapedPayee}\\s+|(?:给|向)${escapedPayee}(?:支付|转账|付款|付)?)(${String.raw`\d+(?:\.\d{1,2})?`})`, 'gi'))) amounts.add(String(cents(Number(match[1]))));
  const answerAmounts = moneyFacts(extraction.answers.join('\n'));
  // A numeric-only answer can resolve the amount when the original explicitly supplies its currency.
  if (knownCurrency) for (const answer of extraction.answers) if (/^\d+(?:\.\d{1,2})?$/.test(answer)) { const amount = String(cents(Number(answer))); amounts.add(amount); answerAmounts.add(amount); }
  const vaguePattern = /(?:about|around|roughly|approximately|up to|大约|大概|约|[~≈])\s*(?:USD\s*|\$\s*)?(?:\d|[零〇一二两三四五六七八九十百千万])|(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+)\s*(?:dollars?|USD|美元)\s*(?:or so|左右)|(?:\d+|[零〇一二两三四五六七八九十百千万]+)\s*(?:or|或|到|至|[-–])\s*(?:\d+|[零〇一二两三四五六七八九十百千万]+)\s*(?:dollars?|USD|美元)|(?:几|数)[十百千万]?美元/i;
  const exactAnswer = draft.items.every(item => answerAmounts.has(String(cents(item.unit_amount)))) && !extraction.answers.some(answer => vaguePattern.test(answer));
  if (!amounts.size || (vaguePattern.test(source) && !exactAnswer)) missing.push('amount');
  const originalAmounts = moneyFacts(extraction.intent);
  if (draft.items.length === 1 && draft.items[0]!.quantity === 1 && originalAmounts.size === 1 && !vaguePattern.test(extraction.intent) && !originalAmounts.has(String(cents(draft.total)))) {
    if (detected.length) throw new AppError('draft validation', 'UNSUPPORTED_AMOUNT', 'The AI changed the originally stated amount after a tampering instruction. The altered draft was blocked.', 422);
    missing.push('amount');
  }
  if (missing.length) return clarification(missing, merged);
  if (draft.items.some(item => !amounts.has(String(cents(item.unit_amount)))) && !(draft.items.length === 1 && amounts.has(String(cents(draft.total))))) throw new AppError('draft validation', 'UNSUPPORTED_AMOUNT', 'An AI line amount is not supported by stated amounts or their exact allocation to a stated quantity. The draft was blocked rather than guessed.', 422);
  const chineseQuantities = [...source.matchAll(/[零〇一二两三四五六七八九十百千万]+/g)].map(match => chineseNumber(match[0]));
  if (draft.items.some(item => item.quantity !== 1 && !new RegExp(`(?:^|\\D)${item.quantity}(?:\\D|$)`).test(source) && !chineseQuantities.includes(item.quantity))) throw new AppError('draft validation', 'UNSUPPORTED_QUANTITY', 'An AI quantity is not stated in the input. The draft was blocked.', 422);
  if (draft.note && !lower.includes(draft.note.toLowerCase())) throw new AppError('draft validation', 'UNSUPPORTED_NOTE', 'The AI added a note that is not present in the intent or answers. The draft was blocked.', 422);
  const requiredAmbiguities: string[] = [];
  const ambiguousFields: MissingField[] = [];
  for (const ambiguity of draft.ambiguities) {
    const fields: MissingField[] = [];
    if (/\bamount\b|金额/i.test(ambiguity)) fields.push('amount');
    if (/\bcurrency\b|币种|货币/i.test(ambiguity)) fields.push('currency');
    // An absent optional email is a valid draft condition, not a missing recipient.
    const optionalEmail = !draft.payee.email && /\bemail\b|邮箱|邮件地址/i.test(ambiguity) && /unknown|not (?:provided|supplied|known)|missing|absent|left empty|未提供|未知|缺少|空/i.test(ambiguity) && !fields.length;
    // A grounded email also identifies a payee whose optional display name is absent.
    const optionalName = !!draft.payee.email && !draft.payee.name && /\b(?:display\s+)?name\b|姓名|名称/i.test(ambiguity) && /unknown|not (?:provided|supplied|known)|missing|absent|left empty|未提供|未知|缺少|空/i.test(ambiguity) && !/\b(?:ambiguous|conflicting|uncertain|multiple|unverified)\b|歧义|冲突|不确定|多个/i.test(ambiguity) && !fields.length;
    if (!optionalEmail && !optionalName && /\b(?:payee|recipient)\b|收款/i.test(ambiguity)) fields.push('payee');
    if (fields.length) { requiredAmbiguities.push(ambiguity); ambiguousFields.push(...fields); }
  }
  if (ambiguousFields.length) return { kind: 'clarification', question: requiredAmbiguities.join(' '), missing_fields: [...new Set(ambiguousFields)], injection_flags: merged };
  return { kind: 'draft', draft };
}
