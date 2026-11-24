import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCloudAuth } from "@/lib/auth-context";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · GraceGuard" },
      { name: "description", content: "Sign in to save and access private GraceGuard incident records." },
      { property: "og:title", content: "Sign in · GraceGuard" },
      { property: "og:description", content: "Secure sign-in for your church's crisis-response workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "signIn" | "signUp" | "recovery";

function AuthPage() {
  const navigate = useNavigate();
  const { session, ready } = useCloudAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "recovery") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage("If that address is registered, a password reset link is on its way.");
      } else if (mode === "signUp") {
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signupError) throw signupError;
        if (data.session) await navigate({ to: "/" });
        else setMessage("Check your email to confirm your account before signing in.");
      } else {
        const { error: signinError } = await supabase.auth.signInWithPassword({ email, password });
        if (signinError) throw signinError;
        await navigate({ to: "/" });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function socialSignIn(provider: "google" | "lovable") {
    setError("");
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await navigate({ to: "/" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (ready && session) {
    return <AuthShell><div className="space-y-4 text-center"><p className="font-medium">You are signed in.</p><Button asChild><Link to="/">Return to GraceGuard</Link></Button></div></AuthShell>;
  }

  const heading = mode === "signUp" ? "Create your secure account" : mode === "recovery" ? "Reset your password" : "Sign in to GraceGuard";
  return (
    <AuthShell>
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Protected workspace</p>
        <h1 className="font-serif text-3xl">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to save church profiles, private incidents, and counseling records.</p>
      </div>
      {mode !== "recovery" && (
        <div className="space-y-3">
          <Button type="button" variant="outline" className="w-full bg-background" onClick={() => void socialSignIn("google")} disabled={busy}>
            <GoogleMark /> Continue with Google
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => void socialSignIn("lovable")} disabled={busy}>
            <LovableMark /> Continue with Lovable
          </Button>
          <div className="flex items-center gap-3 py-2"><span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">or use email</span><span className="h-px flex-1 bg-border" /></div>
        </div>
      )}
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@church.org" /></div>
        {mode !== "recovery" && <div className="space-y-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" autoComplete={mode === "signUp" ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>}
        {error && <p className="border-l-2 border-destructive px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        {message && <p className="border-l-2 border-primary px-3 py-2 text-sm text-muted-foreground" role="status">{message}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : mode === "recovery" ? <Mail /> : <LockKeyhole />}
          {mode === "signUp" ? "Create account" : mode === "recovery" ? "Send reset link" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
        {mode === "signIn" && <Button variant="link" className="h-auto p-0" onClick={() => { setMode("recovery"); setError(""); setMessage(""); }}>Forgot password?</Button>}
        {mode === "recovery" ? <Button variant="link" className="h-auto p-0" onClick={() => { setMode("signIn"); setError(""); setMessage(""); }}>Back to sign in</Button> : <Button variant="link" className="h-auto p-0" onClick={() => { setMode(mode === "signUp" ? "signIn" : "signUp"); setError(""); setMessage(""); }}>{mode === "signUp" ? "Already have an account? Sign in" : "Create an account"}</Button>}
      </div>
      <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Only signed-in account holders can access saved records. Demo scenarios are fictional and available without an account.</p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-5 w-5 text-primary" /> GraceGuard</Link>
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Back to demo</Link></Button>
        </div>
        <div className="border-y border-border bg-background px-6 py-7 sm:px-8">{children}</div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}