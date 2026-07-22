import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import {
  buildPublishedPdfFilename,
  resolveCollateralDownloadType,
} from "@/lib/reports/downloadFilename";
import { buildPdfDownloadResponse } from "@/lib/reports/downloadPdfResponse";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { agency, collateral, listing } = await requireCollateralAccess(id);

    if (!collateral.pdf_url) {
      return NextResponse.json(
        { error: "Generate the PDF before downloading it" },
        { status: 404 },
      );
    }

    const filename = buildPublishedPdfFilename({
      address: listing?.property_address,
      reportType: resolveCollateralDownloadType(collateral.type),
      brandName: agency.name,
    });

    return await buildPdfDownloadResponse(collateral.pdf_url, filename);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "PDF download failed",
      },
      { status: 400 },
    );
  }
}
