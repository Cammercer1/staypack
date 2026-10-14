"use client";

import { useAgencyCountry } from "@/components/properties/AgencyCountryProvider";
import { useEffect, useRef, useState, type Ref } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AddressSuggestion } from "@/lib/geocoding/places";
import { pastedListingUrl } from "@/lib/us-property/url";

type Props = {
  country?: "AU" | "US";
  allowListingUrl?: boolean;
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onResolvingChange: (resolving: boolean) => void;
  onSelect?: (address: string) => void;
  endpoint?: string;
  appearance?: "default" | "calculator";
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
  error?: string;
};

export function AddressAutocomplete({ country: requestedCountry, allowListingUrl = false, id, value, disabled, onChange, onResolvingChange, onSelect, endpoint = "/api/listings/address-suggestions", appearance = "default", inputRef, onBlur, error }: Props) {
  const accountCountry = useAgencyCountry();
  const country = requestedCountry ?? accountCountry;
  const compact = appearance === "calculator";
  const AddressInput = compact ? "input" : Input;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef<string | null>(null);
  const focused = useRef(false);
  const selecting = useRef(false);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    pending.current?.abort();
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current?.abort();
  }, []);
  useEffect(() => {
    if (disabled) {
      if (timer.current) clearTimeout(timer.current);
      pending.current?.abort();
    }
  }, [disabled]);

  function search(input: string) {
    cancel();
    onChange(input);
    setSuggestions([]);
    setActive(-1);
    setOpen(false);
    setMessage("");
    setLoading(false);
    if (input.trim().length < 3) return;
    if (allowListingUrl && pastedListingUrl(input)) return;
    session.current ??= crypto.randomUUID();
    const token = session.current;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "suggest", country, input, sessionToken: token }), signal: controller.signal,
        });
        if (!response.ok || response.redirected) throw new Error("Suggestions unavailable");
        const result = await response.json();
        if (controller.signal.aborted) return;
        const matches: AddressSuggestion[] = result.suggestions ?? [];
        setSuggestions(matches);
        setOpen(focused.current && matches.length > 0);
        setMessage(matches.length ? "" : compact ? "No matches. Keep typing or enter the full address." : "No address suggestions. Keep typing, or use Find property with the address you entered.");
      } catch {
        if (!controller.signal.aborted) setMessage(compact ? "Suggestions unavailable. Enter the full address to continue." : "Address suggestions are unavailable. You can still type the address and find the property.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
  }

  async function select(suggestion: AddressSuggestion) {
    if (disabled || selecting.current) return;
    selecting.current = true;
    cancel();
    setOpen(false);
    setSuggestions([]);
    setLoading(false);
    setMessage("");
    onChange(suggestion.address);
    setResolving(true);
    onResolvingChange(true);
    const controller = new AbortController();
    pending.current = controller;
    const token = session.current ?? crypto.randomUUID();
    session.current = null;
    let selectedAddress: string | undefined;
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", country, placeId: suggestion.placeId, address: suggestion.address, sessionToken: token }), signal: controller.signal,
      });
      if (!response.ok || response.redirected) throw new Error("Address unavailable");
      const result = await response.json();
      if (!controller.signal.aborted && typeof result.address === "string" && result.address.trim()) {
        selectedAddress = result.address;
        onChange(result.address);
      } else if (!controller.signal.aborted) {
        throw new Error("Address unavailable");
      }
    } catch {
      if (!controller.signal.aborted) setMessage(compact ? "Check the selected address before continuing." : "Check the selected address and add a unit number if needed, then choose Find property.");
    } finally {
      selecting.current = false;
      setResolving(false);
      onResolvingChange(false);
    }
    // Use the completed address directly, not the parent's previous input state.
    if (!controller.signal.aborted && selectedAddress) onSelect?.(selectedAddress);
  }

  const expanded = open && !disabled && suggestions.length > 0;
  return (
    <div className="relative min-w-0 flex-1">
      <div className={compact ? cn("group du-input du-input-sm min-h-12 w-full gap-3 rounded-xl bg-base-content/[0.025] px-4 shadow-none transition-colors focus-within:bg-base-100 focus-within:outline-none focus-within:ring-4 motion-reduce:transition-none", error ? "du-input-error border-error focus-within:ring-error/10" : "border-base-300/80 hover:border-base-content/25 focus-within:border-primary focus-within:ring-primary/10") : undefined}>
      {compact && <MapPin className="size-4.5 shrink-0 text-base-content/60 transition-colors group-focus-within:text-base-content" aria-hidden="true" />}
      <AddressInput
        ref={inputRef} aria-label={compact ? "Property address" : undefined} aria-invalid={Boolean(error)}
        id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
        aria-controls={expanded ? `${id}-suggestions` : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${id}-suggestion-${active}` : undefined}
        aria-describedby={`${id}-status${error ? ` ${id}-error` : ""}`} value={value} disabled={disabled || resolving}
        autoComplete="off" required minLength={5} maxLength={allowListingUrl ? 2000 : 300}
        placeholder={compact ? "Property address" : allowListingUrl ? "Type an address or paste a Zillow link…" : "Start typing a property address…"} className={compact ? "min-w-0 grow text-base" : "pr-10"}
        onChange={(event) => search(event.target.value)}
        onFocus={() => { focused.current = true; if (suggestions.length) setOpen(true); }}
        onBlur={() => { focused.current = false; setOpen(false); onBlur?.(); }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { cancel(); setOpen(false); setLoading(false); return; }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
            event.preventDefault();
            setOpen(true);
            setActive((current) => (current + (event.key === "ArrowDown" ? 1 : current === -1 ? 0 : -1) + suggestions.length) % suggestions.length);
          }
          if (event.key === "Enter" && expanded && (active >= 0 || compact)) {
            event.preventDefault();
            void select(suggestions[Math.max(0, active)]);
          }
        }}
      />
      {compact && (loading || resolving) && !disabled && <Loader2 aria-hidden className="size-4 shrink-0 motion-safe:animate-spin text-base-content/60" />}
      </div>
      {!compact && (loading || resolving) && !disabled && <Loader2 aria-hidden className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
      {expanded && (
        <div className={cn("absolute z-30 mt-2 w-full overflow-hidden rounded-xl border shadow-lg", compact ? "border-base-300 bg-base-100 text-base-content" : "bg-popover text-popover-foreground")}>
          <ul id={`${id}-suggestions`} role="listbox" aria-label="Address suggestions" className="max-h-72 overflow-y-auto p-1">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.placeId} id={`${id}-suggestion-${index}`} role="option" aria-selected={active === index}
                className={cn("flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-sm", compact ? active === index ? "bg-primary/10" : "hover:bg-primary/10" : active === index ? "bg-muted" : "hover:bg-muted")}
                onMouseDown={(event) => event.preventDefault()} onClick={() => void select(suggestion)}>
                <MapPin aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", compact ? "text-base-content/60" : "text-muted-foreground")} />
                <div className="min-w-0 break-words"><p className="font-medium">{suggestion.mainText}</p><p className={cn("mt-0.5 text-xs", compact ? "text-base-content/65" : "text-muted-foreground")}>{suggestion.secondaryText}</p></div>
              </li>
            ))}
          </ul>
          <div className="border-t bg-white px-4 py-2 text-right text-xs font-normal not-italic tracking-normal text-[#5e5e5e]" translate="no">Google Maps</div>
        </div>
      )}
      <p id={`${id}-status`} role="status" className={message || resolving ? cn("mt-1 text-xs", compact ? "text-base-content/65" : "text-muted-foreground") : "sr-only"}>
        {resolving ? "Completing address…" : message || (expanded ? `${suggestions.length} suggestions. Use the arrow keys and Enter to choose an address.` : "")}
      </p>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-xs leading-5 text-error">{error}</p>}
    </div>
  );
}
