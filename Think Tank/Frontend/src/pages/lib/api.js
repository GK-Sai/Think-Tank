/* ------------------------------------------------------------------
   The single switch between demo data and a real server.

   Nothing else in the app knows which one is running: both modules
   export an `api` object with identical methods and return shapes.

     VITE_USE_MOCK=true   (default)  → lib/mockApi.js, localStorage
     VITE_USE_MOCK=false             → lib/httpApi.js, VITE_API_URL

   So when the backend is ready, put this in .env and nothing else has
   to change:

     VITE_USE_MOCK=false
     VITE_API_URL=http://localhost:8000
------------------------------------------------------------------ */

import { api as mockApi, ApiError as MockApiError } from './mockApi';
import { api as httpApi, ApiError as HttpApiError } from './httpApi';
import { reloadDb } from './mockDb';

/** Anything other than the literal string 'false' keeps the demo data on. */
export const USING_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export const api = USING_MOCK ? mockApi : httpApi;

/* Both modules throw their own ApiError class. Components check
   `err instanceof ApiError`, so re-export whichever one is live. */
export const ApiError = USING_MOCK ? MockApiError : HttpApiError;

/**
 * "Forget anything cached locally and read the source again."
 *
 * On the demo data that means dropping the in-memory copy of the database so
 * the next call picks up what another browser tab wrote — which is how a
 * notification raised by the chairman reaches a team member's screen. Against
 * a real server there is nothing to forget: every call already goes to the
 * database, so this is a no-op.
 */
export const invalidateLocalCache = () => {
  if (USING_MOCK) reloadDb();
};
