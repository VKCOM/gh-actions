export class Mutex {
  #promiseWithResolvers: PromiseWithResolvers<void> | null = null;

  async acquire(): Promise<Disposable> {
    await this.lock();

    return {
      [Symbol.dispose]: () => {
        this.unlock();
      },
    };
  }

  async lock() {
    while (this.#promiseWithResolvers) {
      await this.#promiseWithResolvers.promise;
    }

    this.#promiseWithResolvers = Promise.withResolvers<void>();
  }

  unlock() {
    this.#promiseWithResolvers?.resolve();
    this.#promiseWithResolvers = null;
  }
}

export class MutexSet<K> {
  #map = new Map<K, Mutex>();

  #getMutex(key: K): Mutex {
    const mutex = this.#map.get(key);
    if (mutex) {
      return mutex;
    }

    const newMutex = new Mutex();
    this.#map.set(key, newMutex);

    return newMutex;
  }

  async lock(key: K) {
    const mutex = this.#getMutex(key);
    await mutex.lock();
  }

  unlock(key: K) {
    const mutex = this.#getMutex(key);
    mutex.unlock();
  }

  async acquire(key: K): Promise<Disposable> {
    await this.lock(key);

    return {
      [Symbol.dispose]: () => {
        this.unlock(key);
      },
    };
  }
}

export class MapWithMutex<K, V> extends Map<K, V> {
  #mutex = new MutexSet();

  async acquire(key: K) {
    const disposable = await this.#mutex.acquire(key);

    return {
      ...disposable,
      delete: () => {
        return this.delete(key);
      },
      get: () => {
        return this.get(key);
      },
      set: (value: V) => {
        this.set(key, value);
      },
    };
  }
}
