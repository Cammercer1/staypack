import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { enforceSalesBrochureCopyLimits } from "@/lib/collateral/sales-brochure/copyLimits";
import { SOCIAL_POST_VARIANT_IDS } from "@/lib/collateral/social/formats";
import {
  getLayersForVariant,
  setVariantLayers,
  syncSharedContentAcrossVariants,
} from "@/lib/collateral/social/variantLayers";
import { normalizeListingSlice } from "@/lib/collateral/social/listingFeatures";
import { ensureSocialPostsDocument, normalizeSocialLayers } from "@/lib/collateral/social/normalizeSocialDocument";
import {
  isSalesBrochureDocument,
  isSocialPostsDocument,
  type SalesBrochureDocumentJson,
  type SocialPostsDocumentJson,
} from "@/lib/collateral/templates/types";
import { isValidCollateralTemplateId } from "@/lib/collateral/templates/ids";
import {
  updateSalesBrochureDocumentSchema,
  updateSocialPostsDocumentSchema,
} from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, collateral } = await requireCollateralAccess(id);

    if (collateral.type === "sales_brochure") {
      return patchSalesBrochure(request, supabase, collateral);
    }

    if (collateral.type === "social_posts") {
      return patchSocialPosts(request, supabase, collateral);
    }

    return NextResponse.json(
      { error: "This collateral type cannot be updated with this endpoint" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update collateral",
      },
      { status: 400 },
    );
  }
}

async function patchSalesBrochure(
  request: Request,
  supabase: Awaited<ReturnType<typeof requireCollateralAccess>>["supabase"],
  collateral: Awaited<ReturnType<typeof requireCollateralAccess>>["collateral"],
) {
  const body = updateSalesBrochureDocumentSchema.parse(await request.json());

  if (
    body.template_id != null &&
    !isValidCollateralTemplateId(body.template_id)
  ) {
    return NextResponse.json({ error: "Invalid brochure template" }, { status: 400 });
  }

  if (!collateral.document_json) {
    if (!body.template_id) {
      return NextResponse.json(
        { error: "Choose a template before saving brochure edits" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("collateral_items")
      .update({ template_id: body.template_id })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ collateral: data });
  }

  const current = collateral.document_json;

  if (!isSalesBrochureDocument(current)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }

  const nextTemplateId = body.template_id ?? current.template_id;
  const nextDocument: SalesBrochureDocumentJson = {
    ...current,
    template_id: nextTemplateId,
    copy: body.copy
      ? enforceSalesBrochureCopyLimits({ ...current.copy, ...body.copy })
      : current.copy,
  };

  const { data, error } = await supabase
    .from("collateral_items")
    .update({
      document_json: nextDocument,
      ...(body.template_id ? { template_id: body.template_id } : {}),
    })
    .eq("id", collateral.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ collateral: data });
}

async function patchSocialPosts(
  request: Request,
  supabase: Awaited<ReturnType<typeof requireCollateralAccess>>["supabase"],
  collateral: Awaited<ReturnType<typeof requireCollateralAccess>>["collateral"],
) {
  if (!collateral.document_json) {
    return NextResponse.json(
      { error: "Generate social posts before saving edits" },
      { status: 400 },
    );
  }

  const body = updateSocialPostsDocumentSchema.parse(await request.json());
  const current = ensureSocialPostsDocument(
    collateral.document_json as SocialPostsDocumentJson,
  );

  if (!isSocialPostsDocument(current)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }

  const activeVariantId = body.active_variant_id ?? current.active_variant_id;

  let nextDocument: SocialPostsDocumentJson = {
    ...current,
    active_variant_id: activeVariantId,
    agent: body.agent
      ? { ...current.agent, ...body.agent }
      : current.agent,
    listing: body.listing
      ? normalizeListingSlice({ ...current.listing, ...body.listing })
      : current.listing,
    variants: current.variants,
  };

  if (body.variants) {
    for (const variantId of SOCIAL_POST_VARIANT_IDS) {
      const patch = body.variants[variantId];
      if (!patch) continue;
      nextDocument.variants[variantId] = {
        ...nextDocument.variants[variantId],
        ...patch,
        layers: patch.layers
          ? normalizeSocialLayers(
              patch.layers as SocialPostsDocumentJson["layers"],
              current.agency,
            )
          : nextDocument.variants[variantId]?.layers,
      };
    }
  }

  if (body.layers) {
    const activeLayers = getLayersForVariant(nextDocument, activeVariantId);
    const normalized = normalizeSocialLayers(
      {
        logo: { ...activeLayers.logo, ...body.layers?.logo },
        title: { ...activeLayers.title, ...body.layers?.title },
        subcopy: { ...activeLayers.subcopy, ...body.layers?.subcopy },
        features: { ...activeLayers.features, ...body.layers?.features },
        agent: {
          ...activeLayers.agent,
          ...body.layers?.agent,
        },
      },
      current.agency,
    );

    nextDocument = syncSharedContentAcrossVariants(nextDocument, normalized);
    nextDocument = setVariantLayers(nextDocument, activeVariantId, normalized, {
      layoutCustomized: true,
    });
    nextDocument = {
      ...nextDocument,
      layers: getLayersForVariant(nextDocument, activeVariantId),
    };
  } else {
    nextDocument = ensureSocialPostsDocument(nextDocument);
  }

  const { data, error } = await supabase
    .from("collateral_items")
    .update({ document_json: nextDocument })
    .eq("id", collateral.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ collateral: data });
}
