"use client";

import Link from "next/link";
import { z } from "zod";
import type { AgencyContact } from "@/lib/str-appraisals/types";
import { useRemoteOptions } from "@/components/str-appraisals/useRemoteOptions";

type MatchingClient = AgencyContact & { archived_at?: string | null };

/** A suggestion only: the database still enforces uniqueness when saving. */
export function ExistingClientNotice({ email, excludeId, onSelect, onView, previewClients }: {
  email: string;
  excludeId?: string;
  onSelect?: (client: AgencyContact) => void;
  onView?: (clientId: string) => void;
  previewClients?: AgencyContact[];
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const valid = z.email().safeParse(normalizedEmail).success;
  const remote = useRemoteOptions<MatchingClient>(`/api/clients?q=${encodeURIComponent(normalizedEmail)}&archived=all`, "clients", valid && !previewClients);
  const matches = valid ? (previewClients ?? remote.data).filter(client => client.id !== excludeId && client.email?.trim().toLowerCase() === normalizedEmail) : [];
  if (!matches.length) return null;
  return <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4" aria-live="polite">
    <p className="text-sm font-medium">A saved contact already uses this email.</p>
    {matches.map((client: MatchingClient) => <div key={client.id} className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="break-words text-sm font-medium">{client.name}{client.archived_at && <span className="du-badge du-badge-sm ml-2">Archived</span>}</p><p className="break-all text-xs text-base-content/65">{[client.email, client.phone].filter(Boolean).join(" · ")}</p></div>
      {onView ? <button type="button" className="du-btn du-btn-sm min-h-11" onClick={() => onView(client.id)}>View existing contact</button>
        : client.archived_at ? <Link href={`/contacts?contact=${encodeURIComponent(client.id)}`} className="du-btn du-btn-sm min-h-11">View archived contact</Link>
        : onSelect && <button type="button" className="du-btn du-btn-sm min-h-11" onClick={() => onSelect(client)}>Use existing contact</button>}
    </div>)}
    <p className="text-xs text-base-content/65">{matches.some((client: MatchingClient) => client.archived_at) ? "Restore archived contacts in the Contacts directory before using them on a new report." : "Select the saved contact to keep their history together."}</p>
  </div>;
}
