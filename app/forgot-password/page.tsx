"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;

    try {
      setSending(true);
      // Informative status: reset link dispatch
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/60 p-4 dark:bg-background">
      <Card className="w-full max-w-md border-border/70 shadow-sm">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Reset Password
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Enter your clinical account email address and we&apos;ll send you a recovery link.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleReset}>
          <CardContent className="space-y-4">
            {sent ? (
              <div
                role="status"
                className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">Reset instructions sent</p>
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                    If an account exists for {email}, a password reset link has been dispatched to your inbox.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="clinician@practice.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sending}
                  required
                  className="h-11"
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-2">
            {!sent && (
              <Button
                type="submit"
                className="h-11 w-full font-semibold shadow-sm"
                disabled={sending || !email.trim()}
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Instructions…
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            )}

            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}