import { useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function AuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  const user = useQuery(api.auth.getCurrentUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Could not sign in.");
      return;
    }
    window.location.hash = "#/";
  }

  return (
    <section className="grid max-w-[26rem] gap-4" aria-labelledby="auth-title">
      <h1 id="auth-title" className="m-0 text-2xl font-semibold">
        {mode === "sign-in" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="m-0 text-sm text-muted-foreground">
          {user ? `Signed in as ${user.email ?? user.name}` : "Email and a password. The board stays public."}
      </p>
      <div className="flex gap-2" role="tablist" aria-label="Account action">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-in"}
          className={tabClass(mode === "sign-in")}
          onClick={() => {
            window.location.hash = "#/auth";
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-up"}
          className={tabClass(mode === "sign-up")}
          onClick={() => {
            window.location.hash = "#/auth?mode=sign-up";
          }}
        >
          Create account
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4">
        {mode === "sign-up" && (
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error && <p className="m-0 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Working…" : mode === "sign-in" ? "Continue with email" : "Create account"}
        </Button>
      </form>
    </section>
  );
}

function tabClass(active: boolean) {
  return cn(
    "cursor-pointer rounded-full border bg-surface px-3.5 py-2 text-sm",
    active ? "border-accent text-foreground" : "border-border-strong text-muted-foreground hover:text-foreground",
  );
}
