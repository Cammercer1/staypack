-- Public presentation addresses remain separate from private operator/agency ownership.
-- The unique index also supports the public lookup; existing RLS and grants are unchanged.
alter table public.prospect_proposals
  add column public_slug text,
  add constraint prospect_proposals_public_slug_key unique (public_slug),
  add constraint prospect_proposals_public_slug_format check (
    public_slug is null or (
      length(public_slug) <= 300
      and public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*$'
      and public_token is not null
    )
  );

-- Backfill published examples only. Revoked examples and drafts stay inaccessible.
do $$
declare
  proposal record;
  company_part text;
  property_part text;
  candidate text;
begin
  for proposal in
    select id, brand_snapshot_json, final_report_json, property_address
    from public.prospect_proposals
    where published_at is not null and revoked_at is null
    order by published_at, id
  loop
    company_part := trim(both '-' from left(regexp_replace(lower(proposal.brand_snapshot_json->>'slug'), '[^a-z0-9]+', '-', 'g'), 100));
    property_part := trim(both '-' from left(regexp_replace(lower(concat_ws(' ',
      coalesce(proposal.final_report_json #>> '{data,property,address}', proposal.property_address),
      proposal.final_report_json #>> '{data,property,suburb}'
    )), '[^a-z0-9]+', '-', 'g'), 140));
    if coalesce(company_part, '') = '' or coalesce(property_part, '') = '' then
      continue;
    end if;
    candidate := company_part || '/' || property_part;
    if exists (select 1 from public.prospect_proposals where public_slug = candidate) then
      candidate := candidate || '-' || proposal.id::text;
    end if;
    update public.prospect_proposals set public_slug = candidate where id = proposal.id;
  end loop;
end;
$$;

comment on column public.prospect_proposals.public_slug is
  'Stable company/property URL, allocated once at publication. Unlisted and noindex, but publicly viewable. Never reassign revoked links.';
