import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RecoveryKeyPanel } from "@/components/RecoveryKeyPanel";
import { authClient, authPost, passkeysSupported } from "@/lib/auth-client";
import { accountEmail, normalizeUsername } from "../../shared/username";
import { cn } from "@/lib/utils";

type Method = "passkey" | "password";

export function AuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  const auth = useConvexAuth();
  const [method, setMethod] = useState<Method>("passkey");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const supported = passkeysSupported();
  const isRegister = mode === "sign-up";

  useEffect(() => {
    if (!waiting || recoveryKey) return;
    if (auth.isAuthenticated) {
      window.location.hash = "#/";
      return;
    }
    const timer = window.setTimeout(() => {
      setWaiting(false);
      setError("That account was accepted, but Kura did not start a session. Try signing in again.");
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [waiting, auth.isAuthenticated, recoveryKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const name = normalizeUsername(username);
    if ((isRegister || method === "password") && !name) {
      setError("Usernames use 3–24 lowercase letters, numbers or underscores.");
      return;
    }
    setPending(true);
    try {
      if (method === "passkey") {
        const result = isRegister
          ? await authClient.passkey.addPasskey({
              name: "Passkey",
              context: JSON.stringify({ username: name, displayName: displayName.trim() }),
            })
          : await authClient.signIn.passkey();
        if (result.error) throw new Error(result.error.message || "Could not use that passkey.");
      } else if (isRegister && name) {
        const result = await authClient.signUp.email({
          name: displayName.trim() || name,
          email: accountEmail(name),
          password,
          username: name,
        });
        if (result.error) throw new Error(result.error.message || "Could not create that account.");
      } else if (name) {
        const result = await authClient.signIn.username({ username: name, password });
        if (result.error) throw new Error(result.error.message || "Could not sign in.");
      }
      if (isRegister) {
        const issued = await authPost<{ recoveryKey: string }>("/kura/recovery-key");
        setRecoveryKey(issued.recoveryKey);
        setWaiting(true);
        return;
      }
      setWaiting(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  if (recoveryKey) {
    return (
      <section className="grid max-w-[26rem] gap-4" aria-labelledby="auth-title">
        <h1 id="auth-title" className="m-0 text-2xl font-semibold">
          Account created
        </h1>
        <RecoveryKeyPanel
          recoveryKey={recoveryKey}
          onDone={() => {
            if (auth.isAuthenticated) window.location.hash = "#/";
            else setWaiting(true);
          }}
        />
      </section>
    );
  }

  return (
    <section className="grid max-w-[26rem] gap-4" aria-labelledby="auth-title">
      <h1 id="auth-title" className="m-0 text-2xl font-semibold">
        {isRegister ? "Create your account" : "Welcome back"}
      </h1>
      <p className="m-0 text-sm text-muted-foreground">
        {isRegister
          ? "Pick how you'd like to sign in. You can add the other later."
          : "Use your passkey or password, whichever you set up. The board stays public."}
      </p>
      <div className="flex gap-2" role="tablist" aria-label="Sign-in method">
        <button type="button" role="tab" aria-selected={method === "passkey"} className={tabClass(method === "passkey")} onClick={() => setMethod("passkey")}>
          Passkey{supported ? "" : " (not supported here)"}
        </button>
        <button type="button" role="tab" aria-selected={method === "password"} className={tabClass(method === "password")} onClick={() => setMethod("password")}>
          Password
        </button>
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        {method === "passkey"
          ? isRegister
            ? "Your device keeps the key. There is no password to remember."
            : "No username needed. Pick the saved passkey for this site."
          : isRegister
            ? "15 or more characters. A short sentence works well."
            : "The username you chose when you created the account."}
      </p>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4">
        {(isRegister || method === "password") && (
          <div className="grid gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username webauthn"
              required
              placeholder="astro_chan"
            />
          </div>
        )}
        {isRegister && (
          <div className="grid gap-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              placeholder="How people see you"
            />
          </div>
        )}
        {method === "password" && (
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              minLength={isRegister ? 15 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password webauthn"}
              required
              placeholder={isRegister ? "15+ characters" : undefined}
            />
          </div>
        )}
        {error && (
          <p className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || waiting || (method === "passkey" && !supported)} className="w-fit">
          {pending || waiting
            ? "Working…"
            : method === "passkey"
              ? isRegister
                ? "Create account with passkey"
                : "Sign in with passkey"
              : isRegister
                ? "Create account"
                : "Sign in"}
        </Button>
      </form>
      {!isRegister && (
        <p className="m-0 text-sm text-muted-foreground">
          Lost your password and passkeys? <a href="#/recover" className="text-accent">Use a recovery key</a>
        </p>
      )}
    </section>
  );
}

function tabClass(active: boolean) {
  return cn(
    "cursor-pointer rounded-full border bg-surface px-3.5 py-2 text-sm",
    active ? "border-accent text-foreground" : "border-border-strong text-muted-foreground hover:text-foreground",
  );
}
