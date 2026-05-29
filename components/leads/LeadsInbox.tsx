"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Building2,
  ChevronDown,
  Inbox,
  Mail,
  Phone,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadStatusControl } from "@/components/leads/LeadStatusControl";
import { groupLeads, type LeadContact } from "@/lib/leads/groupLeads";
import { cn } from "@/lib/utils";
import type { LeadStatus, LeadWithListing } from "@/lib/types";

type Filter = "all" | "new" | "contacted";

const POLL_INTERVAL_MS = 15_000;

function listingLabel(lead: LeadWithListing): string {
  return (
    lead.listings?.listing_title ||
    lead.listings?.property_address ||
    "Untitled property"
  );
}

export function LeadsInbox({
  initialLeads,
}: {
  initialLeads: LeadWithListing[];
}) {
  const [leads, setLeads] = useState<LeadWithListing[]>(initialLeads);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const knownIdsRef = useRef<Set<string>>(
    new Set(initialLeads.map((lead) => lead.id)),
  );
  const updatingRef = useRef(updatingIds);
  updatingRef.current = updatingIds;

  const refetch = useCallback(async (signal?: AbortSignal) => {
    // Skip while a status change is mid-flight to avoid clobbering optimistic state.
    if (updatingRef.current.size > 0) return;

    try {
      const response = await fetch("/api/leads", { signal });
      if (!response.ok) return;
      const payload = await response.json();
      const next = (payload.leads ?? []) as LeadWithListing[];

      const brandNew = next.filter((lead) => !knownIdsRef.current.has(lead.id));
      knownIdsRef.current = new Set(next.map((lead) => lead.id));

      setLeads(next);
      setLastUpdated(new Date());

      if (brandNew.length === 1) {
        toast.success(`New lead: ${brandNew[0].name}`);
      } else if (brandNew.length > 1) {
        toast.success(`${brandNew.length} new leads just came in`);
      }
    } catch {
      // Network/abort errors are ignored; the next poll will retry.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refetch(controller.signal);
      }
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  const updateStatus = useCallback(
    async (lead: LeadWithListing, nextStatus: LeadStatus) => {
      const previousStatus = lead.status;

      setUpdatingIds((current) => new Set(current).add(lead.id));
      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id ? { ...item, status: nextStatus } : item,
        ),
      );

      try {
        const response = await fetch(`/api/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to update lead");
        }

        setLeads((current) =>
          current.map((item) =>
            item.id === lead.id ? (payload.lead as LeadWithListing) : item,
          ),
        );
      } catch (error) {
        setLeads((current) =>
          current.map((item) =>
            item.id === lead.id ? { ...item, status: previousStatus } : item,
          ),
        );
        toast.error(
          error instanceof Error ? error.message : "Unable to update lead",
        );
      } finally {
        setUpdatingIds((current) => {
          const next = new Set(current);
          next.delete(lead.id);
          return next;
        });
      }
    },
    [],
  );

  const contacts = useMemo(() => groupLeads(leads), [leads]);

  const counts = useMemo(
    () => ({
      all: contacts.length,
      new: contacts.filter((contact) => contact.newCount > 0).length,
      contacted: contacts.filter((contact) => contact.allContacted).length,
    }),
    [contacts],
  );

  const visibleContacts = useMemo(() => {
    const search = query.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (filter === "new" && contact.newCount === 0) return false;
      if (filter === "contacted" && !contact.allContacted) return false;

      if (!search) return true;

      const haystack = [
        contact.name,
        contact.email ?? "",
        contact.phone ?? "",
        ...contact.enquiries.map((lead) => listingLabel(lead)),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [contacts, filter, query]);

  function toggleExpanded(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (leads.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center gap-3 p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="size-6 text-muted-foreground" />
        </div>
        <p className="font-medium">No leads yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Enquiries from your landing pages will appear here automatically. This
          page stays up to date on its own.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="all">
              All
              <CountChip>{counts.all}</CountChip>
            </TabsTrigger>
            <TabsTrigger value="new">
              New
              <CountChip>{counts.new}</CountChip>
            </TabsTrigger>
            <TabsTrigger value="contacted">
              Contacted
              <CountChip>{counts.contacted}</CountChip>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          <LiveIndicator lastUpdated={lastUpdated} />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, property"
              className="h-9 pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      {visibleContacts.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          No leads match your filters.
        </div>
      ) : (
        <div className="surface-card divide-y divide-border/60 overflow-hidden p-0">
          {visibleContacts.map((contact) => (
            <ContactRow
              key={contact.key}
              contact={contact}
              expanded={expanded.has(contact.key)}
              updatingIds={updatingIds}
              onToggle={() => toggleExpanded(contact.key)}
              onStatusChange={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  expanded,
  updatingIds,
  onToggle,
  onStatusChange,
}: {
  contact: LeadContact;
  expanded: boolean;
  updatingIds: Set<string>;
  onToggle: () => void;
  onStatusChange: (lead: LeadWithListing, status: LeadStatus) => void;
}) {
  const multiProperty = contact.propertyCount > 1;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded ? "rotate-0" : "-rotate-90",
          )}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{contact.name}</span>
            {contact.newCount > 0 ? (
              <Badge>{contact.newCount} new</Badge>
            ) : (
              <Badge variant="secondary">Contacted</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {contact.email ? (
              <span className="flex items-center gap-1">
                <Mail className="size-3" />
                {contact.email}
              </span>
            ) : null}
            {contact.phone ? (
              <span className="flex items-center gap-1">
                <Phone className="size-3" />
                {contact.phone}
              </span>
            ) : null}
          </div>
        </div>

        <div className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
          <Building2 className="size-3.5" />
          {multiProperty
            ? `${contact.propertyCount} properties`
            : "1 property"}
        </div>

        <div className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground md:block">
          {format(new Date(contact.latestCreatedAt), "dd MMM yyyy")}
        </div>
      </button>

      {expanded ? (
        <div className="space-y-2 bg-muted/20 px-4 pb-4 pl-12">
          {contact.enquiries.map((lead) => (
            <div
              key={lead.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                {lead.listings ? (
                  <Link
                    href={`/listings/${lead.listings.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {listingLabel(lead)}
                  </Link>
                ) : (
                  <span className="truncate font-medium">
                    {listingLabel(lead)}
                  </span>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Enquired{" "}
                  {format(new Date(lead.created_at), "dd MMM yyyy 'at' h:mma")}
                </p>
              </div>
              <LeadStatusControl
                status={lead.status}
                updating={updatingIds.has(lead.id)}
                onChange={(status) => onStatusChange(lead, status)}
                size="sm"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CountChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted-foreground/15 px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}

function LiveIndicator({ lastUpdated }: { lastUpdated: Date }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex"
      title={`Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}
