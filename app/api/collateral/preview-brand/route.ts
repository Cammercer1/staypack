import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";
import { loadSalesBrochurePreviewBrandForAgency } from "@/lib/collateral/sales-brochure/loadPreviewBrand";

export async function GET() {
  try {
    const { agency, supabase } = await requireAgency();
    const preview = await loadSalesBrochurePreviewBrandForAgency(agency, supabase);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load brochure preview brand",
      },
      { status: 400 },
    );
  }
}
