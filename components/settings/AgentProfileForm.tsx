"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agentProfileSchema, type AgentProfileInput } from "@/lib/validation/schemas";
import type { AgentProfile } from "@/lib/types";

export function AgentProfileForm({
  initial,
  onSaved,
}: {
  initial?: AgentProfile;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm<AgentProfileInput>({
    resolver: zodResolver(agentProfileSchema),
    defaultValues: {
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      role_title: initial?.role_title ?? "",
      photo_url: initial?.photo_url ?? "",
      is_default: initial?.is_default ?? false,
    },
  });

  async function onSubmit(values: AgentProfileInput) {
    setLoading(true);
    const response = await fetch("/api/agents", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial ? { id: initial.id, ...values } : values),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to save agent");
      setLoading(false);
      return;
    }

    toast.success("Agent saved");
    onSaved();
    setLoading(false);
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role_title">Role title</Label>
        <Input id="role_title" {...form.register("role_title")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...form.register("email")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" {...form.register("phone")} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="photo_url">Photo URL</Label>
        <Input id="photo_url" {...form.register("photo_url")} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <input id="is_default" type="checkbox" {...form.register("is_default")} />
        <Label htmlFor="is_default">Default agent</Label>
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : initial ? "Update agent" : "Add agent"}
        </Button>
      </div>
    </form>
  );
}
