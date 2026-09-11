import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, test } from "vitest";

const projectId = "whosthatpokemon-rules-test";
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve("firebase/firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("catalog rules", () => {
  test("allows anyone to read a catalog game", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "games", "pokemon-red"), {
        name: "Pokemon Red",
      });
    });

    const context = testEnvironment.unauthenticatedContext();

    await assertSucceeds(
      getDoc(doc(context.firestore(), "games", "pokemon-red")),
    );
  });

  test("denies catalog writes from clients", async () => {
    const context = testEnvironment.authenticatedContext("host-1");

    await assertFails(
      setDoc(doc(context.firestore(), "games", "pokemon-red"), {
        name: "Pokemon Red",
      }),
    );
  });
});

describe("user profile rules", () => {
  test("allows an authenticated user to create and read their profile", async () => {
    const context = testEnvironment.authenticatedContext("user-1");
    const profile = doc(context.firestore(), "users", "user-1");

    await assertSucceeds(setDoc(profile, {
      uid: "user-1",
      username: "Trainer",
      authMode: "firebase-anonymous",
    }));
    await assertSucceeds(getDoc(profile));
  });

  test("denies access to another user's profile", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "user-2"), {
        uid: "user-2",
        username: "Other Trainer",
      });
    });
    const context = testEnvironment.authenticatedContext("user-1");

    await assertFails(getDoc(doc(context.firestore(), "users", "user-2")));
    await assertFails(setDoc(doc(context.firestore(), "users", "user-2"), {
      uid: "user-1",
      username: "Overwrite",
    }));
  });
});