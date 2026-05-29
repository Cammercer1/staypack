export type LandingTemplateId = "minimal" | "classic";

export type LandingTemplateDefinition = {
  id: LandingTemplateId;
  label: string;
  description: string;
};

export const LANDING_TEMPLATES: LandingTemplateDefinition[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Full-screen photo with lead form — ideal for open house QR codes",
  },
  {
    id: "classic",
    label: "Classic",
    description: "Photo gallery with full property details and sidebar form",
  },
];

export const DEFAULT_LANDING_TEMPLATE: LandingTemplateId = "minimal";

export function isValidLandingTemplate(value: unknown): value is LandingTemplateId {
  return LANDING_TEMPLATES.some((t) => t.id === value);
}

export function resolveLandingTemplate(value: string | null | undefined): LandingTemplateId {
  if (isValidLandingTemplate(value)) return value;
  return DEFAULT_LANDING_TEMPLATE;
}
