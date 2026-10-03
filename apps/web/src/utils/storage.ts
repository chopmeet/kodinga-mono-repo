// localStorage can be unavailable (private mode, quota, non-browser runtimes):
// reads fall back to the default value, writes are best-effort.
export const AppStorage = {
  getItem<T>(key: string, defaultValue: T | null = null): T | null {
    try {
      const data = window.localStorage.getItem(key);
      return data ? (JSON.parse(data) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  setItem(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  },
};
