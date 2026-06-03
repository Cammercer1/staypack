# havenly property STR template

**Template id:** `haven-properties-str`  
**Layout base:** Bold detailed STR (`bold-detailed`) — page 1 from `BoldTemplate.tsx`, page 2 market evidence from `ClassicPageTwo`.

Branding (logos, colours, fonts) is **hardcoded** in `brand.ts` — not from StayPacks agency Settings.

## Files

| File | Role |
|------|------|
| `brand.ts` | Logo URLs, colours, `applyHavenBrandToReport()` |
| `HavenPropertiesStrTemplate.tsx` | Wraps Bold + applies haven brand |

To change **layout**, edit `lib/reports/templates/bold/BoldTemplate.tsx` (affects all Bold reports) or copy `BoldReportPageOne` into this folder for haven-only changes.

## Preview

`/dev/haven-properties?listingId={uuid}`

## Managed delivery

`str_template_pack_id: "haven_properties"`
