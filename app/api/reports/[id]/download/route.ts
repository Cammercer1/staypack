import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import {
  buildPublishedPdfFilename,
  resolveReportDownloadType,
} from "@/lib/reports/downloadFilename";
import { buildPdfDownloadResponse } from "@/lib/reports/downloadPdfResponse";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { agency, report, listing } = await requireReportWithListing(id);

    if (!report.pdf_url) {
      return NextResponse.json(
        { error: "Generate the PDF before downloading it" },
        { status: 404 },
      );
    }

    const publishedReport = report.final_report_json;
    const filename = buildPublishedPdfFilename({
      address: publishedReport?.property.address ?? listing.property_address,
      reportType: resolveReportDownloadType(
        publishedReport?.template_id ?? report.template_id,
      ),
      brandName: publishedReport?.agency.name ?? agency.name,
    });

    return await buildPdfDownloadResponse(report.pdf_url, filename);
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
