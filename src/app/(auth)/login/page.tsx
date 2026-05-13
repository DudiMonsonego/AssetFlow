import Link from "next/link";
import { Zap } from "lucide-react";
import { LoginForm } from "./login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Sign in to AssetFlow
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hardware Lifecycle Management
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <LoginForm />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            Create organization
          </Link>
        </p>
      </div>
    </div>
  );
}
