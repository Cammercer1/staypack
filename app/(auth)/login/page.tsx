import { LoginForm } from "@/components/forms/LoginForm";
import { AuthLayout } from "@/components/app-shell/AuthLayout";
import { Suspense } from "react";
import { AuthEntry } from "@/components/forms/AuthEntry";

export default function LoginPage() {
  return (
    <AuthLayout
      highlight="Branded"
      title="reports for every listing."
      description="Create polished short-term rental potential reports your agency can share in sales packs, open homes and buyer follow-up."
    >
      <Suspense fallback={<LoginForm pending />}><AuthEntry mode="login" /></Suspense>
    </AuthLayout>
  );
}
