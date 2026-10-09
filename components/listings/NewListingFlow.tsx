"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewListingReview } from "./NewListingReview";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { UnsavedListingGuard } from "./UnsavedListingGuard";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import {
  newListingFormSchema,
  newListingPayload,
  restoreNewListingDraft,
  valuesFromListing,
  type NewListingValues,
} from "@/lib/listings/newListingDraft";
import {
  initialListingAgents,
  type ListingAgentDraft,
} from "@/lib/reports/listingAgents";
import { createListingSchema } from "@/lib/validation/schemas";
import type {
  ExistingProperty,
  PropertyCandidate,
} from "@/lib/listings/propertyLookupTypes";
import type { AgentProfile, Listing } from "@/lib/types";

type LookupResponse = {
  candidates?: PropertyCandidate[];
  draft?: Listing;
  duplicate?: ExistingProperty;
  message?: string;
  error?: string;
};
async function responseJson(response: Response) {
  if (response.redirected)
    throw new Error(
      "Your session has expired. Sign in again; your draft is kept in this tab.",
    );
  try {
    return await response.json();
  } catch {
    throw new Error("We couldn't complete that request. Please try again.");
  }
}

export function NewListingFlow({
  agencyAgents = [],
  storageKey = "staypacks:new-listing",
}: {
  agencyAgents?: AgentProfile[];
  storageKey?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"find" | "review">("find");
  const [mode, setMode] = useState<"address" | "url">("address");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<Listing | null>(null);
  const [agents, setAgents] = useState<ListingAgentDraft[]>([]);
  const [candidates, setCandidates] = useState<PropertyCandidate[]>([]);
  const [duplicate, setDuplicate] = useState<ExistingProperty | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addressResolving, setAddressResolving] = useState(false);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const completed = useRef(false);
  const saving = useRef(false);
  const form = useForm<NewListingValues>({
    resolver: zodResolver(newListingFormSchema),
    defaultValues: valuesFromListing(createEmptyListingDraft()),
  });
  const values = useWatch({ control: form.control });
  const { reset } = form;

  useEffect(() => {
    // Session storage can only be read after hydration, and is scoped to user + agency.
    try {
      const saved = restoreNewListingDraft(sessionStorage.getItem(storageKey));
      if (saved) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setStep(saved.draft ? saved.step : "find");
        setMode(saved.mode);
        setQuery(saved.query);
        setUrl(saved.url);
        setDraft(saved.draft);
        setAgents(saved.agents);
        setRestored(true);
        reset(saved.values);
      }
    } catch {
      setStorageFailed(true);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => pending.current?.abort();
  }, [storageKey, reset]);

  useEffect(() => {
    if (!ready || completed.current) return;
    try {
      if (draft || query || url)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 1,
            savedAt: Date.now(),
            step,
            mode,
            query,
            url,
            draft,
            values,
            agents,
          }),
        );
      else sessionStorage.removeItem(storageKey);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageFailed(true);
    }
  }, [ready, storageKey, step, mode, query, url, draft, values, agents]);

  function startDraft(listing: Listing) {
    setDraft(listing);
    reset(valuesFromListing(listing));
    setAgents(initialListingAgents(listing.scraped_listing_json?.agents));
    setDuplicate(null);
    setError(null);
    setMessage(null);
    setRestored(false);
    setStep("review");
  }
  async function lookup(body: object) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setMessage(null);
    setDuplicate(null);
    try {
      const response = await fetch("/api/listings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result: LookupResponse = await responseJson(response);
      if (controller.signal.aborted) return;
      if (!response.ok)
        throw new Error(
          result.error ||
            "Property lookup failed. Try again or enter the details manually.",
        );
      if (result.duplicate) {
        setDuplicate(result.duplicate);
        return;
      }
      if (result.draft) startDraft(result.draft);
      if (result.candidates) setCandidates(result.candidates);
      if (result.message) setMessage(result.message);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Property lookup failed. Please try again.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function manualEntry() {
    pending.current?.abort();
    setBusy(false);
    startDraft(createEmptyListingDraft({ property_address: mode === "address" ? query.trim() : "" }));
  }
  async function save(formValues: NewListingValues) {
    if (!draft || saving.current || completed.current) return;
    setError(null);
    if (agents.some((agent) => !agent.name.trim())) {
      setError("Enter a name for each agent, or remove the empty agent card.");
      return;
    }
    const parsed = createListingSchema.safeParse(
      newListingPayload(draft, formValues, agents),
    );
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          "Check the property and agent details.",
      );
      return;
    }
    saving.current = true;
    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await responseJson(response);
      if (result.duplicate) setDuplicate(result.duplicate);
      if (!response.ok || !result.listing?.id)
        throw new Error(
          result.error ||
            "The listing could not be saved. Your draft is still here.",
        );
      completed.current = true;
      setSaved(true);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Saving the listing succeeded even if browser storage is unavailable. */
      }
      toast.success("Listing created");
      if (result.geocode_warning) toast.message(result.geocode_warning);
      router.push(`/listings/${result.listing.id}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The listing could not be saved. Please try again.",
      );
    } finally {
      saving.current = false;
    }
  }

  if (!ready)
    return (
      <p className="py-8 text-sm text-muted-foreground">
        Loading your listing draft…
      </p>
    );
  const notices = (
    <>
      {duplicate && (
        <div
          role="status"
          className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          <p className="font-medium">
            This property is already in your library.
          </p>
          <p className="mt-1 text-muted-foreground">
            {duplicate.property_address}
            {duplicate.suburb ? `, ${duplicate.suburb}` : ""}
          </p>
          <Link
            className="mt-2 inline-flex font-medium text-primary underline underline-offset-4"
            href={`/listings/${duplicate.id}`}
          >
            Open existing listing
          </Link>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm">
          {message}
        </p>
      )}
    </>
  );
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <UnsavedListingGuard dirty={storageFailed && Boolean(draft) && !saved} />
      <div className="flex items-center gap-3 text-sm">
        <span
          className={
            step === "find"
              ? "font-semibold text-primary"
              : "text-muted-foreground"
          }
        >
          1. Find property
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span
          className={
            step === "review"
              ? "font-semibold text-primary"
              : "text-muted-foreground"
          }
        >
          2. Review and create
        </span>
      </div>
      {restored && (
        <p role="status" className="rounded-xl bg-primary/5 px-4 py-3 text-sm">
          Your unfinished listing has been restored. You can continue where you
          left off.
        </p>
      )}
      {storageFailed && (
        <p role="status" className="text-sm text-amber-800">
          Your browser could not keep a draft. Keep this page open until you
          save.
        </p>
      )}
      {step === "find" ? (
        <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-7">
          <div>
            <h2 className="text-xl font-semibold">Start with an address</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We’ll look for property details, photos and any active listing
              agents. You can review everything before creating the listing.
            </p>
          </div>
          <div
            className="inline-flex gap-1 rounded-xl bg-muted p-1"
            aria-label="Property source"
          >
            <Button
              type="button"
              variant={mode === "address" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={mode === "address"}
              disabled={busy}
              onClick={() => {
                setMode("address");
                setError(null);
                setMessage(null);
              }}
            >
              Find by address
            </Button>
            <Button
              type="button"
              variant={mode === "url" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={mode === "url"}
              disabled={busy}
              onClick={() => {
                setMode("url");
                setError(null);
                setMessage(null);
              }}
            >
              Import listing URL
            </Button>
          </div>
          {draft && (
            <div className="rounded-xl border p-3 text-sm">
              <p>
                You have a draft for{" "}
                <strong>
                  {form.getValues("property_address") || "a new property"}
                </strong>
                . Choosing another property will replace it.
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 pt-2"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setDuplicate(null);
                  setMessage(null);
                  setStep("review");
                }}
              >
                Continue this draft <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (addressResolving || busy) return;
              setCandidates([]);
              void lookup(
                mode === "address"
                  ? { action: "search", query }
                  : { action: "import", url },
              );
            }}
          >
            <Label htmlFor="new-property-search">
              {mode === "address" ? "Property address" : "Listing URL"}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              {mode === "address" ? (
                <AddressAutocomplete
                  id="new-property-search"
                  value={query}
                  disabled={busy}
                  onResolvingChange={setAddressResolving}
                  onChange={(address) => {
                    setQuery(address);
                    setCandidates([]);
                    setDuplicate(null);
                    setMessage(null);
                    setError(null);
                  }}
                />
              ) : (
              <Input
                id="new-property-search"
                value={url}
                type="url"
                required
                autoComplete="off"
                disabled={busy}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setCandidates([]);
                  setDuplicate(null);
                }}
                placeholder="https://www.domain.com.au/…"
              />
              )}
              <Button type="submit" disabled={busy || addressResolving}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {busy
                  ? "Looking up…"
                  : mode === "address"
                    ? "Find property"
                    : "Import listing"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "address"
                ? "Choose an address from the suggestions. Include your unit number, or add it after choosing the street."
                : "Paste the full property listing link. You’ll review the imported details next."}
            </p>
          </form>
          {notices}
          {mode === "address" && candidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Choose the matching property
              </p>
              {candidates.map((candidate, index) => (
                <button
                  key={candidate.slug ?? candidate.placeId ?? index}
                  type="button"
                  disabled={busy}
                  onClick={() => void lookup({ action: "select", candidate })}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {candidate.address}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {candidate.partialMatch
                        ? "Partial match · confirm the unit and street number"
                        : candidate.source === "domain"
                          ? "Property profile available"
                          : "Address only · add property details next"}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 border-t pt-4">
            <Button
              type="button"
              variant="link"
              className="px-0"
              onClick={manualEntry}
            >
              Enter details manually
            </Button>
            {busy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  pending.current?.abort();
                  setBusy(false);
                }}
              >
                Cancel lookup
              </Button>
            )}
          </div>
        </section>
      ) : (
        draft && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={form.formState.isSubmitting}
                onClick={() => {
                  setStep("find");
                  setError(null);
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to property search
              </Button>
              <p className="text-xs text-muted-foreground">
                {storageFailed ? "Unsaved listing" : "Draft kept in this tab"}
              </p>
            </div>
            <form
              noValidate
              onSubmit={(event) => void form.handleSubmit(save)(event)}
              className="space-y-5"
            >
              <fieldset
                disabled={form.formState.isSubmitting}
                className="min-w-0 space-y-5"
              >
                <NewListingReview
                  draft={draft}
                  onDraftChange={setDraft}
                  form={form}
                  agents={agents}
                  onAgentsChange={setAgents}
                  agencyAgents={agencyAgents}
                />
              </fieldset>
              {notices}
              <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
                <p className="max-w-lg text-sm text-muted-foreground">
                  Create the property record, then choose an appraisal or
                  marketing document. You can add photos and update details at
                  any time.
                </p>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || saved}
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {form.formState.isSubmitting
                    ? "Creating…"
                    : saved
                      ? "Listing created"
                      : "Create listing"}
                </Button>
              </div>
            </form>
          </>
        )
      )}
    </div>
  );
}
