-- Light (summary) vs detailed (full) Airbtics estimates per report.
-- Headline numbers stay in original_estimate_json / final_estimate_json.
-- Detailed-only display data (comps, percentiles, seasonality) goes in str_enrichment_json.

alter table public.reports
  add column if not exists airbtics_tier text not null default 'summary'
    check (airbtics_tier in ('summary', 'full'));

alter table public.reports
  add column if not exists airbtics_report_id text;

alter table public.reports
  add column if not exists str_enrichment_json jsonb;

alter table public.reports
  add column if not exists airbtics_cost_cents integer
    check (airbtics_cost_cents is null or airbtics_cost_cents >= 0);

alter table public.reports
  add column if not exists airbtics_fetched_at timestamptz;

comment on column public.reports.airbtics_tier is
  'Which Airbtics endpoint was used: summary (~$0.10) or full (~$0.50).';

comment on column public.reports.airbtics_report_id is
  'External Airbtics report id returned from POST /report/summary or /report/all.';

comment on column public.reports.str_enrichment_json is
  'Normalized detailed data for templates: revenue range, seasonality, comp cards. Null for summary tier.';

comment on column public.reports.airbtics_cost_cents is
  'Snapshot of Airbtics API cost for this estimate. Used for billing reconciliation later.';

comment on column public.reports.raw_airbtics_json is
  'Full Airbtics API response payload for audit and re-normalization.';

-- Agency default so new reports can pre-select a tier in the UI.
alter table public.agencies
  add column if not exists default_airbtics_tier text not null default 'summary'
    check (default_airbtics_tier in ('summary', 'full'));

create index if not exists reports_airbtics_tier_idx
  on public.reports (agency_id, airbtics_tier);
