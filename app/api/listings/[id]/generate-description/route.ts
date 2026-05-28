import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { generateListingDescription } from "@/lib/openai/generateListingDescription";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { listing } = await requireListingAccess(id);
    const description = await generateListingDescription(listing);

    return NextResponse.json({ description });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate description",
      },
      { status: 500 },
    );
  }
}
