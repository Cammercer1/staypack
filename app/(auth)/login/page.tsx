import { LoginForm } from "@/components/forms/LoginForm";
import { AuthLayout } from "@/components/app-shell/AuthLayout";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthLayout
      highlight="Branded"
      title="reports for every listing."
      description="Create polished short-term rental potential reports your agency can share in sales packs, open homes and buyer follow-up."
    >
      <LoginForm nextPath={next} />
    </AuthLayout>
  );
}
