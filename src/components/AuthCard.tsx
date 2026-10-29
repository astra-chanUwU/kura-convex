import { useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function AuthCard() {
  const user = useQuery(api.auth.getCurrentUser);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
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
    <div className="grid min-h-full place-items-center px-4 py-16">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-center text-2xl font-semibold">
          {mode === "sign-in" ? "Sign in to Kura" : "Create your account"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {user ? `Signed in as ${user.email ?? user.name}` : "Email and password, through Better Auth."}
        </p>
        {mode === "sign-up" && (
          <div className="mt-5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required className="mt-1" />
          </div>
        )}
        <div className="mt-4">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@example.com"
            className="mt-1"
          />
        </div>
        <div className="mt-4">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="mt-1"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <Button type="submit" disabled={pending} className="mt-5 h-10 w-full">
          {pending ? "Working…" : mode === "sign-in" ? "Continue with email" : "Create account"}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "sign-in" ? "Need an account?" : "Already have one?"}{" "}
          <button
            type="button"
            className="text-[#e48ab8]"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          >
            {mode === "sign-in" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
