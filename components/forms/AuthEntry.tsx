"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeAuthRedirect } from "@/lib/auth/redirectPath";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

/** URL/session-dependent navigation does not block the static sign-in form. */
export function AuthEntry({ mode }: { mode: "login" | "signup" }) {
  const query = useSearchParams();
  const router = useRouter();
  const next = safeAuthRedirect(query.get("next") ?? query.get("redirectTo"));
  useEffect(() => {
    let active = true;
    // This is only a navigation hint. Protected pages and APIs verify the user
    // and current agency membership on the server before returning private data.
    void createClient().auth.getSession().then(({ data }) => {
      if (active && data.session) router.replace(next);
    }).catch(() => {});
    return () => { active = false; };
  }, [next, router]);
  return mode === "login" ? <LoginForm nextPath={next} /> : <SignupForm nextPath={next} />;
}
