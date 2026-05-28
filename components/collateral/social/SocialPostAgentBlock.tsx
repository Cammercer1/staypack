import {
  agentContentAlignFromPlacement,
  getAgentFontSizes,
} from "@/lib/collateral/social/agentLayer";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import type { ResolvedAgentBlockStyle } from "@/lib/collateral/social/agentStyle";
import type {
  CollateralAgentSlice,
  SocialPostAgentLayout,
  SocialPostAvatarShape,
  SocialPostCopyPlacement,
} from "@/lib/collateral/templates/types";

type Props = {
  agent: CollateralAgentSlice;
  placement: SocialPostCopyPlacement;
  layout: SocialPostAgentLayout;
  avatarShape: SocialPostAvatarShape;
  avatarSize: number;
  innerGapPx: number;
  variantId: SocialPostVariantId;
  primaryColour: string;
  blockStyle: ResolvedAgentBlockStyle;
};

export function SocialPostAgentBlock({
  agent,
  placement,
  layout,
  avatarShape,
  avatarSize,
  innerGapPx,
  variantId,
  primaryColour,
  blockStyle,
}: Props) {
  const contentAlign = agentContentAlignFromPlacement(placement);
  const mirror = layout === "horizontal" && placement === "bottom_right";
  const { nameSize, detailSize } = getAgentFontSizes(avatarSize, variantId);
  const avatarClass =
    avatarShape === "circle" ? "rounded-full" : "rounded-md";

  const avatar = agent.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={agent.photo_url}
      alt={agent.name || "Agent"}
      crossOrigin="anonymous"
      className={`shrink-0 object-cover object-top ${avatarClass}`}
      style={{ width: avatarSize, height: avatarSize }}
      draggable={false}
    />
  ) : agent.name ? (
    <div
      className={`flex shrink-0 items-center justify-center font-bold text-white ${avatarClass}`}
      style={{
        width: avatarSize,
        height: avatarSize,
        backgroundColor: primaryColour,
        fontSize: Math.round(avatarSize * 0.4),
      }}
    >
      {agent.name.charAt(0)}
    </div>
  ) : null;

  const verticalItemsClass =
    contentAlign === "right"
      ? "items-end"
      : contentAlign === "center"
        ? "items-center"
        : "items-start";

  const textAlignClass =
    layout === "vertical"
      ? contentAlign === "right"
        ? "text-right"
        : contentAlign === "center"
          ? "text-center"
          : "text-left"
      : mirror
        ? "text-right"
        : "text-left";

  const textBlock = (
    <div
      className={`min-w-0 ${textAlignClass}`}
      style={{
        fontFamily: "var(--collateral-body-font)",
        color: blockStyle.textColour,
        textShadow: blockStyle.textShadow,
      }}
    >
      {agent.name ? (
        <p
          className="font-semibold leading-tight"
          style={{ fontSize: nameSize }}
        >
          {agent.name}
        </p>
      ) : null}
      {agent.phone ? (
        <p className="leading-snug opacity-95" style={{ fontSize: detailSize }}>
          {agent.phone}
        </p>
      ) : null}
      {agent.email ? (
        <p
          className="truncate leading-snug opacity-90"
          style={{ fontSize: detailSize }}
        >
          {agent.email}
        </p>
      ) : null}
    </div>
  );

  const containerClass =
    layout === "horizontal"
      ? `flex h-full w-full items-center ${mirror ? "flex-row-reverse" : ""} ${blockStyle.containerClassName}`
      : `flex h-full w-full flex-col justify-center ${verticalItemsClass} ${blockStyle.containerClassName}`;

  const verticalPadding =
    layout === "vertical" && blockStyle.containerClassName
      ? "py-2"
      : "";

  return (
    <div
      className={`${containerClass} ${verticalPadding}`.trim()}
      style={{ gap: innerGapPx, ...blockStyle.containerStyle }}
    >
      {avatar}
      {textBlock}
    </div>
  );
}
