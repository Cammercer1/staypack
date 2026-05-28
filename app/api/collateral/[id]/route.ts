import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { SOCIAL_POST_VARIANT_IDS } from "@/lib/collateral/social/formats";
import {
  getLayersForVariant,
  setVariantLayers,
  syncSharedContentAcrossVariants,
} from "@/lib/collateral/social/variantLayers";
import { normalizeListingSlice } from "@/lib/collateral/social/listingFeatures";
import { ensureSocialPostsDocument, normalizeSocialLayers } from "@/lib/collateral/social/normalizeSocialDocument";
import {
  isSocialPostsDocument,
  type SocialPostsDocumentJson,
} from "@/lib/collateral/templates/types";
import { updateSocialPostsDocumentSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, collateral } = await requireCollateralAccess(id);

    if (collateral.type !== "social_posts") {
      return NextResponse.json(
        { error: "Only social posts collateral can be updated with this endpoint" },
        { status: 400 },
      );
    }

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
