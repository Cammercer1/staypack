import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import {
  isSocialPostsDocument,
  type SocialPostsDocumentJson,
} from "@/lib/collateral/templates/types";
import { exportSocialPostPngSchema } from "@/lib/validation/schemas";
import {
  normalizeSocialPostVariantId,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";

async function readPngFromRequest(request: Request): Promise<{
  variant: SocialPostVariantId;
  pngBuffer: Buffer;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const variant = normalizeSocialPostVariantId(
      String(form.get("variant") ?? ""),
    );
    const file = form.get("png");
    if (!(file instanceof Blob) || file.size === 0) {
      throw new Error(
        "PNG file is required. Export is rendered in your browser — refresh and try again.",
      );
    }
    return {
      variant,
      pngBuffer: Buffer.from(await file.arrayBuffer()),
    };
  }

  const body = exportSocialPostPngSchema.parse(await request.json());
  const variant = normalizeSocialPostVariantId(body.variant) as SocialPostVariantId;

  if (!body.png_base64?.trim()) {
    throw new Error(
      "PNG data is required. Export is rendered in your browser — refresh and try again.",
    );
  }

  let pngBuffer: Buffer;
  try {
    pngBuffer = Buffer.from(body.png_base64, "base64");
  } catch {
    throw new Error("Invalid PNG data");
  }

  if (!pngBuffer.length) {
    throw new Error("PNG export returned empty output");
  }

  return { variant, pngBuffer };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, collateral } = await requireCollateralAccess(id);

    if (collateral.type !== "social_posts") {
      return NextResponse.json(
        { error: "PNG export is only available for social posts" },
        { status: 400 },
      );
    }

    if (!collateral.document_json) {
      return NextResponse.json(
        { error: "Generate social posts before exporting" },
        { status: 400 },
      );
    }

    const { variant, pngBuffer } = await readPngFromRequest(request);

    const admin = createAdminClient();
    const storagePath = `${agency.id}/collateral/${collateral.id}/${variant}.png`;

    const { error: uploadError } = await admin.storage
      .from("report-assets")
      .upload(storagePath, pngBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("report-assets").getPublicUrl(storagePath);

    const document = collateral.document_json as SocialPostsDocumentJson;

    if (!isSocialPostsDocument(document)) {
      return NextResponse.json({ error: "Invalid document" }, { status: 400 });
    }

    const exportedAt = new Date().toISOString();
    const nextDocument: SocialPostsDocumentJson = {
      ...document,
      exports: {
        ...document.exports,
        [variant]: { png_url: publicUrl, exported_at: exportedAt },
      },
    };

    const { data, error } = await supabase
      .from("collateral_items")
      .update({ document_json: nextDocument })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      png_url: publicUrl,
      variant,
      collateral: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to export PNG",
      },
      { status: 400 },
    );
  }
}
