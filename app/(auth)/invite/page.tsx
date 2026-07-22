import { AuthLayout } from "@/components/app-shell/AuthLayout";
import { InviteSetupForm } from "@/components/forms/InviteSetupForm";

export default function InvitePage() {
  return (
    <AuthLayout
      highlight="Your"
      title="agency workspace is ready."
      description="Set up your account and start creating polished, on-brand property reports."
    >
      <InviteSetupForm />
    </AuthLayout>
  );
}
