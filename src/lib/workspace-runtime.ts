import { env } from 'cloudflare:workers';
import type { AstroCookies } from 'astro';
import { AppError } from './errors';
import { configuration } from './config';
import { PayPal } from './paypal';
import { llmConfiguration, parseIntent } from './llm';
import { paymentCap, sandboxPayees } from './payment-policy';
import { IntentFlow } from './intent-flow';
import type { DraftStore, StoreResult } from './journal-types';

async function storeCall<T>(operation: Promise<StoreResult<T>>): Promise<T> {
  let result: StoreResult<T>;
  try { result = await operation; } catch { throw new AppError('draft storage', 'STORAGE_UNAVAILABLE', 'The draft journal is unavailable. No successful payment is assumed; use the stored status when it recovers.', 503); }
  if (!result.ok) throw new AppError(result.error.stage, result.error.code, result.error.message, result.error.httpStatus);
  return result.value;
}
export function workspaceRuntime(cookies: AstroCookies, url: URL) {
  let workspace = cookies.get('saypay_workspace')?.value;
  if (!workspace || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(workspace)) {
    workspace = crypto.randomUUID();
    cookies.set('saypay_workspace', workspace, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 30 });
  }
  const stub = env.DRAFT_JOURNAL.getByName(workspace);
  const store: DraftStore = { create: entry => storeCall(stub.create(entry)), get: id => storeCall(stub.get(id)), replace: (entry, revision) => storeCall(stub.replace(entry, revision)), list: before => storeCall(stub.list(before)) };
  const values = { ...env };
  const config = configuration(values);
  const llm = llmConfiguration(values);
  const cap = () => paymentCap(values);
  const payees = () => sandboxPayees(values);
  const paypal = new PayPal(config, undefined, undefined, { returnPath: '/workspace/return', cancelPath: '/workspace/cancel', draftReference: true });
  const flow = new IntentFlow({ store, parse: input => parseIntent(input, llm), paypal, paypalConfig: config, cap, payees, forbiddenValues: [config.clientId, config.clientSecret, llm.key] });
  return { flow, store, cap, payees, appOrigin: config.appUrl, configured: !!llm.base && !!llm.key && !!llm.model };
}
