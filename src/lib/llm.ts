import { AppError } from './errors';
import { parsingPrompt } from './prompt';
import { parsingSchema, record, validateParsingResult } from './schema';
import { groundResult, inspectForAmountTampering, validatedInput } from './parsing-input';
import type { LLMConfiguration, ParseResult, ParsingInput } from './draft-types';

export function llmConfiguration(values: Record<string, unknown>): LLMConfiguration {
  const read = (name: string) => typeof values[name] === 'string' ? (values[name] as string).trim() : '';
  return { base: read('LLM_API_BASE'), key: read('LLM_API_KEY'), model: read('LLM_MODEL') };
}
export function requireLLM(config: LLMConfiguration): URL {
  if (!config.base || !config.key || !config.model) throw new AppError('AI configuration', 'LLM_NOT_CONFIGURED', 'Fill LLM_API_BASE, LLM_API_KEY and LLM_MODEL locally in this checkout’s .env. Do not send values through chat.', 503);
  let endpoint: URL;
  try { endpoint = new URL(config.base); } catch { throw new AppError('AI configuration', 'INVALID_LLM_BASE', 'LLM_API_BASE must be an API base URL, with the API version path when required.', 503); }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname)))) throw new AppError('AI configuration', 'INVALID_LLM_BASE', 'Use an HTTPS API base URL without embedded credentials, query or fragment; HTTP is allowed only for a local test service.', 503);
  // DeepSeek documents schema-constrained text output on Responses, not Chat Completions.
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + (endpoint.hostname === 'api.deepseek.com' ? '/responses' : '/chat/completions');
  return endpoint;
}
function providerCode(body: unknown, config: LLMConfiguration, fallback: string): string {
  const code = record(body) && record(body.error) ? body.error.code : null;
  const safe = typeof code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(code) && ![config.key, config.model, config.base].some(value => code.includes(value)) && !/^(?:sk-|gh[pousr]_)/.test(code);
  return safe ? code : fallback;
}
function incomplete(): never {
  throw new AppError('AI parsing', 'INCOMPLETE_LLM_OUTPUT', 'The AI response was incomplete or did not finish normally. No partial draft was accepted.', 502);
}
function invalidOutput(): never {
  throw new AppError('AI parsing', 'INVALID_LLM_OUTPUT', 'The AI response could not be safely used as a draft.', 502);
}
function refusal(): never {
  throw new AppError('AI parsing', 'LLM_REFUSAL', 'The AI service declined this request. Rephrase the payment intent; no draft was accepted.', 422);
}
async function boundedJSON(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Empty response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128000) throw new Error('Oversized response');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    try { await reader.cancel(); } catch { /* Preserve the staged unreadable-response error. */ }
    throw error;
  } finally { reader.releaseLock(); }
}
function responseText(body: unknown, responses: boolean, config: LLMConfiguration): string {
  if (responses) {
    if (record(body) && body.status === 'failed') throw new AppError('AI parsing', providerCode(body, config, 'LLM_RESPONSE_FAILED'), 'The AI service failed to generate a draft. No partial result was accepted.', 502);
    if (!record(body) || body.object !== 'response' || body.status !== 'completed' || body.error || body.incomplete_details) return incomplete();
    if (!Array.isArray(body.output) || body.output.some(item => !record(item) || !['reasoning', 'message'].includes(item.type as string))) return invalidOutput();
    const messages = body.output.filter(item => item.type === 'message');
    if (messages.length !== 1) return invalidOutput();
    const message = messages[0];
    if (message.status !== 'completed' || message.role !== 'assistant' || !Array.isArray(message.content)) return incomplete();
    if (message.content.some((part: unknown) => record(part) && part.type === 'refusal')) return refusal();
    if (message.content.length !== 1 || !record(message.content[0]) || message.content[0].type !== 'output_text' || typeof message.content[0].text !== 'string') return invalidOutput();
    // Reasoning items are never interpreted, rendered or retained as draft data.
    return message.content[0].text;
  }
  const choice = record(body) && Array.isArray(body.choices) ? body.choices[0] : null;
  const message = record(choice) && record(choice.message) ? choice.message : null;
  if (message?.refusal) return refusal();
  if (!record(choice) || choice.finish_reason !== 'stop') return incomplete();
  if (!message || message.tool_calls || typeof message.content !== 'string') return invalidOutput();
  return message.content;
}
export async function parseIntent(value: ParsingInput, config: LLMConfiguration, request: typeof fetch = (input, init) => fetch(input, init)): Promise<ParseResult> {
  const input = validatedInput(value);
  const endpoint = requireLLM(config);
  const inspected = [input.intent, ...input.answers].map(inspectForAmountTampering);
  const detected = inspected.flatMap(item => item.flags);
  const extraction = { intent: inspected[0]!.extraction, answers: inspected.slice(1).map(item => item.extraction) };
  const responses = endpoint.hostname === 'api.deepseek.com';
  const data = JSON.stringify({ original_intent: extraction.intent, clarification_answers: extraction.answers, detected_injection: detected });
  const format = { name: 'saypay_parsing_result', strict: true, schema: parsingSchema };
  const payload = responses
    ? { model: config.model, instructions: parsingPrompt, input: [{ role: 'user', content: data }], text: { format: { type: 'json_schema', ...format } } }
    : { model: config.model, messages: [{ role: 'system', content: parsingPrompt }, { role: 'user', content: data }], response_format: { type: 'json_schema', json_schema: format } };
  let response: Response;
  try {
    // Workerd accepts manual/follow; reject redirects explicitly before reading their body.
    response = await request(endpoint.href, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
  } catch { throw new AppError('AI parsing', 'LLM_NETWORK_ERROR', 'The AI service did not respond or redirected the request. No draft or payment was created; retry when the service is available.', 502); }
  if (response.status >= 300 && response.status < 400) {
    try { await response.body?.cancel(); } catch { /* The rejected response is never used. */ }
    throw new AppError('AI configuration', 'LLM_REDIRECT_BLOCKED', 'The AI endpoint returned a redirect. Check LLM_API_BASE locally; no redirected request or draft was created.', 502);
  }
  let body: unknown;
  try { body = await boundedJSON(response); } catch { throw new AppError('AI parsing', 'INVALID_LLM_RESPONSE', 'The AI service returned an unreadable or oversized response. No draft was accepted.', 502); }
  if (!response.ok) {
    throw new AppError('AI parsing', providerCode(body, config, `HTTP_${response.status}`), 'The AI service rejected parsing. Check the local API credentials, model and JSON-schema support. No fallback or invented draft was used.', 502);
  }
  const content = responseText(body, responses, config);
  if (content.includes(config.key)) return invalidOutput();
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new AppError('AI parsing', 'INVALID_LLM_JSON', 'The AI did not return valid structured JSON. No draft was accepted.', 502); }
  return groundResult(validateParsingResult(parsed), input, extraction, detected);
}
