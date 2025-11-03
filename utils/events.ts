type Listener<T = any> = (payload: T) => void;

class Events {
  private listeners: Record<string, Set<Listener>> = {};

  on<T = any>(event: string, cb: Listener<T>) {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event].add(cb as Listener);
    return () => this.off(event, cb as Listener);
  }

  off<T = any>(event: string, cb: Listener<T>) {
    this.listeners[event]?.delete(cb as Listener);
  }

  emit<T = any>(event: string, payload?: T) {
    this.listeners[event]?.forEach((cb) => {
      try { (cb as Listener<T>)(payload as T); } catch {}
    });
  }
}

const events = new Events();
export default events;
