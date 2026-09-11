export const AuthMode = {
  Mock: "mock",
  FirebaseAnonymous: "firebase-anonymous",
  EmailPassword: "email-password",
} as const;

export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

export type DeviceIdentity = {
  version: 1;
  mode: AuthMode;
  username: string | null;
  mockId: string | null;
  firebaseUid: string | null;
  // True when mock mode was entered automatically after a Firebase failure, rather than chosen by a developer.
  isFallback: boolean;
};

export type ActiveIdentity = {
  id: string;
  username: string | null;
  mode: AuthMode;
  isFirebaseAuthenticated: boolean;
};