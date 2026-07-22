export async function buildPdfDownloadResponse(
  pdfUrl: string,
  filename: string,
) {
  const parsedUrl = new URL(pdfUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Stored PDF URL is invalid");
  }

  const source = await fetch(parsedUrl, { cache: "no-store" });

  if (!source.ok || !source.body) {
    throw new Error("Stored PDF could not be downloaded");
  }

  return new Response(source.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": source.headers.get("content-type") ?? "application/pdf",
    },
  });
}
