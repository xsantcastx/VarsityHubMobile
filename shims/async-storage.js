const memoryStorage = new Map();

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStore() {
  if (hasLocalStorage()) {
    return window.localStorage;
  }
  return null;
}

function getItemSync(key) {
  const store = getStore();
  if (store) return store.getItem(key);
  return memoryStorage.has(key) ? memoryStorage.get(key) : null;
}

function setItemSync(key, value) {
  const store = getStore();
  if (store) {
    store.setItem(key, value);
    return;
  }
  memoryStorage.set(key, value);
}

function removeItemSync(key) {
  const store = getStore();
  if (store) {
    store.removeItem(key);
    return;
  }
  memoryStorage.delete(key);
}

function clearSync() {
  const store = getStore();
  if (store) {
    store.clear();
    return;
  }
  memoryStorage.clear();
}

const AsyncStorage = {
  async getItem(key) {
    return getItemSync(key);
  },

  async setItem(key, value) {
    setItemSync(key, value);
  },

  async removeItem(key) {
    removeItemSync(key);
  },

  async clear() {
    clearSync();
  },

  async multiGet(keys) {
    return keys.map((key) => [key, getItemSync(key)]);
  },

  async multiRemove(keys) {
    keys.forEach((key) => removeItemSync(key));
  },
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
