"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AddressSuggestion } from "@/lib/geocoding/places";

type Props = {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onResolvingChange: (resolving: boolean) => void;
};

export function AddressAutocomplete({ id, value, disabled, onChange, onResolvingChange }: Props) {
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
    session.current ??= crypto.randomUUID();
    const token = session.current;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/listings/address-suggestions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "suggest", input, sessionToken: token }), signal: controller.signal,
        });
        if (!response.ok || response.redirected) throw new Error("Suggestions unavailable");
        const result = await response.json();
        if (controller.signal.aborted) return;
        const matches: AddressSuggestion[] = result.suggestions ?? [];
        setSuggestions(matches);
        setOpen(focused.current && matches.length > 0);
        setMessage(matches.length ? "" : "No address suggestions. Keep typing, or use Find property with the address you entered.");
      } catch {
        if (!controller.signal.aborted) setMessage("Address suggestions are unavailable. You can still type the address and find the property.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
  }

  async function select(suggestion: AddressSuggestion) {
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
    try {
      const response = await fetch("/api/listings/address-suggestions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", placeId: suggestion.placeId, address: suggestion.address, sessionToken: token }), signal: controller.signal,
      });
      if (!response.ok || response.redirected) throw new Error("Address unavailable");
      const result = await response.json();
      if (!controller.signal.aborted && result.address) onChange(result.address);
    } catch {
      if (!controller.signal.aborted) setMessage("Check the selected address and add a unit number if needed, then choose Find property.");
    } finally {
      if (!controller.signal.aborted) {
        setResolving(false);
      }
      onResolvingChange(false);
    }
  }

  const expanded = open && !disabled && suggestions.length > 0;
  return (
    <div className="relative min-w-0 flex-1">
      <Input
        id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
        aria-controls={expanded ? `${id}-suggestions` : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${id}-suggestion-${active}` : undefined}
        aria-describedby={`${id}-status`} value={value} disabled={disabled || resolving}
        autoComplete="off" required minLength={5} maxLength={300}
        placeholder="Start typing a property address…" className="pr-10"
        onChange={(event) => search(event.target.value)}
        onFocus={() => { focused.current = true; if (suggestions.length) setOpen(true); }}
        onBlur={() => { focused.current = false; setOpen(false); }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { cancel(); setOpen(false); setLoading(false); return; }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
            event.preventDefault();
            setOpen(true);
            setActive((current) => (current + (event.key === "ArrowDown" ? 1 : current === -1 ? 0 : -1) + suggestions.length) % suggestions.length);
          }
          if (event.key === "Enter" && expanded && active >= 0) {
            event.preventDefault();
            void select(suggestions[active]);
          }
        }}
      />
      {(loading || resolving) && !disabled && <Loader2 aria-hidden className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
      {expanded && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <ul id={`${id}-suggestions`} role="listbox" aria-label="Address suggestions" className="max-h-72 overflow-y-auto p-1">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.placeId} id={`${id}-suggestion-${index}`} role="option" aria-selected={active === index}
                className={cn("flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-sm", active === index ? "bg-muted" : "hover:bg-muted")}
                onMouseDown={(event) => event.preventDefault()} onClick={() => void select(suggestion)}>
                <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div><p className="font-medium">{suggestion.mainText}</p><p className="mt-0.5 text-xs text-muted-foreground">{suggestion.secondaryText}</p></div>
              </li>
            ))}
          </ul>
          <div className="border-t bg-white px-4 py-2 text-right text-xs font-normal not-italic tracking-normal text-[#5e5e5e]" translate="no">Google Maps</div>
        </div>
      )}
      <p id={`${id}-status`} role="status" className={message || resolving ? "mt-1 text-xs text-muted-foreground" : "sr-only"}>
        {resolving ? "Completing address…" : message || (expanded ? `${suggestions.length} suggestions. Use the arrow keys and Enter to choose an address.` : "")}
      </p>
    </div>
  );
}
