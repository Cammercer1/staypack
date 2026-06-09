import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import { serializeTemplateForApi } from "@/lib/templates/serializeForApi";
import type { TemplateProduct } from "@/lib/templates/types";

const querySchema = z.object({
  product: z.enum(["str", "lease", "sales_brochure", "rental_brochure"]),
});

export async function GET(request: Request) {
  try {
    const { agency } = await requireAgency();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      product: url.searchParams.get("product"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Query param product is required (str, lease, sales_brochure, rental_brochure)" },
        { status: 400 },
      );
    }

    const result = await resolveAvailableTemplates(
      agency,
      parsed.data.product as TemplateProduct,
    );

    return NextResponse.json({
      default_template_id: result.defaultTemplateId,
      templates: result.templates.map(serializeTemplateForApi),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load templates" },
      { status: 400 },
    );
  }
}
