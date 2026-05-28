"use client";

import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { collateralAgentFromProfile } from "@/lib/collateral/social/agentFromProfile";
import type { CollateralAgentSlice } from "@/lib/collateral/templates/types";
import type { AgentProfile } from "@/lib/types";

type Props = {
  open: boolean;
  loading: boolean;
  agencyAgents: AgentProfile[];
  selectedAgent: CollateralAgentSlice;
  onClose: () => void;
  onSelect: (agent: CollateralAgentSlice) => void;
};

function agentMatchesSelection(
  profile: AgentProfile,
  selected: CollateralAgentSlice,
) {
  const next = collateralAgentFromProfile(profile);
  return (
    next.name === selected.name &&
    next.email === selected.email &&
    next.phone === selected.phone
  );
}

export function SocialPostAgentPickerDialog({
  open,
  loading,
  agencyAgents,
  selectedAgent,
  onClose,
  onSelect,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose an agent</DialogTitle>
          <DialogDescription>
            Load contact details and photo from someone on your agency team.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : agencyAgents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {agencyAgents.map((profile) => {
              const isSelected = agentMatchesSelection(profile, selectedAgent);

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    onSelect(collateralAgentFromProfile(profile));
                    onClose();
                  }}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 ${
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-border/70 bg-background/80"
                  }`}
                >
                  {profile.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.photo_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {profile.name.charAt(0)}
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {profile.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {profile.role_title ||
                        profile.email ||
                        profile.phone ||
                        "Agent"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 py-4 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              No agents saved for your agency yet. Add team members in Settings,
              then return here to load them onto your post.
            </p>
            <Link href="/settings/agents">
              <Button type="button" variant="outline" size="sm">
                Manage agents
              </Button>
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
