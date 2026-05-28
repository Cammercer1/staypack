import { getSocialPostFormat } from "@/lib/collateral/social/formats";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isSocialPostsDocument } from "@/lib/collateral/templates/types";
import { SocialPostCanvas } from "@/lib/collateral/templates/social/branded/SocialPostCanvas";

export function BrandedSocialPost({ document, variantId }: CollateralTemplateProps) {
  if (!isSocialPostsDocument(document)) return null;

  const activeVariantId = variantId ?? document.active_variant_id;
  const format = getSocialPostFormat(activeVariantId);

  return (
    <div
      className="collateral-page social-post-page flex items-center justify-center"
      style={{
        width: "var(--collateral-page-width)",
        height: "var(--collateral-page-height)",
        backgroundColor: "#000",
      }}
    >
      <SocialPostCanvas
        document={document}
        variantId={activeVariantId}
        previewWidth={format.widthPx}
        previewHeight={format.heightPx}
      />
    </div>
  );
}
