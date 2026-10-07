import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { parsingRequest } from '../src/lib/parsing-request';

describe('W2 request and no-draft-to-payment boundary', () => {
  it('carries the original intent and ordered answers in the request without a stored draft ID', async () => {
    const body = new URLSearchParams({ intent: 'Pay Alice for avatar design.', answers: JSON.stringify(['USD']), answer: '25 dollars' });
    const request = new Request('http://localhost:4321/parse', { method: 'POST', headers: { origin: 'http://localhost:4321' }, body });
    expect(await parsingRequest(request, 'http://localhost:4321')).toEqual({ intent: 'Pay Alice for avatar design.', answers: ['USD', '25 dollars'] });
  });
  it('rejects mismatched origin and forged clarification history', async () => {
    await expect(parsingRequest(new Request('http://localhost:4321/parse', { method: 'POST', headers: { origin: 'https://different.example.test' }, body: new URLSearchParams({ intent: 'Pay Alice' }) }), 'http://localhost:4321')).rejects.toMatchObject({ code: 'ORIGIN_MISMATCH' });
    await expect(parsingRequest(new Request('http://localhost:4321/parse', { method: 'POST', headers: { origin: 'http://localhost:4321' }, body: new URLSearchParams({ intent: 'Pay Alice', answers: '{invalid' }) }), 'http://localhost:4321')).rejects.toMatchObject({ code: 'INVALID_CLARIFICATION_HISTORY' });
  });
  it('rejects a form exceeding the body byte bound before parsing intent or answers', async () => {
    const request = new Request('http://localhost:4321/parse', { method: 'POST', headers: { origin: 'http://localhost:4321' }, body: new URLSearchParams({ intent: 'x'.repeat(48001) }) });
    await expect(parsingRequest(request, 'http://localhost:4321')).rejects.toMatchObject({ stage: 'intent input', code: 'FORM_TOO_LARGE', httpStatus: 413 });
  });
  it('inspects the complete local import graph of the parser page for payment or persistence dependencies', () => {
    const seen = new Set<string>(); const root = resolve('.');
    const visit = (file: string) => {
      if (seen.has(file)) return; seen.add(file);
      const source = readFileSync(file, 'utf8');
      expect(source, relative(root, file)).not.toMatch(/(?:\/orders\/create|api-m\.sandbox\.paypal|createOrder\(|captureOrder\(|DRAFT_ID)/);
      const imports = [...source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g)].map(match => match[1]!);
      for (const specifier of imports) {
        if (!specifier.startsWith('.') || specifier.endsWith('.css')) continue;
        expect(specifier).not.toMatch(/(?:^|\/)(?:paypal|runtime|flow|application|store|guardrails)(?:\.|$)/);
        const target = resolve(dirname(file), specifier);
        const resolved = [target, `${target}.ts`, `${target}.astro`].find(existsSync);
        expect(resolved, specifier).toBeDefined(); visit(resolved!);
      }
    };
    visit(resolve('src/pages/parse.astro'));
    expect(seen.has(resolve('src/lib/llm.ts'))).toBe(true);
    const route = readFileSync('src/pages/parse.astro', 'utf8');
    expect([...route.matchAll(/<form[^>]+action="([^"]+)"/g)].map(match => match[1])).toEqual(['/parse', '/parse']);
    expect(readFileSync('src/components/DraftResult.astro', 'utf8')).not.toMatch(/<form|<button|action=/);
    const manual = readFileSync('src/pages/orders/create.ts', 'utf8');
    expect(manual).not.toMatch(/(?:parseIntent|LLM_|draftSchema|llm-runtime)/);
  });
});
