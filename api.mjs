import { handleApi } from '../lib/handler.mjs';
import { blobStore } from '../lib/store.mjs';

export default async function api(request) {
  return handleApi(request, {
    store: await blobStore(),
    env: process.env,
  });
}

export const config = {
  path: '/api/*',
};
