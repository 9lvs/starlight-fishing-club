// A small typed event bus. Systems talk through events instead of holding
// references to each other, so any listener can be removed without breakage.

export type Listener<P> = (payload: P) => void;

export class EventBus<E extends object> {
  private listeners = new Map<keyof E, Set<Listener<never>>>();

  on<K extends keyof E>(type: K, fn: Listener<E[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn as Listener<never>);
    return () => this.off(type, fn);
  }

  once<K extends keyof E>(type: K, fn: Listener<E[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off<K extends keyof E>(type: K, fn: Listener<E[K]>): void {
    this.listeners.get(type)?.delete(fn as Listener<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copy so listeners can unsubscribe while being called.
    for (const fn of [...set]) {
      try {
        (fn as Listener<E[K]>)(payload);
      } catch (err) {
        // One broken listener must not stop the others.
        console.error(`[bus] listener for "${String(type)}" threw`, err);
      }
    }
  }

  listenerCount<K extends keyof E>(type: K): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
