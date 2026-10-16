import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";
import { fetchExportImage } from "@/lib/collateral/social/fetchExportImage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAgency();

    const urlParam = new URL(request.url).searchParams.get("url");
    if (!urlParam) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const { buffer, contentType } = await fetchExportImage(urlParam);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load image" },
      { status: 400 },
    );
  }
}
