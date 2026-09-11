"use client";

import {
  createUserWithEmailAndPassword,
  type User,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { firebaseAuth, firestore } from "@/lib/firebase/client";
import {
  AuthMode,
  type ActiveIdentity,
  type DeviceIdentity,
} from "@/lib/auth/types";
import {
  readDeviceValue,
  removeDeviceValue,
  type StorageBackend,
  writeDeviceValue,
} from "@/lib/device-storage";

const IDENTITY_KEY = "whosthatpokemon.identity.v1";

type Toast = {
  id: number;
  message: string;
  tone: "warning" | "error" | "success";
};

type IdentityContextValue = {
  identity: ActiveIdentity | null;
  deviceIdentity: DeviceIdentity;
  isReady: boolean;
  storageBackend: StorageBackend | null;
  saveUsername: (username: string) => Promise<boolean>;
  switchToMock: (developerId: string) => Promise<void>;
  switchToAnonymous: () => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  signOutEmail: () => Promise<void>;
  showToast: (message: string, tone?: Toast["tone"]) => void;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

const defaultDeviceIdentity = (): DeviceIdentity => ({
  version: 1,
  mode: AuthMode.FirebaseAnonymous,
  username: null,
  mockId: null,
  firebaseUid: null,
  isFallback: false,
});

const parseDeviceIdentity = (value: string | undefined) => {
  if (!value) return defaultDeviceIdentity();

  try {
    const parsed = JSON.parse(value) as Partial<DeviceIdentity>;
    const validMode = Object.values(AuthMode).includes(parsed.mode as AuthMode);
    if (parsed.version !== 1 || !validMode) return defaultDeviceIdentity();

    return {
      version: 1,
      mode: parsed.mode as AuthMode,
      username: typeof parsed.username === "string" ? parsed.username : null,
      mockId: typeof parsed.mockId === "string" ? parsed.mockId : null,
      firebaseUid: typeof parsed.firebaseUid === "string" ? parsed.firebaseUid : null,
      isFallback: parsed.isFallback === true,
    } satisfies DeviceIdentity;
  } catch {
    return defaultDeviceIdentity();
  }
};

const toMockId = (input: string) => {
  const value = input.startsWith("moo-") ? input.slice(4) : input;
  return `moo-${value || "developer"}`;
};

const getErrorDetails = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const code = "code" in error ? String(error.code) : "unknown";
    const message = "message" in error ? String(error.message) : String(error);
    return { code, message };
  }
  return { code: "unknown", message: String(error) };
};

