"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentProfileForm } from "@/components/settings/AgentProfileForm";
import type { AgentProfile } from "@/lib/types";

export function AgentsManager() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);

  const loadAgents = useCallback(async () => {
    const response = await fetch("/api/agents");
    const payload = await response.json();
    setAgents(payload.agents ?? []);
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return (
    <div className="space-y-6">
      <div className="surface-card p-6 md:p-8">
        <h3 className="mb-6 font-display text-xl tracking-tight">Add agent</h3>
        <AgentProfileForm onSaved={loadAgents} />
      </div>

      <div className="surface-card p-6 md:p-8">
        <h3 className="mb-6 font-display text-xl tracking-tight">Existing agents</h3>
        <div className="space-y-8">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents yet.</p>
          ) : (
            agents.map((agent) => (
              <div key={agent.id} className="border-b pb-8 last:border-none last:pb-0">
                <AgentProfileForm initial={agent} onSaved={loadAgents} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
