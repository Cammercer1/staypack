"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  agencySlug: string;
  listingSlug: string;
  primaryColour?: string;
};

export function ListingLeadForm({
  agencySlug,
  listingSlug,
  primaryColour = "#002e36",
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_slug: agencySlug,
          listing_slug: listingSlug,
          name,
          email: email || null,
          phone: phone || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit enquiry");
      }

      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit enquiry");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="border border-black/10 bg-white/90 p-8 text-center shadow-sm">
        <CheckCircle2
          className="mx-auto h-10 w-10"
          style={{ color: primaryColour }}
        />
        <p className="mt-4 font-semibold" style={{ color: primaryColour }}>
          Thanks! Enquiry received.
        </p>
        <p className="mt-2 text-sm opacity-60">
          The listing agent will be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-black/10 bg-white/90 p-6 shadow-sm"
    >
      <div className="mb-5">
        <h2
          className="font-display text-xl font-bold tracking-tight"
          style={{ color: primaryColour }}
        >
          Register your interest
        </h2>
        <p className="mt-1 text-sm opacity-60">
          Leave your details and the agent will follow up.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="lead_name" className="text-xs font-semibold uppercase tracking-wider opacity-50">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lead_name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jane Smith"
            required
            className="bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead_email" className="text-xs font-semibold uppercase tracking-wider opacity-50">
            Email
          </Label>
          <Input
            id="lead_email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jane@example.com"
            className="bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead_phone" className="text-xs font-semibold uppercase tracking-wider opacity-50">
            Phone
          </Label>
          <Input
            id="lead_phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0400 000 000"
            className="bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white shadow transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: primaryColour }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit enquiry"
          )}
        </button>
      </div>
    </form>
  );
}
