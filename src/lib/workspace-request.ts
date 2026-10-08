import { AppError } from './errors';
import { formText } from './parsing-request';
import { draftId } from './journal';
import type { DraftEdits } from './intent-flow';

export async function workspaceForm(request: Request, appOrigin: string): Promise<URLSearchParams> {
  if (request.method !== 'POST' || new URL(request.url).origin !== appOrigin || request.headers.get('origin') !== appOrigin) throw new AppError('intent input', 'ORIGIN_MISMATCH', 'Submit this workspace form from its configured APP_URL.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new AppError('intent input', 'INVALID_FORM', 'Use the workspace form.', 415);
  return new URLSearchParams(await formText(request));
}
function one(form: URLSearchParams, key: string): string {
  const values = form.getAll(key);
  if (values.length !== 1) throw new AppError('confirmation', 'INVALID_EDIT_FIELDS', 'The confirmation must contain each visible field exactly once.', 422);
  return values[0]!;
}
export function editRequest(form: URLSearchParams): { id: string; revision: number; edits: DraftEdits } {
  const allowed = ['draftId', 'revision', 'payeeName', 'payeeEmail', 'currency', 'total', 'note', 'itemName', 'itemQuantity', 'itemAmount'];
  if ([...form.keys()].some(key => !allowed.includes(key))) throw new AppError('confirmation', 'INVALID_EDIT_FIELDS', 'Confirmation accepts only the draft ID, revision and visible payment edits. Client-supplied execution or AI metadata is rejected.', 422);
  const id = draftId(one(form, 'draftId')); const version = one(form, 'revision');
  if (!/^\d{1,9}$/.test(version)) throw new AppError('confirmation', 'INVALID_REVISION', 'Reload the stored card.', 409);
  const names = form.getAll('itemName'), quantities = form.getAll('itemQuantity'), amounts = form.getAll('itemAmount');
  if (!names.length || names.length > 20 || quantities.length !== names.length || amounts.length !== names.length || quantities.some(value => !/^\d{1,9}$/.test(value)) || amounts.some(value => !/^\d+(?:\.\d{1,2})?$/.test(value))) throw new AppError('confirmation', 'INVALID_LINE_ITEMS', 'Use whole positive quantities and unit amounts with at most two decimal places.', 422);
  const total = one(form, 'total');
  if (!/^\d+(?:\.\d{1,2})?$/.test(total)) throw new AppError('confirmation', 'INVALID_TOTAL', 'Enter a total with at most two decimal places.', 422);
  return { id, revision: Number(version), edits: { payee: { name: one(form, 'payeeName').trim(), email: one(form, 'payeeEmail').trim() }, items: names.map((name, i) => ({ name: name.trim(), quantity: Number(quantities[i]), unit_amount: Number(amounts[i]) })), currency: one(form, 'currency').trim(), total: Number(total), note: one(form, 'note').trim() } };
}
