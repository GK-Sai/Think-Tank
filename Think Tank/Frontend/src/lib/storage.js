/* Safe storage wrappers.
   Safari private mode, blocked third-party storage and sandboxed iframes all
   make localStorage/sessionStorage THROW on access. Everything here degrades
   to an in-memory object instead of taking the app down with it. */

const memory = {};

function wrap(getApi) {
  return {
    get(key) {
      try { return getApi().getItem(key); }
      catch { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
    },
    set(key, value) {
      try { getApi().setItem(key, value); }
      catch { memory[key] = value; }
    },
    remove(key) {
      try { getApi().removeItem(key); }
      catch { delete memory[key]; }
    },
  };
}

export const safeLocal = wrap(() => window.localStorage);
export const safeSession = wrap(() => window.sessionStorage);
