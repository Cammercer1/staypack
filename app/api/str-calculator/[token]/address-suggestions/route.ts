import { z } from "zod";
import { autocompleteAddresses, completePlaceAddress } from "@/lib/geocoding/places";
import { addressSuggestionsSchema } from "@/lib/geocoding/placesSchema";
import { calculatorClientAddress, readCalculatorBody } from "@/lib/str-calculator/http";
import { limitCalculatorPlaces } from "@/lib/str-calculator/placesRateLimit";
import { CalculatorError, loadPublicCalculator } from "@/lib/str-calculator/service";

export const runtime = "nodejs";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: {
  "Cache-Control": "private, no-store", ...(status === 429 ? { "Retry-After": "3600" } : {}),
} });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const body = addressSuggestionsSchema.parse(await readCalculatorBody(request));
    const { token } = await params;
    const developmentPreview = process.env.NODE_ENV === "development" && token === "preview";
    const calculator = developmentPreview ? null : await loadPublicCalculator(token);
    if (!developmentPreview && !calculator) return json({ error: "This calculator is currently unavailable." }, 404);
    // Public visitors cannot change the agency's configured property market.
    const country = calculator?.widget.country ?? body.country;
    limitCalculatorPlaces(token, calculatorClientAddress(request));
    return json(body.action === "suggest"
      ? { suggestions: await autocompleteAddresses(body.input, body.sessionToken, country) }
      : { address: await completePlaceAddress(body.placeId, body.sessionToken, body.address, country) });
  } catch (error) {
    if (error instanceof CalculatorError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Check the address and try again." }, 400);
    return json({ error: "Address suggestions are unavailable. You can still type the address." }, 503);
  }
}
