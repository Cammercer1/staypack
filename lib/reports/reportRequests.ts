import type { Report } from "@/lib/types";

export class ReportRequestError extends Error {
  constructor(
    message: string,
    readonly recoverable: boolean,
  ) {
    super(message);
  }
}

/** Platform timeouts may return HTML even when a background render finishes. */
export async function reportRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(65_000),
    });
  } catch {
    throw new ReportRequestError(
      "The connection was interrupted. Please try again.",
      true,
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new ReportRequestError(
      payload?.error ??
        "The server did not finish responding. Please try again.",
      response.status >= 500 || !payload,
    );
  }
  return payload as T;
}

export const jsonRequest = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Send only one render request, then recover a completed PDF without paying for another render. */
export async function prepareReportPdf(
  report: Pick<Report, "id" | "pdf_url" | "status">,
  onRecovering?: () => void,
): Promise<Report> {
  try {
    const payload = await reportRequest<{ report: Report }>(
      `/api/reports/${report.id}/generate-pdf`,
      jsonRequest({ preview: report.status !== "published" }),
    );
    if (!payload.report?.pdf_url)
      throw new ReportRequestError("PDF response was incomplete.", true);
    return payload.report;
  } catch (error) {
    if (!(error instanceof ReportRequestError) || !error.recoverable)
      throw error;
  }
  onRecovering?.();
  for (let attempt = 0; attempt < 9; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5_000));
    try {
      const payload = await reportRequest<{ report: Report }>(
        `/api/reports/${report.id}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (payload.report?.pdf_url && payload.report.pdf_url !== report.pdf_url)
        return payload.report;
    } catch {
      // Brief polling failures should not start another render or leave the UI locked.
    }
  }
  throw new Error(
    "Your PDF may still be preparing. Reload to check for a completed PDF, or try preparing it again shortly.",
  );
}
