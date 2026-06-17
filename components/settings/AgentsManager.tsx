"use client";

import { useCallback, useState } from "react";
import { UserPlus } from "lucide-react";
import { AgentProfileForm } from "@/components/settings/AgentProfileForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentProfile } from "@/lib/types";

export function AgentsManager({
  canManage = true,
  initialAgents,
}: {
  canManage?: boolean;
  initialAgents: AgentProfile[];
}) {
  const [agents, setAgents] = useState<AgentProfile[]>(initialAgents);
  const [addOpen, setAddOpen] = useState(false);
  const [addFormKey, setAddFormKey] = useState(0);

  const loadAgents = useCallback(async () => {
    const response = await fetch("/api/agents");
    const payload = await response.json();
    setAgents(payload.agents ?? []);
  }, []);

  function openAddModal() {
    if (!canManage) {
      return;
    }

    setAddFormKey((current) => current + 1);
    setAddOpen(true);
  }

  function handleAgentAdded() {
    if (!canManage) {
      return;
    }

    loadAgents();
    setAddOpen(false);
  }

  return (
    <>
      <div className="surface-card p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-display text-xl tracking-tight">Your agents</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage
                ? "Manage contact details and photos used on buyer-facing report pages."
                : "View contact details and photos used on buyer-facing report pages."}
            </p>
          </div>
          {canManage ? (
            <Button type="button" onClick={openAddModal}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add agent
            </Button>
          ) : null}
        </div>

        {agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {canManage ? "No agents yet." : "No agent profiles have been added yet."}
            </p>
            {canManage ? (
              <Button type="button" className="mt-4" onClick={openAddModal}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add your first agent
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-border/70 bg-muted/20 p-4 md:p-5"
              >
                <AgentProfileForm
                  initial={agent}
                  onSaved={loadAgents}
                  canEdit={canManage}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={canManage && addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add agent</DialogTitle>
            <DialogDescription>
              Create a profile with contact details and a photo for your reports.
            </DialogDescription>
          </DialogHeader>
          <AgentProfileForm key={addFormKey} onSaved={handleAgentAdded} />
        </DialogContent>
      </Dialog>
    </>
  );
}
