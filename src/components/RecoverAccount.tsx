import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RecoveryKeyPanel } from "@/components/RecoveryKeyPanel";
import { authPost } from "@/lib/auth-client";

export function RecoverAccount() {
  const auth = useConvexAuth();
  const [username, setUsername] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [password, setPassword] = useState("");
  const [issued, setIssued] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    if (auth.isAuthenticated) {
      window.location.hash = "#/";
      return;
    }
    const timer = window.setTimeout(() => setWaiting(false), 8000);
    return () => window.clearTimeout(timer);
  }, [waiting, auth.isAuthenticated]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await authPost<{ recoveryKey: string }>("/kura/recover", {
        username,
        recoveryKey,
        newPassword: password,
      });
      setIssued(result.recoveryKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not recover that account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid max-w-[26rem] gap-4" aria-labelledby="recover-title">
      <h1 id="recover-title" className="m-0 text-2xl font-semibold">
        Use a recovery key
      </h1>
      <p className="m-0 text-sm text-muted-foreground">
        This sets a new password, signs out every other session, and removes saved passkeys. You get a new recovery key.
      </p>
      {issued ? (
        <RecoveryKeyPanel recoveryKey={issued} onDone={() => setWaiting(true)} />
      ) : (
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="recover-username">Username</Label>
            <Input id="recover-username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="recover-key">Recovery key</Label>
            <Input
              id="recover-key"
              value={recoveryKey}
              onChange={(event) => setRecoveryKey(event.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="recover-password">New password</Label>
            <Input
              id="recover-password"
              type="password"
              minLength={15}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {error && (
            <p className="m-0 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Working…" : "Recover account"}
          </Button>
        </form>
      )}
    </section>
  );
}
