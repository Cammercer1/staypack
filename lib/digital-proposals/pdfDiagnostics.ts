import { BrowserlessHttpError } from "@/lib/browserless/client";

export type PdfPreparationStage = "configuration" | "snapshot" | "render" | "validation" | "upload" | "status";

/** Only fixed codes and HTTP status may leave this boundary; never messages, URLs or response bodies. */
export function pdfFailureDetails(error: unknown, stage: PdfPreparationStage) {
  if (error instanceof BrowserlessHttpError) {
    const status = error.status;
    const code = status === 401 || status === 403 ? "renderer_auth" : status === 429 ? "renderer_rate_limit" : status === 408 || status === 504 ? "renderer_timeout" : status >= 500 ? "renderer_unavailable" : "renderer_request";
    return { stage, code, status };
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) return { stage, code: "request_timeout" };
  if (error instanceof Error && error.name === "TypeError" && error.cause && typeof error.cause === "object" && "code" in error.cause && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"].includes(String(error.cause.code))) return { stage, code: "network_error" };
  if (stage === "render" && error instanceof Error) {
    const printPageStatus = /^Could not load print page \((\d{3})\)$/.exec(error.message)?.[1];
    if (printPageStatus) return { stage, code: "print_page_unavailable", status: Number(printPageStatus) };
    if (error.message === "Could not find printable report content on the print page") return { stage, code: "print_content_missing" };
  }
  const codes: Record<PdfPreparationStage, string> = { configuration: "renderer_not_configured", snapshot: "invalid_snapshot", render: "render_failed", validation: "invalid_pdf_response", upload: "pdf_storage_failed", status: "pdf_status_failed" };
  return { stage, code: codes[stage] };
}
