import { OnboardingForm } from "@/components/forms/OnboardingForm";
import { PageHeader } from "@/components/app-shell/PageHeader";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <PageHeader
        eyebrow="Onboarding"
        highlight="Set up"
        title="your agency profile."
        description="Add your branding and defaults once. Every STR potential report you create will inherit this look and feel."
      />
      <OnboardingForm />
    </div>
  );
}
