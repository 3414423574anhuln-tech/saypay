import { env } from 'cloudflare:workers';
import { llmConfiguration, parseIntent } from './llm';
import type { ParsingInput } from './draft-types';

export function parsingRuntime() {
  const config = llmConfiguration({ ...env });
  return { config, parse: (input: ParsingInput) => parseIntent(input, config), appOrigin: typeof env.APP_URL === 'string' ? env.APP_URL : 'http://localhost:4321' };
}
