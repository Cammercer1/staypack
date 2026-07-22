"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { setPasswordSchema } from "@/lib/validation/schemas";

type SetPasswordForm = {
  password: string;
  confirmPassword: string;
};

type InviteState = "checking" | "ready" | "invalid";

export function InviteSetupForm() {
  const router = useRouter();
  const [inviteState, setInviteState] = useState<InviteState>("checking");
  const [loading, setLoading] = useState(false);
  const form = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    let active = true;

    async function establishInviteSession() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const errorDescription = hash.get("error_description");
      const supabase = createClient();

      if (errorDescription) {
        if (active) setInviteState("invalid");
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (active) setInviteState("invalid");
          return;
        }

        window.history.replaceState(null, "", window.location.pathname);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active) setInviteState(user ? "ready" : "invalid");
    }

    void establishInviteSession();

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: SetPasswordForm) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Password set. Welcome to StayPack.");
    router.push("/dashboard");
    router.refresh();
  }

  if (inviteState === "checking") {
    return (
      <div className="surface-card p-8">
        <h2 className="font-display text-3xl tracking-tight">Checking invitation</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          One moment while we securely open your account.
        </p>
      </div>
    );
  }

  if (inviteState === "invalid") {
    return (
      <div className="surface-card p-8">
        <h2 className="font-display text-3xl tracking-tight">Invitation expired</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This invitation is invalid or has expired. Ask your StayPack administrator
          for a fresh invitation.
        </p>
        <Button
          render={<Link href="/login" />}
          className="mt-6 w-full"
          size="lg"
        >
          Return to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="surface-card p-8">
      <div className="mb-8 space-y-2">
        <h2 className="font-display text-3xl tracking-tight">Finish your account</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose a password to access your agency workspace.
        </p>
      </div>
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Setting password..." : "Set password and continue"}
        </Button>
      </form>
    </div>
  );
}
