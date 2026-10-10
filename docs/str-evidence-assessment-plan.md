# STR evidence assessment implementation plan

**Implementation update — 10 October 2026:** AirROI is now the sole provider for new STR estimates. The active baseline is its headline revenue, with effective ADR reconciled to occupancy. Agents change ADR and occupancy directly; the server calculates annual revenue. The Decisions pilot did not validate an automatic revenue uplift, so the assessment and percentile suggestions below remain research proposals. No automatic image assessment is called in the production estimate path.

Proposed on 10 October 2026. Extend the local AirROI integration with an assessment of property facts, text, photographs, amenities and location. Keep the provider baseline, application suggestion and agent's chosen estimate separate. This plan does not activate a new assessment or change existing reports.

Use OpenAI Decisions with `gpt-6-luna` to classify evidence and compare properties against a defined rubric. Let application code calculate any percentile adjustment. Start with suggestions that agents can inspect and accept; do not treat a model's confidence score as confidence in estimated annual revenue.

## Decisions and model choice

The [Decisions guide](https://developers.openai.com/api/docs/guides/decisions) currently documents a public beta supporting only `gpt-6-luna`, with predicate, choice and rubric score answers. Independent questions can share a request. The endpoint does not generate arbitrary explanation objects, so build routine explanations from recorded findings and sources. Use one optional Responses call for factual text extraction that existing parsers cannot supply. These are proposed uses, subject to the pilot.

Use [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) for that optional extraction too, with Structured Outputs and a small output limit. Keep the existing photo assessment as an offline comparison during evaluation, rather than paying for both on every report.

The repository currently uses OpenAI JavaScript SDK 6.39.0; the Decisions guide requires 7.30.0 or later. Pin a compatible version, inspect the SDK migration notes, and test the other OpenAI integrations. Alternatively isolate a typed server HTTP adapter if the SDK upgrade introduces unrelated migration work. Confirm account access with one bounded smoke test before rollout.

The guide describes inline base64 images, while the current [API reference](https://developers.openai.com/api/reference/python/resources/decisions/methods/create) also permits hosted images. Use an adapter supporting bounded inline images initially, and verify hosted-image support against the selected SDK/API before relying on it. Fetch images server-side with public-address checks, redirect checks, byte and time limits, and content-type validation. Keep keys server-side.

## Evidence to collect

Create a versioned assessment input with stable source IDs. Each fact records its value, source, timestamp and evidence status: listing stated, visually observed, agent provided, unknown or conflicting. Agent-provided values take precedence in the effective property profile without overwriting original evidence or becoming independently verified facts. Missing evidence is never equivalent to absence.

| Area | Facts and treatment |
| --- | --- |
| Configuration | Property category, bedrooms, bathrooms, guest capacity, parking, floor area where supplied and lift/access information. Preserve numeric facts rather than asking AI to infer them from photographs. |
| Amenities | Air conditioning, laundry, outdoor space, pool, views, work area and parking. Distinguish private amenities from shared building facilities. Preserve explicit absences separately from unknowns. |
| Text | Retain exact supporting excerpts and their source. Extract factual claims; do not reward marketing words or accept instructions embedded in listing content. |
| Photographs | Keep the ordered image manifest and content hashes. Identify room types and assess equivalent rooms across the subject and comparable properties. Distinguish visible condition from styling, staging and photography quality. |
| Location | Use existing coordinates and verified location facts. Preserve whether comparable coordinates are approximate. Compute distances in code; do not invent walk times or infer noise from an address. New paid mapping enrichment is outside the first release. |
| Operating evidence | Retain availability, booked/blocked nights, review count, management flags and minimum stays. These inform comparability and uncertainty; they are not automatic premiums or deductions for the subject. |

The calculator already receives coordinates, bedrooms, bathrooms and guest capacity. An adjustment must concern a supported difference relative to the reference properties, rather than rewarding an attribute shared by the market. Treat broad location appeal as baseline context unless there is evidence of a meaningful local difference.

## Comparable and image selection

Extend `lib/str/comparables.ts` to select the analysis set independently from the report's display selection. Start with the same property category and bedroom count, then similar bathrooms, capacity and relevant location. Do not choose the highest estimated revenues as the definition of quality, or silently remove low-performing properties solely because their occupancy is low. Flag sparse operating history and blocked availability.

Use four well-matched comparables initially. The existing response includes multiple image URLs, so request no extra AirROI listing endpoint solely for photos. Bound the first pass to 12 subject images plus up to five images per comparable, deduplicated. Record omitted images and missing room coverage.

Batch independent room-type and evidence-presence questions in Decisions. A subsequent comparison pass can use those results to select living, kitchen, bedroom and bathroom examples. Keep all image IDs attached to the named questions. Questions should be scoped to specific property/room pairs so unrelated photos cannot silently substitute as evidence.

Use explicit choices such as present, explicitly absent, unknown and conflicting for amenity evidence. For room comparisons, use weaker, similar, stronger and insufficient evidence. Keep evidence sufficiency separate from ordered quality scores so unknown does not become the lowest quality level.

## Adjustment policy

Keep the existing provider median and percentile curve unchanged. AI supplies findings; application code maps eligible findings to a proposed position using a versioned rule. A rubric score is not a revenue percentile, and a high classification probability does not establish valuation accuracy.

For the first pilot, retain the median as the active default. Offer only a modest suggestion at the 45th, 50th or 55th percentile. This narrow band is a conservative product policy to validate, not an empirically proven relationship between features and revenue.

A departure from the median requires at least three credible same-category, same-bedroom peers, coverage of two equivalent room types, and at least two independent supported differences across presentation, amenities or local context. Repeated photographs of the same advantage count once. Require direction agreement across at least two-thirds of eligible peer comparisons; conflicting or insufficient evidence retains the median. Set individual model-answer acceptance thresholds using labelled examples before enabling suggestions.

The application must reject missing answers, refusals, mismatched source IDs and contradictory findings. Generate concise reasons from eligible findings, including the specific evidence reviewed and relevant unknowns. Do not ask the model to invent a dollar uplift or a convincing narrative for a predetermined number.

The Ascot assessment at the 55th percentile remains a legacy prototype result. Its low confidence and limited comparable-image coverage do not prove it would qualify under this policy. Reassess it from a recorded evidence manifest during the pilot; do not silently rewrite the saved report.

## Review screen and labels

Extend the existing `StrEstimateStep` under **Review the estimate & evidence**. Keep one prominent figure, labelled **Estimated gross STR revenue**, with the annual period and before-costs qualifier. Show the source beside it: **Market baseline**, **Property assessment applied**, or **Agent adjusted**.

| UI element | Label and behaviour |
| --- | --- |
| Baseline | **Market baseline** — the provider median, always visible as a reference. |
| Suggested figure | **Suggested property adjustment** — show the proposed annual estimate and dollar/percentage difference from the baseline. If evidence is limited, say **No adjustment supported** and retain the median. |
| Evidence status | **Evidence coverage: Limited / Adequate** — derived from coverage, source consistency and comparable suitability. Do not present the model probability as valuation confidence. |
| Explanation | **Why this suggestion?** — expandable findings grouped into Supports a higher estimate, Supports a lower estimate and Needs confirmation. Each finding opens its source text or labelled photos. |
| Fact editing | **Review property facts** — editable amenities, parking, access and other facts with Present, Not present and Unknown choices. Show source badges and preserve the prior evidence. |
| Choices | **Use market baseline**, **Use suggested estimate**, **Enter my own estimate**. Applying an existing result costs no new API call. |
| Position control | **Position within the estimated range** — optional advanced slider spanning the supplied 25th–90th percentiles, showing percentile markers and dollar values. A user's position becomes Agent adjusted, not an AI recommendation. |
| Direct entry | **Your estimated annual gross STR revenue** plus an adjustment note. Permit a valid positive estimate outside the supplied percentile range, label it **Outside the provider's estimated range**, and do not extrapolate a fictitious percentile. |
| Comparables | **Feature in report** — preserve the current one-to-six selection. This controls report evidence and never automatically changes the estimate. |
| Assessment refresh | **Reassess property evidence** — reuse the saved calculator response and market history. Run only stages invalidated by corrected facts or changed images. |
| Market refresh | **Refresh market data** — a distinct paid action with its expected API cost. Preserve agent adjustments and present any new suggestion separately. |

Use a compact comparison drawer for photos and factual excerpts. Show unknown features prominently enough for the agent to correct them, without requiring every field to be completed. Keep raw probabilities, model names and billing traces in the internal assessment record rather than the main workflow.

The adjustment note is required when entering a custom estimate and records the agent's rationale; it is not another permission dialog. Reset actions must name their target: **Reset to market baseline** or **Use latest suggestion**. Applying a suggestion clears the active manual override but retains its history.

## State changes and report behaviour

| Action | Assessment and cost | Report effect |
| --- | --- | --- |
| Correct an amenity or replace a photo | Mark dependent findings stale. Reuse unaffected cached classifications. No paid action on each keystroke. | Preserve the selected estimate until the agent applies a new result. |
| Change address, coordinates, bedrooms, bathrooms or guest capacity | Invalidate the calculator input signature. Require an explicit market refresh before producing a new market-based suggestion; show the expected charge. Property-category changes also invalidate peer selection and matching occupancy history. | Mark the previous market estimate as based on the earlier configuration. Do not relabel it as current or silently overwrite an agent adjustment. |
| Reassess | Use current evidence and the saved market data; incur only the bounded AI work required. | Show the new suggestion alongside any current agent adjustment. |
| Adjust revenue or percentile | Calculate server-side from the saved curve or valid custom amount; no AI or AirROI request. | Reallocate modelled monthly revenue so it totals the chosen annual estimate. |
| Adjust estimated occupancy | Preserve its source separately. | Recalculate booked nights and any derived nightly rate; label derived values clearly. Do not change historical market occupancy. |
| Change featured comps | No reassessment or paid fetch. | Change the selected report cards only. |
| Refresh market data | One bounded calculator/market flow; check caches first. | Preserve agent choices and show differences for review. |
| Save and publish | Freeze the effective facts, figure, selected comps, explanatory copy and methodology into `final_report_json`. | Invalidate superseded PDF assets through the existing flow. Published documents continue using their saved snapshot until explicitly updated. |

Buyer-facing copy continues to use **estimated gross STR revenue**, a short methodology note and the disclaimer. Keep supplier and model names out of that copy. If the agent chooses a custom amount, identify it as an agent-adjusted estimate in the methodology. Percentiles describe a provider distribution, not the probability of achieving the estimate.

## Storage and audit

Preserve `original_estimate_json` as the provider result. Add a versioned assessment to `str_enrichment_json`; keep the effective manual selection in `user_overrides_json`; generate `final_estimate_json` on the server. Validate edits using Zod and the existing report authorization flow rather than trusting a complete calculated estimate supplied by the browser.

Record ordered subject/peer image manifests, stable source IDs, immutable image references where supported, content hashes, text excerpts, effective facts, peer inclusion/exclusion reasons, rubric/prompt version, model, response/request identifiers where supplied, question-to-source mapping, outputs, usage, timestamps, suggested percentile and calculated adjustment. A URL/hash alone cannot reproduce a photo if the source later changes; use retained assessment images where permitted and flag unavailable originals in the audit view.

Store actor, time, previous/new values and reason for each override. Keep assessment revisions append-only. Introduce a tenant-scoped assessment history table if the existing JSON fields cannot retain revisions cleanly; validate ownership and row access before exposing it. Published snapshots need not embed the entire private audit payload.

## Efficiency and spending controls

The [Decisions pricing section](https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability) lists US$0.10 per million input tokens and no output-token charge. As an illustration, 50,000 billed input tokens cost US$0.005, or half a US cent, before applicable premiums. This is not a measured cost for our image workload. Responses extraction uses its separate [model pricing](https://developers.openai.com/api/docs/pricing).

Target less than one US cent for the routine Decisions work, with an initial estimated AI budget of three US cents per assessment including optional extraction. Verify a conservative token bound against measured image usage before enforcing the production allowance. Cap images, detail, text and extraction output; account for every call and never silently escalate to an expensive model. A timeout or partial refusal returns the median and an evidence message, not a chain of paid retries.

Cache photo classifications by image content hash plus model/rubric version. Cache property assessments by the complete effective evidence and baseline version. Isolate private evidence by agency. Editing a chosen figure or report comp selection must not invalidate those caches.

Add a shared server-side occupancy cache keyed by canonical market, bedroom/type filters and freshness period, with known insufficient-data results cached too. Use an atomic in-progress claim so simultaneous reports do not buy the same series repeatedly. Store only provider market data in this shared cache, not property or agency evidence. This extends the current seven-day reuse within a saved report.

Track estimated reserved cost separately from actual provider usage or confirmed billing; a failed request is not automatically a billed request. Preserve the existing limit of one calculator, one resolution and one occupancy attempt per generation. Keep AirROI billing units and OpenAI US-dollar costs explicit until their currency basis is confirmed.

## Implementation order

1. **Contracts and safeguards.** Add evidence/source schemas, immutable assessment revisions and separate baseline/suggestion/override state. Replace low-confidence automatic movement with the pilot's baseline default. Cover preservation of legacy reports and overrides first.
2. **Evidence preparation.** Extend the AirROI adapter to retain useful factual descriptions and coordinate accuracy, reuse amenity/photo fields, extract source-linked subject facts, and implement peer and room selection. Keep raw responses intact.
3. **Decisions adapter and policy.** Add `lib/str/assessment/` modules for facts, images, Decisions, policy and cost accounting. Use the shared `fetchStrEstimate` path for dashboard and headless delivery. Add a reassessment route that does not fetch AirROI again.
4. **Review UI and report integration.** Extend `StrEstimateStep`, report PATCH validation and estimate-adjustment utilities. Add fact editing, source inspection, clear estimate modes, adjustment notes and stale-assessment states. Keep the existing comparable selector and four report templates.
5. **Caches and concurrent requests.** Implement the shared market cache, assessment cache and atomic run claims before enabling routine automatic assessment. Apply database changes through the repository migration workflow after verifying the relevant Supabase/Next.js guidance.
6. **Pilot and rollout.** Begin behind an internal feature flag. Verify Decisions access and record actual cost/latency. Evaluate a representative set including Ascot, sparse markets, ordinary units, premium homes, missing photos, conflicting text and staged imagery. Enable suggestions first; only consider applying them by default after validation.

## Acceptance criteria

- Every adjustment reason points to a supplied image, factual excerpt, structured field or agent input. Unsupported luxury/amenity claims cannot move the estimate.
- Unknown evidence, refusals and low coverage retain the median. Exterior photos cannot score unseen kitchens or bedrooms. Staged furniture cannot establish included furnishings.
- Operating performance is not mistaken for property quality. Choosing higher-revenue cards for display cannot increase the suggested amount.
- A representative human-labelled set establishes room/fact accuracy and adjustment eligibility. Use held-out cases for thresholds. Compare the baseline and adjusted estimates against actual results on matching periods and availability where available; another provider's estimate is not ground truth.
- Report saves preserve provenance, monthly totals, historical occupancy and existing published snapshots. Invalid source IDs and unauthorized overrides are rejected server-side.
- Correcting facts marks the right stages stale. Manual amounts survive reassessment. Repeated/concurrent requests respect cache and spending rules.
- Keyboard and mobile use support all controls; changes have clear saved/unsaved states. Four templates and Browserless-generated PDFs retain the disclaimer and fit their pages.
- Record measured cost and latency before launch. Run focused unit, route and UI checks, then the repository's required full checks in the Node 24 container. No production activation, bulk reassessment or paid evaluation batch is part of creating this plan.
