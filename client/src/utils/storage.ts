type StorageKind = 'local' | 'session';

function getStorage(kind: StorageKind): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGetItem(kind: StorageKind, key: string): string | null {
  try {
    return getStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(kind: StorageKind, key: string, value: string): boolean {
  try {
    const storage = getStorage(kind);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(kind: StorageKind, key: string): boolean {
  try {
    const storage = getStorage(kind);
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Safely reads a value from localStorage without throwing in restricted WebViews. */
export const safeGetLocal = (key: string): string | null => safeGetItem('local', key);

/** Safely writes a value to localStorage without throwing in restricted WebViews. */
export const safeSetLocal = (key: string, value: string): boolean => safeSetItem('local', key, value);

/** Safely removes a value from localStorage without throwing in restricted WebViews. */
export const safeRemoveLocal = (key: string): boolean => safeRemoveItem('local', key);

/** Safely reads a value from sessionStorage without throwing in restricted WebViews. */
export const safeGetSession = (key: string): string | null => safeGetItem('session', key);

/** Safely writes a value to sessionStorage without throwing in restricted WebViews. */
export const safeSetSession = (key: string, value: string): boolean => safeSetItem('session', key, value);

/** Safely removes a value from sessionStorage without throwing in restricted WebViews. */
export const safeRemoveSession = (key: string): boolean => safeRemoveItem('session', key);
