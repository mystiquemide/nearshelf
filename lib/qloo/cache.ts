// Small TTL cache with in-flight de-duplication. Only successful values are kept,
// so a failed call is retried by the next request instead of being replayed.
export function createTtlCache<T>(options: { max: number; ttlMs: number; now?: () => number }) {
  const now = options.now ?? Date.now;
  const store = new Map<string, { value: T; expires: number }>();
  const inflight = new Map<string, Promise<T>>();

  return {
    async get(key: string, load: () => Promise<T>): Promise<T> {
      const hit = store.get(key);
      if (hit && hit.expires > now()) {
        // Re-insert to keep the most recently used entries at the end.
        store.delete(key);
        store.set(key, hit);
        return hit.value;
      }
      if (hit) store.delete(key);
      const pending = inflight.get(key);
      if (pending) return pending;

      const p = load()
        .then((value) => {
          store.set(key, { value, expires: now() + options.ttlMs });
          while (store.size > options.max) store.delete(store.keys().next().value!);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
    get size() {
      return store.size;
    },
  };
}

export type TtlCache<T> = ReturnType<typeof createTtlCache<T>>;
