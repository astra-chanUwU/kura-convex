import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RecoveryKeyPanel } from "@/components/RecoveryKeyPanel";
import { authClient, authGet, authPost, passkeysSupported } from "@/lib/auth-client";

type Security = {
  username: string | null;
  hasPassword: boolean;
  hasRecoveryKey: boolean;
  recoveryKeyCreatedAt: number | null;
  passkeys: { id: string; name: string; createdAt: number | null }[];
};

export function AccountSecurity() {
  const [security, setSecurity] = useState<Security | null>(null);
  const [password, setPassword] = useState("");
  const [issued, setIssued] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setSecurity(await authGet<Security>("/kura/security"));
  }, []);
  const started = useRef(false);
  if (!started.current) {
    started.current = true;
    void load().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Could not load sign-in methods.");
    });
  }

  async function run(action: () => Promise<void>, message: string) {
    setError("");
    setNotice("");
    setPending(true);
    try {
      await action();
      await load();
      setNotice(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not do that.");
    } finally {
      setPending(false);
    }
  }

  if (!security) {
    return <p className="text-sm text-muted-foreground">{error || "Loading sign-in methods…"}</p>;
  }

  return (
    <div className="grid gap-4">
      <h2 className="m-0 text-lg font-semibold">Sign-in & security</h2>
      {security.username && <p className="m-0 text-sm text-muted-foreground">{`@${security.username}`}</p>}
      {issued ? (
        <RecoveryKeyPanel recoveryKey={issued} onDone={() => setIssued("")} />
      ) : (
        <>
          <section className="grid gap-3 rounded-xl border border-border bg-surface p-4">
            <h3 className="m-0 text-base font-semibold">Passkeys{security.passkeys.length > 0 ? "" : " (recommended)"}</h3>
            {security.passkeys.length === 0 && (
              <p className="m-0 text-sm text-muted-foreground">Sign in with your face, fingerprint, or device PIN.</p>
            )}
            {security.passkeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {key.name}
                  {key.createdAt ? (
                    <span className="text-muted-foreground"> · added {new Date(key.createdAt).toLocaleDateString()}</span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void run(async () => {
                      const result = await authClient.passkey.deletePasskey({ id: key.id });
                      if (result.error) throw new Error(result.error.message || "Could not remove that passkey.");
                    }, "Passkey removed.")
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              className="w-fit"
              disabled={pending || !passkeysSupported()}
              onClick={() =>
                void run(async () => {
                  const result = await authClient.passkey.addPasskey({ name: "Passkey" });
                  if (result.error) throw new Error(result.error.message || "Could not add a passkey.");
                }, "Passkey added.")
              }
            >
              Add a passkey
            </Button>
          </section>
          <section className="grid gap-3 rounded-xl border border-border bg-surface p-4">
            <h3 className="m-0 text-base font-semibold">Password</h3>
            <p className="m-0 text-sm text-muted-foreground">
              {security.hasPassword
                ? "You have a password. Passkeys and passwords work interchangeably."
                : "No password set. You sign in with a passkey."}
            </p>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const next = password;
                setPassword("");
                void run(async () => {
                  await authPost("/kura/password", { password: next });
                }, "Password saved.");
              }}
            >
              <Label htmlFor="new-password">{security.hasPassword ? "Change password" : "Set password"}</Label>
              <Input
                id="new-password"
                type="password"
                minLength={15}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                placeholder="15+ characters"
              />
              <Button type="submit" disabled={pending} className="w-fit">
                {security.hasPassword ? "Change password" : "Set password"}
              </Button>
            </form>
            {security.hasPassword && (
              <Button
                type="button"
                className="w-fit"
                disabled={pending}
                onClick={() => void run(() => authPost("/kura/password/remove"), "Password removed.")}
              >
                Remove password
              </Button>
            )}
            <p className="m-0 text-sm text-muted-foreground">Kura keeps at least one way for you to sign in.</p>
          </section>
          <section className="grid gap-3 rounded-xl border border-border bg-surface p-4">
            <h3 className="m-0 text-base font-semibold">Recovery key</h3>
            <p className="m-0 text-sm text-muted-foreground">
              {security.hasRecoveryKey
                ? `You have a recovery key${
                    security.recoveryKeyCreatedAt
                      ? ` from ${new Date(security.recoveryKeyCreatedAt).toLocaleDateString()}`
                      : ""
                  }. It is the only way back in if you lose your password and passkeys.`
                : "Without a recovery key, losing your password and passkeys means losing the account."}
            </p>
            <Button
              type="button"
              className="w-fit"
              disabled={pending}
              onClick={() => {
                setError("");
                setPending(true);
                void authPost<{ recoveryKey: string }>("/kura/recovery-key")
                  .then((result) => {
                    setIssued(result.recoveryKey);
                    return load();
                  })
                  .catch((caught) => {
                    setError(caught instanceof Error ? caught.message : "Could not make a recovery key.");
                  })
                  .finally(() => setPending(false));
              }}
            >
              {security.hasRecoveryKey ? "Make a new key (the old one stops working)" : "Create a recovery key"}
            </Button>
          </section>
        </>
      )}
      {notice && <p className="m-0 text-sm text-accent-soft">{notice}</p>}
      {error && (
        <p className="m-0 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="w-fit cursor-pointer border-0 bg-transparent p-0 text-sm text-danger"
        onClick={() => {
          void authClient.signOut().then(() => {
            window.location.hash = "#/";
          });
        }}
      >
        Sign out
      </button>
    </div>
  );
}
