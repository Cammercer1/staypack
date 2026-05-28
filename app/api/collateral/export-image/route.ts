import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";

const MAX_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.")) {
    return true;
  }
  return false;
}

export async function GET(request: Request) {
  try {
    await requireAgency();

    const urlParam = new URL(request.url).searchParams.get("url");
    if (!urlParam) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(urlParam);
    } catch {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    if (isBlockedHost(target.hostname)) {
      return NextResponse.json({ error: "Image host not allowed" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(target.toString(), {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "image/*,*/*" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Image fetch failed (${upstream.status})` },
        { status: 400 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "URL did not return an image" }, { status: 400 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 400 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load image" },
      { status: 400 },
    );
  }
}
