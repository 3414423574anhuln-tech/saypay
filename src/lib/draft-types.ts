export interface InjectionFlag { type: string; snippet: string }
export interface Draft {
  payee: { name: string; email: string };
  items: { name: string; quantity: number; unit_amount: number }[];
  currency: string;
  total: number;
  note: string;
  confidence: number;
  ambiguities: string[];
  injection_flags: InjectionFlag[];
}
export type MissingField = 'amount' | 'payee' | 'currency' | 'items';
export type ParseResult = { kind: 'draft'; draft: Draft } | {
  kind: 'clarification'; question: string; missing_fields: MissingField[]; injection_flags: InjectionFlag[];
};
export interface ParsingInput { intent: string; answers: string[] }
export interface LLMConfiguration { base: string; key: string; model: string }
