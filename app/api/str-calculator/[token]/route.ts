import { calculatorSubmissionSchema } from "@/lib/str-calculator/schema";
import { CalculatorError, submitCalculator } from "@/lib/str-calculator/service";
import { calculatorClientAddress, readCalculatorBody } from "@/lib/str-calculator/http";

export const runtime = "nodejs";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...(status === 429 ? { "Retry-After": "3600" } : {}) } });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const parsed = calculatorSubmissionSchema.safeParse(await readCalculatorBody(request));
    if (!parsed.success) return json({ error: "Check your property and contact details and consent, then try again." }, 400);
    const { token } = await params;
    const client = calculatorClientAddress(request);
    return json({ estimate: await submitCalculator(token, parsed.data, client) });
  } catch (error) {
    if (error instanceof CalculatorError) return json({ error: error.message, leadCaptured: error.leadCaptured }, error.status);
    if (error instanceof SyntaxError) return json({ error: "Invalid request. Please try again." }, 400);
    return json({ error: "The calculator is temporarily unavailable. Please try again later." }, 503);
  }
}
