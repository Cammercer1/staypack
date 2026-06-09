# Template catalog, entitlements, and blurb resolution

## Overview

Reports and brochures render from typed document JSON passed to React template components. Template discovery, account entitlements, brand kits, and blurb length selection share one server-side pipeline.

## Template catalog

- **Registry**: [`lib/reports/templates/registry.ts`](../lib/reports/templates/registry.ts) (STR, lease) and [`lib/collateral/templates/registry.ts`](../lib/collateral/templates/registry.ts) (brochures).
- **Metadata**: [`lib/templates/catalog.ts`](../lib/templates/catalog.ts) enriches each entry with `product`, `scope` (`platform` | `account`), `brandMode`, `defaultBlurbLength`, and optional `fixedBrandKitId`.
- **Lookup**: `getTemplateMetadata(templateId)` in [`lib/templates/getTemplateMetadata.ts`](../lib/templates/getTemplateMetadata.ts).

Platform templates are available to all agencies. Account templates (e.g. Haven) require a row in `account_template_grants`.

## Entitlements

Table: `account_template_grants` (`agency_id`, `template_id`, `product`, `is_default`).

- **List**: `GET /api/templates?product=str|lease|sales_brochure|rental_brochure`
- **Resolver**: `resolveAvailableTemplates(agency, product)` in [`lib/templates/resolveAvailableTemplates.ts`](../lib/templates/resolveAvailableTemplates.ts)
- **Writes**: `assertTemplateGranted(agencyId, templateId)` on report/collateral PATCH and generate routes.

## Blurb variants

AI generates three lengths (short / medium / long) via [`lib/copy/pageOneMarketingCopy.ts`](../lib/copy/pageOneMarketingCopy.ts). Each template declares `defaultBlurbLength` in catalog metadata.

**Resolution** (production):

1. Template metadata `defaultBlurbLength` (bold layouts are locked to `long`)
2. Family fallback in [`lib/templates/familyDefaults.ts`](../lib/templates/familyDefaults.ts)

`resolveCopyForTemplate` in [`lib/copy/resolveCopyForTemplate.ts`](../lib/copy/resolveCopyForTemplate.ts) picks the variant and produces `blurb` + `blurb_blocks`.

**Display pipeline**: `resolveFinalReportForDisplay` applies brand kit then blurb resolution — used by `ReportPreview`, print routes, and headless delivery.

Dev playground may pass `allowDevBlurbLengthMap: true` to honour `copy.template_blurb_length` overrides.

## Brand kits

Fixed-brand account templates use `applyBrandForTemplate` ([`lib/branding/applyBrandForTemplate.ts`](../lib/branding/applyBrandForTemplate.ts)). Haven kit lives in [`lib/branding/kits/haven.ts`](../lib/branding/kits/haven.ts).
