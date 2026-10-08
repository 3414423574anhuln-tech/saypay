import { JsonJournal } from '../src/lib/journal';
import type { JsonKV } from '../src/lib/journal';
import type { DraftStore } from '../src/lib/journal-types';

// Mock JSON persistence only. Actual workerd restart evidence is recorded separately.
export function memoryJournal(snapshot: [string, string][] = []) {
  let data = new Map(snapshot);
  const kv: JsonKV = {
    get: key => data.get(key), put: (key, value) => { data.set(key, value); },
    list: options => [...data].filter(([key]) => key.startsWith(options.prefix) && (!options.end || key < options.end)).sort(([a], [b]) => options.reverse ? b.localeCompare(a) : a.localeCompare(b)).slice(0, options.limit),
  };
  const journal = new JsonJournal(kv, operation => {
    const before = new Map(data);
    try { return operation(); } catch (error) { data = before; throw error; }
  });
  const store: DraftStore = { create: async entry => journal.create(entry), get: async id => journal.get(id), replace: async (entry, revision) => journal.replace(entry, revision), list: async before => journal.list(before) };
  return { store, journal, kv, snapshot: () => [...data] };
}