export const IdentityProvider = ({ children }: { children: ReactNode }) => {
  const [deviceIdentity, setDeviceIdentity] = useState<DeviceIdentity>(defaultDeviceIdentity);
  const [identity, setIdentity] = useState<ActiveIdentity | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [storageBackend, setStorageBackend] = useState<StorageBackend | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const deviceIdentityRef = useRef(deviceIdentity);
  const toastId = useRef(0);
  const anonymousSignInInFlight = useRef(false);

  const persistIdentity = (next: DeviceIdentity) => {
    deviceIdentityRef.current = next;
    setDeviceIdentity(next);
    setStorageBackend(writeDeviceValue(IDENTITY_KEY, JSON.stringify(next)));
  };

  const addToast = (message: string, tone: Toast["tone"] = "error") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 7000);
  };

  const reportError = async (scope: string, error: unknown) => {
    const details = getErrorDetails(error);
    console.error(`[${scope}] ${details.code}: ${details.message}`, error);
    addToast(`${details.code}: ${details.message}`);
    try {
      await fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, ...details }),
      });
    } catch {
      // The browser console remains the fallback when server logging is unavailable.
    }
  };

  const activateMockFallback = (
    username: string | null,
    warning = "Firebase is unavailable. Mock mode is active temporarily; refresh and try again later.",
  ) => {
    const existing = deviceIdentityRef.current.mockId;
    const mockId = existing ?? toMockId(`fallback-${crypto.randomUUID().slice(0, 8)}`);
    const next: DeviceIdentity = {
      version: 1,
      mode: AuthMode.Mock,
      username,
      mockId,
      firebaseUid: null,
      isFallback: true,
    };
    persistIdentity(next);
    setIdentity({ id: mockId, username, mode: AuthMode.Mock, isFirebaseAuthenticated: false });
    addToast(warning, "warning");
    setIsReady(true);
    if (firebaseAuth.currentUser) {
      void signOut(firebaseAuth).catch(() => undefined);
    }
  };

  const loadFirebaseProfile = useEffectEvent(async (user: User) => {
    const current = deviceIdentityRef.current;
    const mode = user.isAnonymous ? AuthMode.FirebaseAnonymous : AuthMode.EmailPassword;

    if (current.firebaseUid && current.firebaseUid !== user.uid) {
      const reset: DeviceIdentity = {
        version: 1,
        mode,
        username: null,
        mockId: null,
        firebaseUid: user.uid,
        isFallback: false,
      };
      removeDeviceValue(IDENTITY_KEY);
      persistIdentity(reset);
      setIdentity({ id: user.uid, username: null, mode, isFirebaseAuthenticated: true });
      setIsReady(true);
      addToast("The Firebase account changed. Local identity data was cleared.", "warning");
      return;
    }

    try {
      const profileSnapshot = await getDoc(doc(firestore, "users", user.uid));
      const storedUsername = profileSnapshot.exists() && typeof profileSnapshot.data().username === "string"
        ? profileSnapshot.data().username as string
        : null;
      const username = storedUsername ?? current.username;
      if (!profileSnapshot.exists() && username !== null) {
        await setDoc(doc(firestore, "users", user.uid), {
          uid: user.uid,
          username,
          authMode: mode,
          updatedAt: serverTimestamp(),
        });
      }
      const next: DeviceIdentity = {
        ...current,
        mode,
        username,
        firebaseUid: user.uid,
        isFallback: false,
      };
      persistIdentity(next);
      setIdentity({ id: user.uid, username, mode, isFirebaseAuthenticated: true });
      setIsReady(true);
    } catch (error) {
      await reportError("auth/profile-read", error);
      activateMockFallback(
        current.username,
        "Firebase could not load your profile. Mock mode is active temporarily; refresh and try again later.",
      );
    }
  });

  // Only one anonymous sign-in attempt runs at a time, since both the listener's
  // automatic retry and explicit callers (e.g. switchToAnonymous) can trigger one.
  const ensureAnonymousSession = async () => {
    if (anonymousSignInInFlight.current) return;
    anonymousSignInInFlight.current = true;
    try {
      await signInAnonymously(firebaseAuth);
    } catch (error) {
      await reportError("auth/anonymous-sign-in", error);
      activateMockFallback(deviceIdentityRef.current.username);
    } finally {
      anonymousSignInInFlight.current = false;
    }
  };

  useEffect(() => {
    const stored = readDeviceValue(IDENTITY_KEY);
    const initial = parseDeviceIdentity(stored?.value);
    deviceIdentityRef.current = initial;
    queueMicrotask(() => {
      setDeviceIdentity(initial);
      setStorageBackend(stored?.backend ?? null);
    });

    // Mock mode chosen by a developer stays put; mock mode entered as a Firebase
    // fallback retries anonymous auth below so it can self-heal on the next load.
    if (initial.mode === AuthMode.Mock && !initial.isFallback) {
      const mockId = initial.mockId ?? toMockId("developer");
      const next = { ...initial, mockId };
      deviceIdentityRef.current = next;
      queueMicrotask(() => {
        persistIdentity(next);
        setIdentity({
          id: mockId,
          username: initial.username,
          mode: AuthMode.Mock,
          isFirebaseAuthenticated: false,
        });
        setIsReady(true);
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      const current = deviceIdentityRef.current;
      if (user) {
        void loadFirebaseProfile(user);
        return;
      }

      if (current.mode === AuthMode.FirebaseAnonymous || (current.mode === AuthMode.Mock && current.isFallback)) {
        void ensureAnonymousSession();
        return;
      }

      if (current.mode === AuthMode.Mock) {
        const mockId = current.mockId ?? toMockId("developer");
        setIdentity({
          id: mockId,
          username: current.username,
          mode: AuthMode.Mock,
          isFirebaseAuthenticated: false,
        });
        setIsReady(true);
        return;
      }

      setIdentity(null);
      setIsReady(true);
    });

    return unsubscribe;
    // Runs once on mount to read the persisted identity and subscribe to auth state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveUsername = async (username: string) => {
    if (username.length === 0) {
      addToast("A username is required.", "warning");
      return false;
    }

    const current = deviceIdentityRef.current;
    if (current.mode === AuthMode.Mock || !firebaseAuth.currentUser) {
      const mockId = current.mockId ?? toMockId("developer");
      const next = { ...current, username, mockId };
      persistIdentity(next);
      setIdentity({ id: mockId, username, mode: AuthMode.Mock, isFirebaseAuthenticated: false });
      return true;
    }

    try {
      await setDoc(doc(firestore, "users", firebaseAuth.currentUser.uid), {
        uid: firebaseAuth.currentUser.uid,
        username,
        authMode: current.mode,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const next = { ...current, username, firebaseUid: firebaseAuth.currentUser.uid };
      persistIdentity(next);
      setIdentity({
        id: firebaseAuth.currentUser.uid,
        username,
        mode: current.mode,
        isFirebaseAuthenticated: true,
      });
      return true;
    } catch (error) {
      await reportError("auth/profile-write", error);
      activateMockFallback(
        username,
        "Firebase could not save your profile. Mock mode is active temporarily; refresh and try again later.",
      );
      return true;
    }
  };

  const switchToMock = async (developerId: string) => {
    const mockId = toMockId(developerId);
    const current = deviceIdentityRef.current;
    const next: DeviceIdentity = {
      version: 1,
      mode: AuthMode.Mock,
      username: current.username,
      mockId,
      firebaseUid: null,
      isFallback: false,
    };
    persistIdentity(next);
    setIdentity({ id: mockId, username: next.username, mode: AuthMode.Mock, isFirebaseAuthenticated: false });
    await signOut(firebaseAuth).catch(() => undefined);
    addToast(`Mock identity ${mockId} is active.`, "success");
  };

  const switchToAnonymous = async () => {
    const next: DeviceIdentity = {
      version: 1,
      mode: AuthMode.FirebaseAnonymous,
      username: null,
      mockId: null,
      firebaseUid: null,
      isFallback: false,
    };
    persistIdentity(next);
    setIdentity(null);
    setIsReady(false);
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      await reportError("auth/anonymous-sign-in", error);
    }
    await ensureAnonymousSession();
  };

  const prepareEmailMode = async () => {
    const next: DeviceIdentity = {
      version: 1,
      mode: AuthMode.EmailPassword,
      username: null,
      mockId: null,
      firebaseUid: null,
      isFallback: false,
    };
    persistIdentity(next);
    setIdentity(null);
    if (firebaseAuth.currentUser) await signOut(firebaseAuth);
  };

  const registerWithEmail = async (email: string, password: string) => {
    try {
      await prepareEmailMode();
      await createUserWithEmailAndPassword(firebaseAuth, email, password);
      addToast("Email account created.", "success");
      return true;
    } catch (error) {
      await reportError("auth/email-register", error);
      return false;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await prepareEmailMode();
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      addToast("Signed in with email.", "success");
      return true;
    } catch (error) {
      await reportError("auth/email-sign-in", error);
      return false;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      addToast("Password reset email sent.", "success");
      return true;
    } catch (error) {
      await reportError("auth/password-reset", error);
      return false;
    }
  };

  const signOutEmail = async () => {
    try {
      await signOut(firebaseAuth);
      const next = defaultDeviceIdentity();
      next.mode = AuthMode.EmailPassword;
      removeDeviceValue(IDENTITY_KEY);
      persistIdentity(next);
      setIdentity(null);
    } catch (error) {
      await reportError("auth/email-sign-out", error);
    }
  };

  const value: IdentityContextValue = {
    identity,
    deviceIdentity,
    isReady,
    storageBackend,
    saveUsername,
    switchToMock,
    switchToAnonymous,
    registerWithEmail,
    signInWithEmail,
    resetPassword,
    signOutEmail,
    showToast: addToast,
  };

  return (
    <IdentityContext value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div className="app-toast" data-tone={toast.tone} key={toast.id}>{toast.message}</div>
        ))}
      </div>
    </IdentityContext>
  );
};

export const useIdentity = () => {
  const context = use(IdentityContext);
  if (!context) throw new Error("useIdentity must be used inside IdentityProvider.");
  return context;
};