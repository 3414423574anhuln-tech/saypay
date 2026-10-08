import { AppError } from './errors';
import { validatedInput } from './parsing-input';
import type { ParsingInput } from './draft-types';

export async function formText(request: Request): Promise<string> {
  if (!request.body) throw new AppError('intent input', 'INVALID_FORM', 'Submit the intent through the parsing form.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 48000) throw new AppError('intent input', 'FORM_TOO_LARGE', 'The intent and clarification history are too long.', 413);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    try { await reader.cancel(); } catch { /* No rejected form data is used. */ }
    throw error;
  } finally { reader.releaseLock(); }
}
export async function parsingRequest(request: Request, appOrigin: string): Promise<ParsingInput> {
  if (request.method !== 'POST' || new URL(request.url).origin !== appOrigin || request.headers.get('origin') !== appOrigin) throw new AppError('intent input', 'ORIGIN_MISMATCH', 'Open this app at its configured APP_URL before submitting the intent. No parsing request was sent.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new AppError('intent input', 'INVALID_FORM', 'Submit the intent through the parsing form.', 415);
  const body = await formText(request);
  const form = new URLSearchParams(body);
  let answers: unknown;
  try { answers = JSON.parse(form.get('answers') ?? '[]'); } catch { throw new AppError('intent input', 'INVALID_CLARIFICATION_HISTORY', 'The clarification history is invalid. Start again with the original intent.'); }
  if (!Array.isArray(answers) || answers.some(answer => typeof answer !== 'string')) throw new AppError('intent input', 'INVALID_CLARIFICATION_HISTORY', 'Clarification answers must be a list of text answers.');
  const answer = form.get('answer');
  if (answer !== null) answers.push(answer);
  return validatedInput({ intent: form.get('intent') ?? '', answers });
}
