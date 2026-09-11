import { beforeEach, describe, expect, test } from "vitest";

import {
  clearMemoryStorageForTests,
  readDeviceValue,
  removeDeviceValue,
  type StorageLike,
  writeDeviceValue,
} from "@/lib/device-storage";

const createStorage = (throws = false): StorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => {
      if (throws) throw new Error("blocked");
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (throws) throw new Error("blocked");
      values.set(key, value);
    },
    removeItem: (key) => {
      if (throws) throw new Error("blocked");
      values.delete(key);
    },
  };
};

describe("device storage", () => {
  beforeEach(clearMemoryStorageForTests);

  test("prefers local storage", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();

    expect(writeDeviceValue("identity", "moo", { localStorage, sessionStorage })).toBe("localStorage");
    expect(readDeviceValue("identity", { localStorage, sessionStorage })).toEqual({
      value: "moo",
      backend: "localStorage",
    });
  });

  test("falls back through session storage to memory", () => {
    const blocked = createStorage(true);
    const sessionStorage = createStorage();

    expect(writeDeviceValue("session", "value", { localStorage: blocked, sessionStorage })).toBe("sessionStorage");
    expect(writeDeviceValue("memory", "value", { localStorage: blocked, sessionStorage: blocked })).toBe("memory");
    expect(readDeviceValue("memory", { localStorage: blocked, sessionStorage: blocked })).toEqual({
      value: "value",
      backend: "memory",
    });
    expect(writeDeviceValue("memory-only", "value", {})).toBe("memory");
  });

  test("removes values from every available backend", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    writeDeviceValue("identity", "moo", { localStorage, sessionStorage });

    removeDeviceValue("identity", { localStorage, sessionStorage });

    expect(readDeviceValue("identity", { localStorage, sessionStorage })).toBeNull();
  });
});