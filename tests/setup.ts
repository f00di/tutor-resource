// IndexedDB for Node (the app's storage), so data tests run against the real Dexie schema.
import "fake-indexeddb/auto";

// Node 25 has its own localStorage global, which has no methods unless Node is given a file, and it
// hides jsdom's. The theme, language and welcome screen need a working one (CI's Node 22 has jsdom's).
if (typeof globalThis.localStorage?.getItem !== "function") {
  const items = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
    key: (index) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}
