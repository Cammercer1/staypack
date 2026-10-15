import { expect, it } from "vitest";
import { BrowserlessHttpError } from "@/lib/browserless/client";
import { pdfFailureDetails } from "./pdfDiagnostics";

it.each([
  [400, "renderer_request"], [401, "renderer_auth"], [403, "renderer_auth"],
  [408, "renderer_timeout"], [429, "renderer_rate_limit"], [500, "renderer_unavailable"],
  [503, "renderer_unavailable"], [504, "renderer_timeout"],
])("classifies renderer HTTP %s without exposing provider details", (status, code) => {
  const error = new BrowserlessHttpError(status as number, "private report https://renderer.example/?token=secret", "pdf");
  expect(pdfFailureDetails(error, "render")).toEqual({ stage: "render", code, status });
});
it("keeps unexpected errors private and separates storage from renderer failures", () => {
  const error = new Error("private customer and signed URL ?token=secret");
  expect(pdfFailureDetails(error, "render")).toEqual({ stage: "render", code: "render_failed" });
  expect(pdfFailureDetails(error, "upload")).toEqual({ stage: "upload", code: "pdf_storage_failed" });
  expect(pdfFailureDetails(error, "status")).toEqual({ stage: "status", code: "pdf_status_failed" });
  expect(pdfFailureDetails(new Error("Could not load print page (503)"), "render")).toEqual({ stage: "render", code: "print_page_unavailable", status: 503 });
});
it("recognizes timeout and known network errors without copying arbitrary error codes", () => {
  expect(pdfFailureDetails(new DOMException("secret", "TimeoutError"), "render")).toEqual({ stage: "render", code: "request_timeout" });
  expect(pdfFailureDetails(new TypeError("secret", { cause: { code: "ECONNRESET" } }), "render")).toEqual({ stage: "render", code: "network_error" });
  expect(pdfFailureDetails(new TypeError("secret", { cause: { code: "private-value" } }), "render")).toEqual({ stage: "render", code: "render_failed" });
});
