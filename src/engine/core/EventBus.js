/**
 * Minimal synchronous event emitter.
 *
 * Hand-rolled (~30 lines) because the engine needs exactly three features —
 * on/off/emit — and pulling in an emitter library would violate the
 * dependency budget for no benefit. `emit` snapshots the listener array so a
 * listener can unsubscribe itself while handling an event.
 */
export default class EventBus {
  constructor() {
    this.listeners = new Map()
  }

  /** @param {string} type @param {Function} handler @returns {() => void} unsubscribe */
  on(type, handler) {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(handler)
    return () => this.off(type, handler)
  }

  once(type, handler) {
    const unsubscribe = this.on(type, (payload) => {
      unsubscribe()
      handler(payload)
    })
    return unsubscribe
  }

  off(type, handler) {
    this.listeners.get(type)?.delete(handler)
  }

  emit(type, payload) {
    const set = this.listeners.get(type)
    if (!set || set.size === 0) return
    for (const handler of [...set]) handler(payload)
  }

  clear() {
    this.listeners.clear()
  }
}