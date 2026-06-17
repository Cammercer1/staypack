"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function acceptInvite() {
    setLoading(true);
    const response = await fetch("/api/team/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to accept invitation");
      setLoading(false);
      return;
    }

    toast.success("You joined the agency");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Button type="button" size="lg" onClick={acceptInvite} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          Joining...
        </>
      ) : (
        <>
          <UserCheck className="h-4 w-4" />
          Accept invitation
        </>
      )}
    </Button>
  );
}
