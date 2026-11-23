import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · GraceGuard" },
      { name: "description", content: "Set a new password for your GraceGuard account." },
      { property: "og:title", content: "Reset password · GraceGuard" },
      { property: "og:description", content: "Set a new password for your protected response workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [validLink, setValidLink] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery";
    setValidLink(recovery);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!validLink) {
      setError("This reset link is missing or expired. Request a new one from sign in.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Password updated. Returning to your workspace…");
    await navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5 py-10">
      <div className="w-full max-w-md border-y border-border bg-background px-6 py-7 sm:px-8">
        <div className="mb-6 flex items-center justify-between"><Link to="/" className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-5 w-5 text-primary" /> GraceGuard</Link><Button asChild variant="ghost" size="sm"><Link to="/auth"><ArrowLeft /> Sign in</Link></Button></div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Account security</p>
        <h1 className="font-serif text-3xl">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a new password for your account.</p>
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          {!validLink && <p className="text-sm text-warning-foreground">Open a valid reset link to continue.</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {message && <p className="text-sm text-success" role="status">{message}</p>}
          <Button className="w-full" disabled={busy || !validLink}>{busy ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />} Update password</Button>
        </form>
      </div>
    </main>
  );
}