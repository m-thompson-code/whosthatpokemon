"use client";

import {
  ArrowLeft,
  AtSign,
  Bug,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { AuthMode } from "@/lib/auth/types";
import { useIdentity } from "@/features/auth/identity-provider";

export const UsernameForm = ({
  onboarding = false,
  onSaved,
}: {
  onboarding?: boolean;
  onSaved?: () => void;
}) => {
  const { identity, saveUsername } = useIdentity();
  const [username, setUsername] = useState(identity?.username ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    const saved = await saveUsername(username);
    setIsSaving(false);
    if (saved) onSaved?.();
  };

  return (
    <form className="identity-form" onSubmit={submit}>
      <label>
        Username
        <input
          autoFocus={onboarding}
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Trainer name"
          required
          value={username}
        />
      </label>
      <button className="primary-button" disabled={isSaving} type="submit">
        {isSaving ? <LoaderCircle className="spin" aria-hidden="true" /> : <UserRound aria-hidden="true" />}
        {isSaving ? "Saving..." : onboarding ? "Continue" : "Save username"}
      </button>
    </form>
  );
};

export const EmailAuthForms = () => {
  const {
    identity,
    registerWithEmail,
    resetPassword,
    signInWithEmail,
    signOutEmail,
  } = useIdentity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const run = async (operation: "sign-in" | "register" | "reset") => {
    setIsWorking(true);
    if (operation === "sign-in") await signInWithEmail(email, password);
    if (operation === "register") await registerWithEmail(email, password);
    if (operation === "reset") await resetPassword(email);
    setIsWorking(false);
  };

  if (identity?.mode === AuthMode.EmailPassword && identity.isFirebaseAuthenticated) {
    return (
      <button className="settings-command" onClick={signOutEmail} type="button">
        <LogOut aria-hidden="true" size={18} /> Sign out of email account
      </button>
    );
  }

  return (
    <div className="email-auth-forms">
      <label>
        Email
        <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      </label>
      <label>
        Password
        <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
      </label>
      <div className="email-auth-actions">
        <button disabled={isWorking || !email || !password} onClick={() => run("sign-in")} type="button">
          <LogIn aria-hidden="true" size={17} /> Sign in
        </button>
        <button disabled={isWorking || !email || !password} onClick={() => run("register")} type="button">
          <AtSign aria-hidden="true" size={17} /> Create account
        </button>
        <button disabled={isWorking || !email} onClick={() => run("reset")} type="button">
          <KeyRound aria-hidden="true" size={17} /> Reset password
        </button>
      </div>
    </div>
  );
};

export const DeveloperSettings = () => {
  const {
    deviceIdentity,
    identity,
    storageBackend,
    switchToAnonymous,
    switchToMock,
  } = useIdentity();
  const [developerId, setDeveloperId] = useState(
    deviceIdentity.mockId?.replace(/^moo-/, "") ?? "developer",
  );

  return (
    <details className="developer-settings">
      <summary><Bug aria-hidden="true" size={18} /> Developer Mode</summary>
      <div className="developer-settings-body">
        <dl className="debug-grid">
          <div><dt>Mode</dt><dd>{identity?.mode ?? deviceIdentity.mode}</dd></div>
          <div><dt>Identity ID</dt><dd>{identity?.id ?? "Not authenticated"}</dd></div>
          <div><dt>Firebase UID</dt><dd>{deviceIdentity.firebaseUid ?? "None"}</dd></div>
          <div><dt>Storage</dt><dd>{storageBackend ?? "Not written"}</dd></div>
          <div><dt>Firebase auth</dt><dd>{identity?.isFirebaseAuthenticated ? "Connected" : "Disconnected"}</dd></div>
        </dl>

        <div className="auth-mode-block">
          <h3>Mock identity</h3>
          <label>
            Developer ID
            <div className="prefixed-input"><span>moo-</span><input onChange={(event) => setDeveloperId(event.target.value)} value={developerId} /></div>
          </label>
          <button className="settings-command" onClick={() => switchToMock(developerId)} type="button">Use mock identity</button>
        </div>

        <div className="auth-mode-block">
          <h3>Firebase anonymous</h3>
          <button className="settings-command" onClick={switchToAnonymous} type="button">Create a new anonymous identity</button>
        </div>

        <div className="auth-mode-block">
          <h3>Email and password</h3>
          <p>Signing in abandons the current anonymous account.</p>
          <EmailAuthForms />
        </div>
      </div>
    </details>
  );
};

const IDENTITY_ROUTES = new Set(["/welcome", "/settings"]);

// Gates every route behind identity readiness so pages never render, then
// flicker into a redirect once the identity provider settles.
export const AppGate = ({ children }: { children: ReactNode }) => {
  const { deviceIdentity, identity, isReady } = useIdentity();
  const pathname = usePathname();
  const router = useRouter();
  const needsUsername = isReady && identity !== null && identity.username === null;
  const needsEmailAuth = isReady && identity === null && deviceIdentity.mode === AuthMode.EmailPassword;
  const isIdentityRoute = IDENTITY_ROUTES.has(pathname);

  useEffect(() => {
    if (needsUsername && pathname !== "/welcome") {
      router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (needsEmailAuth && pathname !== "/settings") {
      router.replace(`/settings?next=${encodeURIComponent(pathname)}`);
    }
  }, [needsEmailAuth, needsUsername, pathname, router]);

  if (!isIdentityRoute && (!isReady || needsUsername || needsEmailAuth)) {
    return (
      <main className="app-loading-shell" role="status">
        <LoaderCircle className="spin" aria-hidden="true" />
        <span>Preparing your identity...</span>
      </main>
    );
  }

  return (
    <>
      {children}
      {!isIdentityRoute && (
        <Link aria-label="Open settings" className="settings-trigger" href="/settings" title="Settings">
          <Settings aria-hidden="true" />
        </Link>
      )}
    </>
  );
};

export const WelcomePageContent = ({ nextPath }: { nextPath: string }) => {
  const router = useRouter();
  const { identity, isReady } = useIdentity();

  useEffect(() => {
    if (isReady && identity?.username) router.replace(nextPath);
  }, [identity?.username, isReady, nextPath, router]);

  return (
    <main className="identity-page-shell">
      <section className="identity-page-panel">
        <div className="identity-page-icon"><UserRound aria-hidden="true" /></div>
        <p className="eyebrow">First visit</p>
        <h1>Choose your username</h1>
        <p>This name follows you into rooms and can be changed later in Settings.</p>
        {isReady && identity ? (
          <UsernameForm onboarding onSaved={() => router.replace(nextPath)} />
        ) : (
          <p className="identity-loading"><LoaderCircle className="spin" aria-hidden="true" /> Preparing your identity...</p>
        )}
      </section>
    </main>
  );
};

export const SettingsPageContent = () => {
  const { deviceIdentity, identity, isReady, switchToAnonymous } = useIdentity();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogOut = async () => {
    setIsLoggingOut(true);
    await switchToAnonymous();
    setIsLoggingOut(false);
  };

  return (
    <main className="identity-page-shell settings-page-shell">
      <section className="identity-page-panel settings-page-panel">
        <Link className="back-link" href="/"><ArrowLeft size={18} /> Back home</Link>
        <p className="eyebrow">Account and device</p>
        <h1>Settings</h1>
        {!isReady ? (
          <p className="identity-loading"><LoaderCircle className="spin" aria-hidden="true" /> Preparing your identity...</p>
        ) : identity ? (
          <>
            <UsernameForm />
            <div className="identity-summary">
              <span>{identity.mode}</span>
              <code>{identity.id}</code>
            </div>
            <button className="settings-command" disabled={isLoggingOut} onClick={handleLogOut} type="button">
              {isLoggingOut ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : <LogOut aria-hidden="true" size={18} />}
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </>
        ) : deviceIdentity.mode === AuthMode.EmailPassword ? (
          <div className="email-auth-required">
            <h2>Email authentication required</h2>
            <p>Sign in, create an account, or switch modes below.</p>
          </div>
        ) : null}
        <DeveloperSettings />
      </section>
    </main>
  );
};