import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { buildBusinessCardListingSlice } from "@/lib/collateral/buildBusinessCardDocument";
import { ensureBusinessCardDocument } from "@/lib/collateral/business-card/normalizeBusinessCardDocument";
import { BUSINESS_CARD_VARIANT_IDS } from "@/lib/collateral/business-card/formats";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import { SOCIAL_POST_VARIANT_IDS } from "@/lib/collateral/social/formats";
import {
  getLayersForVariant,
  setVariantLayers,
  syncSharedContentAcrossVariants,
} from "@/lib/collateral/social/variantLayers";
import { withBrochureContentSaved } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import {
  coerceSalesBrochureCopy,
  coerceSalesBrochureCopyForEditor,
} from "@/lib/collateral/sales-brochure/propertyHighlights";
import { normalizeListingSlice } from "@/lib/collateral/social/listingFeatures";
import { ensureSocialPostsDocument, normalizeSocialLayers } from "@/lib/collateral/social/normalizeSocialDocument";
import {
  isBrochureDocument,
  isSocialPostsDocument,
  isBusinessCardDocument,
  type BusinessCardDocumentJson,
  type SocialPostsDocumentJson,
} from "@/lib/collateral/templates/types";
import { isValidCollateralTemplateId } from "@/lib/collateral/templates/ids";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import { assertTemplateGranted } from "@/lib/templates/grants/assertTemplateGranted";
import { templateGrantErrorResponse } from "@/lib/templates/grants/apiErrors";
import type { Agency } from "@/lib/types";
import {
  updateRentalBrochureDocumentSchema,
  updateSalesBrochureDocumentSchema,
  updateBusinessCardDocumentSchema,
  updateSocialPostsDocumentSchema,
} from "@/lib/validation/schemas";

const updateLeaseAppraisalCollateralSchema = z
  .object({
    template_id: z
      .string()
      .nullable()
      .optional()
      .refine(
        (value) => value == null || isLeaseAppraisalTemplateId(value),
        { message: "Select a valid rental appraisal template" },
      ),
  })
  .refine((data) => data.template_id !== undefined, {
    message: "Provide template_id",
  });

const updateSalesAppraisalCollateralSchema = z
  .object({
    template_id: z
      .string()
      .nullable()
      .optional()
      .refine(
        (value) => value == null || isSalesAppraisalTemplateId(value),
        { message: "Select a valid property appraisal template" },
      ),
  })
  .refine((data) => data.template_id !== undefined, {
    message: "Provide template_id",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, collateral } = await requireCollateralAccess(id);

    if (collateral.type === "sales_brochure" || collateral.type === "rental_brochure") {
      return patchBrochure(request, supabase, agency, collateral);
    }

    if (collateral.type === "social_posts") {
      return patchSocialPosts(request, supabase, collateral);
    }

    if (collateral.type === "agent_business_card") {
      return patchBusinessCard(request, supabase, agency, collateral);
    }

    if (collateral.type === "lease_appraisal") {
      return patchLeaseAppraisal(request, supabase, agency, collateral);
    }

    if (collateral.type === "sales_appraisal") {
      return patchSalesAppraisal(request, supabase, agency, collateral);
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

async function patchLeaseAppraisal(
  request: Request,
  supabase: Awaited<ReturnType<typeof requireCollateralAccess>>["supabase"],
  agency: Awaited<ReturnType<typeof requireCollateralAccess>>["agency"],
  collateral: Awaited<ReturnType<typeof requireCollateralAccess>>["collateral"],
) {
  const body = updateLeaseAppraisalCollateralSchema.parse(await request.json());

  if (body.template_id) {
    try {
      await assertTemplateGranted(agency, body.template_id);
    } catch (grantError) {
      const denied = templateGrantErrorResponse(grantError);
      if (denied) {
        return denied;
      }
      throw grantError;
    }
  }

  const { data, error } = await supabase
    .from("collateral_items")
    .update({ template_id: body.template_id ?? null })
    .eq("id", collateral.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ collateral: data });
}

async function patchSalesAppraisal(
  request: Request,
  supabase: Awaited<ReturnType<typeof requireCollateralAccess>>["supabase"],
  agency: Awaited<ReturnType<typeof requireCollateralAccess>>["agency"],
  collateral: Awaited<ReturnType<typeof requireCollateralAccess>>["collateral"],
) {
  const body = updateSalesAppraisalCollateralSchema.parse(await request.json());

  if (body.template_id) {
    try {
      await assertTemplateGranted(agency, body.template_id);
    } catch (grantError) {
      const denied = templateGrantErrorResponse(grantError);
      if (denied) {
        return denied;
      }
      throw grantError;
    }
  }

  const { data, error } = await supabase
    .from("collateral_items")
    .update({ template_id: body.template_id ?? null })
    .eq("id", collateral.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ collateral: data });
}

