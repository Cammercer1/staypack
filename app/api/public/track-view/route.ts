import { NextResponse } from "next/server";
import { recordListingPageView } from "@/lib/listings/pageViews";

export async function POST(request: Request) {
  try {
    const { listing_id, referrer, source } = (await request.json()) as {
      listing_id: string;
      referrer?: string;
      source?: "direct" | "qr";
    };

    if (!listing_id) {
      return NextResponse.json({ error: "listing_id required" }, { status: 400 });
    }

    const result = await recordListingPageView({
      listingId: listing_id,
      source: source === "qr" ? "qr" : "direct",
      referrer: referrer ?? null,
      userAgent: request.headers.get("user-agent"),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true, skipped: result.skipped });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
