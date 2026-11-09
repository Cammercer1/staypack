import { SignupForm } from "@/components/forms/SignupForm";
import { AuthLayout } from "@/components/app-shell/AuthLayout";
import { Suspense } from "react";
import { AuthEntry } from "@/components/forms/AuthEntry";

export default function SignupPage() {
  return (
    <AuthLayout
      highlight="Expert"
      title="Short-term rental reports built for agencies."
      description="Sign up to configure your agency branding, generate buyer-facing reports, and publish shareable links in minutes."
    >
      <Suspense fallback={<SignupForm />}><AuthEntry mode="signup" /></Suspense>
    </AuthLayout>
  );
}
