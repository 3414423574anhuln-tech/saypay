import type { APIRoute } from 'astro';
import { workspaceRuntime } from './workspace-runtime';
import { editRequest, workspaceForm } from './workspace-request';
import { applicationError } from './errors';
import { draftId } from './journal';
import { orderToken } from './flow';

export function actionRoute(action: 'edit' | 'confirm'): APIRoute {
  return async ({ request, cookies, url, redirect }) => {
    let id = ''; let form: URLSearchParams | undefined;
    let runtime: ReturnType<typeof workspaceRuntime> | undefined;
    let validated = false;
    try {
      runtime = workspaceRuntime(cookies, url);
      form = await workspaceForm(request, runtime.appOrigin);
      const rawId = form.getAll('draftId');
      if (rawId.length === 1) id = draftId(rawId[0]!);
      const input = editRequest(form); validated = true;
      if (action === 'confirm') return redirect(await runtime.flow.confirm(input.id, input.revision, input.edits), 303);
      await runtime.flow.edit(input.id, input.revision, input.edits);
      return redirect(`/parse?draftId=${id}`, 303);
    } catch (error) {
      let failure = applicationError(error);
      if (!validated && runtime && id && /^\d{1,9}$/.test(form?.get('revision') ?? '')) {
        try { await runtime.flow.reject(id, Number(form!.get('revision')), failure); }
        catch (recorded) { failure = applicationError(recorded); }
      }
      const query = new URLSearchParams({ ...(id ? { draftId: id } : {}), stage: failure.stage, code: failure.code, message: failure.message });
      return redirect(`/parse?${query}`, 303);
    }
  };
}
export function callbackRoute(action: 'return' | 'status' | 'cancel'): APIRoute {
  return async ({ cookies, url, redirect }) => {
    let id = '';
    try {
      id = draftId(url.searchParams.get('draftId') ?? '');
      const { flow } = workspaceRuntime(cookies, url);
      if (action === 'status') await flow.status(id, url.searchParams.has('token') ? orderToken(url.searchParams.get('token')) : undefined);
      else {
        const token = orderToken(url.searchParams.get('token') || (action === 'cancel' ? (await flow.get(id)).orderId : null));
        if (action === 'return') await flow.finish(id, token); else await flow.cancel(id, token);
      }
      return redirect(`/parse?draftId=${id}`, 303);
    } catch (error) {
      const failure = applicationError(error);
      return redirect(`/parse?${new URLSearchParams({ ...(id ? { draftId: id } : {}), stage: failure.stage, code: failure.code, message: failure.message })}`, 303);
    }
  };
}
