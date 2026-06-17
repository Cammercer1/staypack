import { SignupForm } from "@/components/forms/SignupForm";
import { AuthLayout } from "@/components/app-shell/AuthLayout";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthLayout
      highlight="Expert"
      title="Short-term rental reports built for agencies."
      description="Sign up to configure your agency branding, generate buyer-facing reports, and publish shareable links in minutes."
    >
      <SignupForm nextPath={next} />
    </AuthLayout>
  );
}
