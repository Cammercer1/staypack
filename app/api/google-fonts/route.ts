import { NextResponse } from "next/server";
import type { GoogleFontListItem } from "@/lib/branding/google-fonts";

type GoogleMetadataResponse = {
  familyMetadataList: Array<{
    family: string;
    category: string;
    popularity: number;
  }>;
};

let cachedFonts: GoogleFontListItem[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

async function loadGoogleFontsCatalog() {
  const now = Date.now();
  if (cachedFonts && now - cachedAt < CACHE_TTL_MS) {
    return cachedFonts;
  }

  const response = await fetch("https://fonts.google.com/metadata/fonts", {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error("Unable to load Google Fonts catalog");
  }

  const payload = (await response.json()) as GoogleMetadataResponse;
  cachedFonts = payload.familyMetadataList
    .map((font) => ({
      family: font.family,
      category: font.category,
      popularity: font.popularity,
    }))
    .sort((a, b) => a.popularity - b.popularity);
  cachedAt = now;

  return cachedFonts;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const category = searchParams.get("category")?.trim() ?? "All";
    const limit = Math.min(Number(searchParams.get("limit") ?? "120"), 300);

    const catalog = await loadGoogleFontsCatalog();
    let results = catalog;

    if (category !== "All") {
      results = results.filter((font) => font.category === category);
    }

    if (query) {
      results = results.filter((font) => font.family.toLowerCase().includes(query));
    }

    return NextResponse.json({
      fonts: results.slice(0, limit),
      total: results.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Google Fonts catalog",
      },
      { status: 500 },
    );
  }
}
