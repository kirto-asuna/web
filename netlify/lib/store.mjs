import { seedData } from './seed.mjs';
import { normalizeStore } from './core.mjs';

export const DATA_KEY = 'questions.json';
export const STORE_NAME = 'dept-qa';

let blobModulePromise;

export async function blobStore() {
  if (!blobModulePromise) blobModulePromise = import('@netlify/blobs');
  const { getStore } = await blobModulePromise;
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export function memoryStore(initial = null) {
  let value = initial ? JSON.parse(JSON.stringify(initial)) : null;
  return {
    async get(key, options = {}) {
      if (key !== DATA_KEY || !value) return null;
      return options.type === 'json' ? JSON.parse(JSON.stringify(value)) : JSON.stringify(value);
    },
    async setJSON(key, next) {
      if (key !== DATA_KEY) return;
      value = JSON.parse(JSON.stringify(next));
    },
    async set(key, next) {
      if (key !== DATA_KEY) return;
      value = JSON.parse(String(next));
    },
    snapshot() {
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
  };
}

export async function loadStore(store) {
  const existing = await store.get(DATA_KEY, { type: 'json' });
  if (existing) return normalizeStore(existing);
  const initial = normalizeStore(JSON.parse(JSON.stringify(seedData)));
  await store.setJSON(DATA_KEY, initial);
  return initial;
}

export async function saveStore(store, data) {
  await store.setJSON(DATA_KEY, data);
}
