import type { APIRoute } from 'astro';
import { runtime } from '../../lib/runtime';
import { approvalUrl, signSubmittedOrder, submittedOrder } from '../../lib/flow';
import { applicationError, AppError } from '../../lib/errors';
import { requireCredentials } from '../../lib/config';
import { enforcePaymentPolicy, enforcePayeePolicy } from '../../lib/payment-policy';

export const POST: APIRoute = async ({ request, url, redirect }) => {
  try {
    const { config, paypal, cap, payees } = runtime();
    if (url.origin !== config.appUrl || request.headers.get('origin') !== url.origin) throw new AppError('order form', 'ORIGIN_MISMATCH', `Open and submit this form from ${config.appUrl}.`, 403);
    const type = request.headers.get('content-type') ?? '';
    if (!type.startsWith('application/x-www-form-urlencoded')) throw new AppError('order form', 'FORM_REQUIRED', 'Submit the manual payment form.', 415);
    if (Number(request.headers.get('content-length') || 0) > 4096) throw new AppError('order form', 'FORM_TOO_LARGE', 'The order form is too large.', 413);
    requireCredentials(config);
    const submitted = submittedOrder(await request.formData());
    enforcePaymentPolicy(submitted.currency, Number(submitted.amount), cap());
    enforcePayeePolicy(submitted.payeeEmail, payees());
    const signature = await signSubmittedOrder(submitted, config);
    const order = await paypal.createOrder(submitted, signature, submitted.reference);
    return redirect(approvalUrl(order), 303);
  } catch (error) {
    const failure = applicationError(error);
    console.error(JSON.stringify({ stage: failure.stage, code: failure.code }));
    return redirect(`/error?stage=${encodeURIComponent(failure.stage)}&code=${encodeURIComponent(failure.code)}&message=${encodeURIComponent(failure.message)}`, 303);
  }
};
