import {
  resolveAgentBlockStyle,
  type ResolvedAgentBlockStyle,
} from "@/lib/collateral/social/agentStyle";
import { SALES_BROCHURE_PREVIEW_AGENT_LAYER } from "@/lib/collateral/sales-brochure/previewBrand";
import type {
  CollateralAgentSlice,
  CollateralBrandSlice,
  SocialPostAgentLayer,
} from "@/lib/collateral/templates/types";

const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

type AgentLayerPick = Pick<
  SocialPostAgentLayer,
  | "layout"
  | "avatar_shape"
  | "background_style"
  | "background_colour"
  | "text_colour"
  | "brand_colour"
>;

function resolveLayer(
  agency: CollateralBrandSlice,
  layer?: Partial<AgentLayerPick>,
): ResolvedAgentBlockStyle {
  return resolveAgentBlockStyle(agency, {
    ...SALES_BROCHURE_PREVIEW_AGENT_LAYER,
    ...layer,
  } as SocialPostAgentLayer);
}

export function BrochureBrandedAgentBlock({
  agency,
  agent,
  layer,
  avatarSize = 52,
  showRole = true,
}: {
  agency: CollateralBrandSlice;
  agent: CollateralAgentSlice;
  layer?: Partial<AgentLayerPick>;
  avatarSize?: number;
  showRole?: boolean;
}) {
  const blockStyle = resolveLayer(agency, layer);
  const avatarClass =
    (layer?.avatar_shape ?? SALES_BROCHURE_PREVIEW_AGENT_LAYER.avatar_shape) ===
    "circle"
      ? "rounded-full"
      : "rounded-md";

  const avatar = agent.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={agent.photo_url}
      alt={agent.name || "Agent"}
      className={`shrink-0 object-cover object-top ${avatarClass}`}
      style={{ width: avatarSize, height: avatarSize }}
    />
  ) : agent.name ? (
    <div
      className={`flex shrink-0 items-center justify-center font-bold ${avatarClass}`}
      style={{
        width: avatarSize,
        height: avatarSize,
        backgroundColor: agency.primary_colour,
        color: blockStyle.textColour,
        fontSize: Math.round(avatarSize * 0.38),
      }}
    >
      {agent.name.charAt(0)}
    </div>
  ) : null;

  return (
    <div
      className={`inline-flex max-w-full items-center gap-3 ${blockStyle.containerClassName}`}
      style={{ ...blockStyle.containerStyle, fontFamily: bodyFont }}
    >
      {avatar}
      <div
        className="min-w-0"
        style={{
          color: blockStyle.textColour,
          textShadow: blockStyle.textShadow,
        }}
      >
        {agent.name ? (
          <p className="text-sm font-semibold leading-tight">{agent.name}</p>
        ) : null}
        {showRole && agent.role_title ? (
          <p className="text-xs leading-snug opacity-90">{agent.role_title}</p>
        ) : null}
        {agent.phone ? (
          <p className="text-xs leading-snug opacity-90">{agent.phone}</p>
        ) : null}
        {agent.email ? (
          <p className="truncate text-xs leading-snug opacity-85">{agent.email}</p>
        ) : null}
      </div>
    </div>
  );
}
