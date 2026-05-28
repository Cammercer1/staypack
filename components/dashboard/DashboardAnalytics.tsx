"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Loader2, Users } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Preset = "today" | "yesterday" | "7d" | "30d" | "60d" | "custom";

type Range = { from: string; to: string }; // ISO datetime strings

type Stats = { views: number; leads: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function toISO(d: Date) {
  return d.toISOString();
}

function presetToRange(preset: Preset, custom: { from: string; to: string }): Range {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: toISO(startOfDay(now)), to: toISO(endOfDay(now)) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: toISO(startOfDay(y)), to: toISO(endOfDay(y)) };
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toISO(startOfDay(d)), to: toISO(endOfDay(now)) };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: toISO(startOfDay(d)), to: toISO(endOfDay(now)) };
    }
    case "60d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 59);
      return { from: toISO(startOfDay(d)), to: toISO(endOfDay(now)) };
    }
    case "custom":
      return {
        from: custom.from ? toISO(startOfDay(new Date(custom.from))) : toISO(startOfDay(now)),
        to: custom.to ? toISO(endOfDay(new Date(custom.to))) : toISO(endOfDay(now)),
      };
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "60d", label: "60 days" },
  { key: "custom", label: "Custom" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardAnalytics({ activeListings }: { activeListings: number }) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async (p: Preset, c: typeof custom) => {
    const range = presetToRange(p, c);
    // Don't fetch custom if dates aren't both set
    if (p === "custom" && (!c.from || !c.to)) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/overview?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) return;
      const data = (await res.json()) as Stats;
      setStats(data);
    } catch {
      // aborted or network error — ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(preset, custom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  function handleCustomApply() {
    if (custom.from && custom.to) fetchStats("custom", custom);
  }

  const conversion =
    stats && stats.views > 0
      ? ((stats.leads / stats.views) * 100).toFixed(1)
      : null;

  return (
    <div className="surface-card p-6">
      {/* ── Header row ─────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Landing page analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Across all listings
          </p>
        </div>

        {/* Time-frame selector */}
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {PRESETS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom date inputs */}
      {preset === "custom" && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={custom.from}
            max={custom.to || undefined}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={custom.to}
            min={custom.from || undefined}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!custom.from || !custom.to}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      {/* ── Metrics grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile
          icon={Eye}
          label="Page views"
          value={loading ? null : (stats?.views ?? 0).toLocaleString()}
        />
        <Tile
          icon={Users}
          label="Leads"
          value={loading ? null : (stats?.leads ?? 0).toLocaleString()}
        />
        <Tile
          label="Conversion"
          value={loading ? null : conversion != null ? `${conversion}%` : "—"}
          valueClass="text-emerald-600"
        />
        <Tile
          label="Active listings"
          value={activeListings.toLocaleString()}
        />
      </div>
    </div>
  );
}

// ── Tile ──────────────────────────────────────────────────────────────────────

function Tile({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon?: React.ElementType;
  label: string;
  value: string | null;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        {label}
      </div>
      <p className={`font-display text-4xl tracking-tight ${valueClass ?? ""}`}>
        {value === null ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
        ) : (
          value
        )}
      </p>
    </div>
  );
}
