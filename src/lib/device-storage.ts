export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageBackend = "localStorage" | "sessionStorage" | "memory";

type StorageEnvironment = {
  localStorage?: StorageLike;
  sessionStorage?: StorageLike;
};

const memoryStorage = new Map<string, string>();

const getBackends = (environment: StorageEnvironment) => [
  { name: "localStorage" as const, storage: environment.localStorage },
  { name: "sessionStorage" as const, storage: environment.sessionStorage },
];

const getBrowserEnvironment = (): StorageEnvironment => {
  if (typeof window === "undefined") return {};

  const environment: StorageEnvironment = {};
  try {
    environment.localStorage = window.localStorage;
  } catch {
    // Some privacy modes throw when the storage property is accessed.
  }
  try {
    environment.sessionStorage = window.sessionStorage;
  } catch {
    // The in-memory backend remains available when browser storage is blocked.
  }
  return environment;
};

export const readDeviceValue = (
  key: string,
  environment = getBrowserEnvironment(),
) => {
  for (const backend of getBackends(environment)) {
    if (!backend.storage) continue;

    try {
      const value = backend.storage.getItem(key);
      if (value !== null) return { value, backend: backend.name };
    } catch {
      // Continue to the next storage backend.
    }
  }

  const value = memoryStorage.get(key);
  return value === undefined ? null : { value, backend: "memory" as const };
};

export const writeDeviceValue = (
  key: string,
  value: string,
  environment = getBrowserEnvironment(),
): StorageBackend => {
  for (const backend of getBackends(environment)) {
    if (!backend.storage) continue;

    try {
      backend.storage.setItem(key, value);
      return backend.name;
    } catch {
      // Continue to the next storage backend.
    }
  }

  memoryStorage.set(key, value);
  return "memory";
};

export const removeDeviceValue = (
  key: string,
  environment = getBrowserEnvironment(),
) => {
  for (const backend of getBackends(environment)) {
    if (!backend.storage) continue;
    try {
      backend.storage.removeItem(key);
    } catch {
      // Best-effort removal continues through every backend.
    }
  }
  memoryStorage.delete(key);
};

export const clearMemoryStorageForTests = () => memoryStorage.clear();