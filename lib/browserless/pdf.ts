import { browserlessRequest } from "@/lib/browserless/client";
import { isDevelopment } from "@/lib/env";

export async function renderPdfFromUrl(url: string) {
  const pdf = await browserlessRequest(
    "/pdf",
    {
      url,
      options: {
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: "0px",
          right: "0px",
          bottom: "0px",
          left: "0px",
        },
      },
    },
    { responseType: "buffer" },
  );

  if (!pdf) {
    if (isDevelopment()) {
      return Buffer.from(`Mock PDF for ${url}`);
    }

    throw new Error("PDF generation is not configured");
  }

  return pdf;
}
