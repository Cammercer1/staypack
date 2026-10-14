import { CalculatorError } from "./service";

export function calculatorClientAddress(request: Request) {
  // Netlify overwrites this header at its edge. Do not trust forwarded IP headers.
  return process.env.NETLIFY === "true" ? request.headers.get("x-nf-client-connection-ip") || "unknown" : "local";
}

export async function readCalculatorBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new CalculatorError("Enter your property details to continue.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new CalculatorError("Request is too large.", 413); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
