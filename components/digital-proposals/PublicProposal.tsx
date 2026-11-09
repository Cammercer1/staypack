import type { ComponentProps } from "react";
import { MultiPageProposal } from "./MultiPageProposal";
import { PropertyProvidersProposal } from "./property-providers/PropertyProvidersProposal";
import { ProposalReveal } from "./ProposalReveal";

/** Share public loading behavior without changing the authoring previews. */
export function PublicProposal(props: ComponentProps<typeof MultiPageProposal>) {
  const { data, brand, draft, initialPage } = props;
  const firstPage = draft.pages.find(page => page.enabled && (!initialPage || page.id === initialPage));
  return <ProposalReveal brand={{ name: data.agency.name, logoUrl: data.agency.logoUrl, primary: brand.primary, primaryText: brand.primaryText }}
    coverImage={firstPage?.kind === "hero" ? data.property.heroImageUrl : undefined}>
    {["property-providers", "agency-proposal"].includes(draft.templateId)
      ? <PropertyProvidersProposal {...props} /> : <MultiPageProposal {...props} />}
  </ProposalReveal>;
}
