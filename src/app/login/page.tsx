"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";

function RequestedNotice() {
  const requested = useSearchParams().get("requested");
  if (!requested) return null;
  return (
    <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
      Request sent. An admin needs to approve your account before you can log in.
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back to the table."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <Suspense>
        <RequestedNotice />
      </Suspense>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input px-3 py-2.5 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input px-3 py-2.5 font-normal"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary px-4 py-2.5">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