async function patchBusinessCard(
  request: Request,
  supabase: Awaited<ReturnType<typeof requireCollateralAccess>>["supabase"],
  agency: Awaited<ReturnType<typeof requireCollateralAccess>>["agency"],
  collateral: Awaited<ReturnType<typeof requireCollateralAccess>>["collateral"],
) {
  if (!collateral.document_json) {
    return NextResponse.json(
      { error: "Create the business card before saving edits" },
      { status: 400 },
    );
  }

  const body = updateBusinessCardDocumentSchema.parse(await request.json());
  const current = ensureBusinessCardDocument(
    collateral.document_json as BusinessCardDocumentJson,
  );

  if (!isBusinessCardDocument(current)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }

  let nextDocument: BusinessCardDocumentJson = {
    ...current,
    active_variant_id: body.active_variant_id ?? current.active_variant_id,
    agent_profile_id: body.agent_profile_id ?? current.agent_profile_id ?? null,
    agent: body.agent ? { ...current.agent, ...body.agent } : current.agent,
    variants: { ...current.variants },
  };

  if (body.variants) {
    for (const variantId of BUSINESS_CARD_VARIANT_IDS) {
      const patch = body.variants[variantId];
      if (!patch) continue;
      const currentVariant = nextDocument.variants[variantId];
      const { layers, back_colour, ...variantPatch } = patch;
      nextDocument.variants[variantId] = {
        ...currentVariant,
        ...variantPatch,
        ...(back_colour !== undefined
          ? { back_colour: back_colour ?? undefined }
          : {}),
        layers: layers
          ? {
              ...currentVariant.layers,
              logo: { ...currentVariant.layers.logo, ...layers.logo },
              headline: {
                ...currentVariant.layers.headline,
                ...layers.headline,
              },
              subcopy: {
                ...currentVariant.layers.subcopy,
                ...layers.subcopy,
              },
              agent_photo: {
                ...currentVariant.layers.agent_photo,
                ...layers.agent_photo,
              },
              agent_contact: {
                ...currentVariant.layers.agent_contact,
                ...layers.agent_contact,
              },
              qr: { ...currentVariant.layers.qr, ...layers.qr },
              agency_details: {
                ...currentVariant.layers.agency_details,
                ...layers.agency_details,
              },
            }
          : currentVariant.layers,
      };
    }
  }

  if (Object.hasOwn(body, "qr_listing_id")) {
    if (!body.qr_listing_id) {
      nextDocument = {
        ...nextDocument,
        qr_listing_id: null,
        qr_target_url: "",
        listing: null,
        assets: { ...nextDocument.assets, qr_code_url: "" },
      };
    } else {
      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("*")
        .eq("id", body.qr_listing_id)
        .eq("agency_id", agency.id)
        .maybeSingle();

      if (listingError) {
        return NextResponse.json({ error: listingError.message }, { status: 400 });
      }

      if (!listing) {
        return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      }

      const { provisionedListing, qrCodeUrl, qrTargetUrl } =
        await provisionCollateralQr({
          agency,
          listing,
          collateral,
          supabase,
        });

      nextDocument = {
        ...nextDocument,
        qr_listing_id: provisionedListing.id,
        qr_target_url: qrTargetUrl,
        listing: buildBusinessCardListingSlice(provisionedListing),
        assets: { ...nextDocument.assets, qr_code_url: qrCodeUrl },
      };
    }
  }

  nextDocument = ensureBusinessCardDocument(nextDocument);

  const { data, error } = await supabase
    .from("collateral_items")
    .update({
      document_json: nextDocument,
      qr_code_url: nextDocument.assets.qr_code_url || null,
    })
    .eq("id", collateral.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ collateral: data });
}

async function patchBrochure(
  request: Request,
  supabase: Awaited<ReturnType<typeof requireCollateralAccess>>["supabase"],
  agency: Agency,
  collateral: Awaited<ReturnType<typeof requireCollateralAccess>>["collateral"],
) {
  const schema =
    collateral.type === "rental_brochure"
      ? updateRentalBrochureDocumentSchema
      : updateSalesBrochureDocumentSchema;
  const body = schema.parse(await request.json());

  if (
    body.template_id != null &&
    !isValidCollateralTemplateId(body.template_id)
  ) {
    return NextResponse.json({ error: "Invalid brochure template" }, { status: 400 });
  }

  if (body.template_id) {
    try {
      await assertTemplateGranted(agency, body.template_id);
    } catch (grantError) {
      const denied = templateGrantErrorResponse(grantError);
      if (denied) {
        return denied;
      }
      throw grantError;
    }
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

  if (!isBrochureDocument(current)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }

  const nextTemplateId = body.template_id ?? current.template_id;
  const nextDocument = withBrochureContentSaved({
    ...current,
    template_id: nextTemplateId,
    copy: body.copy
      ? coerceSalesBrochureCopyForEditor({ ...current.copy, ...body.copy })
      : coerceSalesBrochureCopy(current.copy),
    property: body.property
      ? {
          ...current.property,
          ...(body.property.hero_image_url != null
            ? { hero_image_url: body.property.hero_image_url }
            : {}),
          ...(body.property.selected_image_urls != null
            ? { selected_image_urls: body.property.selected_image_urls }
            : {}),
          ...(body.property.page_one_image_urls != null
            ? { page_one_image_urls: body.property.page_one_image_urls }
            : {}),
          ...(body.property.page_two_image_urls != null
            ? { page_two_image_urls: body.property.page_two_image_urls }
            : {}),
        }
      : current.property,
  });

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
