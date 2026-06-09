import type { BlurbLength } from "@/lib/copy/blurbVariantConstants";
import { PLAYGROUND_LAYOUT_FAMILIES } from "@/lib/reports/templates/playgroundResolve";
import { salesBrochureTemplateIdForFamily } from "@/lib/reports/templates/salesBrochureFamilyMap";

/** Map legacy STR/lease keys (`classic-light`, etc.) to brochure template ids used at render time. */
export function normalizePlaygroundTemplateBlurbLength(
  mapping: Partial<Record<string, BlurbLength>> | undefined,
): Partial<Record<string, BlurbLength>> {
  if (!mapping) {
    return {};
  }

  const out = { ...mapping };

  for (const family of PLAYGROUND_LAYOUT_FAMILIES) {
    const key1pg = salesBrochureTemplateIdForFamily(family.id, 1);
    const legacyKeys = [
      `${family.id}-light`,
      `${family.id}-detailed`,
      `${family.id}-lease-appraisal`,
    ] as const;

    for (const legacy of legacyKeys) {
      const value = out[legacy];
      if (value && !out[key1pg]) {
        out[key1pg] = value;
      }
      delete out[legacy];
    }
  }

  return out;
}
