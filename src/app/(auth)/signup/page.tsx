import Link from "next/link";
import { Zap } from "lucide-react";
import { SignupForm } from "./signup-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create Organization" };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Create your organization
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start your 14-day free trial — no credit card required.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <SignupForm />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
