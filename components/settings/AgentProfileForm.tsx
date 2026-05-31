"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentPhotoUploader } from "@/components/settings/AgentPhotoUploader";
import { agentProfileSchema, type AgentProfileInput } from "@/lib/validation/schemas";
import type { AgentProfile } from "@/lib/types";

const EMPTY_VALUES: AgentProfileInput = {
  name: "",
  email: "",
  phone: "",
  role_title: "",
  photo_url: "",
  is_default: false,
};

export function AgentProfileForm({
  initial,
  onSaved,
  fieldIdPrefix,
}: {
  initial?: AgentProfile;
  onSaved: () => void;
  fieldIdPrefix?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fieldPrefix = fieldIdPrefix ?? initial?.id ?? "new-agent";
  const fieldId = (name: string) => `${fieldPrefix}-${name}`;

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

  const displayName = form.watch("name");
  const photoUrl = form.watch("photo_url");

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

    toast.success(initial ? "Agent updated" : "Agent added");
    if (!initial) {
      form.reset(EMPTY_VALUES);
    }
    onSaved();
    setLoading(false);
  }

  async function deleteAgent() {
    if (!initial) {
      return;
    }

    setDeleting(true);
    const response = await fetch("/api/agents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: initial.id }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to delete agent");
      setDeleting(false);
      return;
    }

    toast.success(`${initial.name} removed`);
    setDeleteOpen(false);
    setDeleting(false);
    onSaved();
  }

  return (
    <>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2 md:col-span-2">
          <AgentPhotoUploader
            fieldId={fieldId("photo_url")}
            value={photoUrl ?? ""}
            fallbackInitial={displayName}
            hoverToChange={Boolean(initial)}
            onChange={(url) =>
              form.setValue("photo_url", url, { shouldDirty: true, shouldValidate: true })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fieldId("name")}>Name</Label>
          <Input id={fieldId("name")} {...form.register("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fieldId("role_title")}>Role title</Label>
          <Input id={fieldId("role_title")} {...form.register("role_title")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fieldId("email")}>Email</Label>
          <Input id={fieldId("email")} type="email" {...form.register("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fieldId("phone")}>Phone</Label>
          <Input id={fieldId("phone")} {...form.register("phone")} />
        </div>
        <div className="flex items-center gap-2 md:col-span-2">
          <input
            id={fieldId("is_default")}
            type="checkbox"
            {...form.register("is_default")}
          />
          <Label htmlFor={fieldId("is_default")}>Default agent</Label>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={loading || deleting}>
            {loading ? "Saving..." : initial ? "Update agent" : "Add agent"}
          </Button>
          {initial ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading || deleting}
              onClick={() => setDeleteOpen(true)}
            >
              Delete agent
            </Button>
          ) : null}
        </div>
      </form>

      {initial ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent showCloseButton={!deleting}>
            <DialogHeader>
              <DialogTitle>Delete agent?</DialogTitle>
              <DialogDescription>
                {initial.name} will be removed from your agency. Existing reports keep
                any listing agent details already attached.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteAgent} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
