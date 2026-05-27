insert into storage.buckets (id, name, public)
values
  ('agency-assets', 'agency-assets', true),
  ('agent-assets', 'agent-assets', true),
  ('report-assets', 'report-assets', true),
  ('report-pdfs', 'report-pdfs', true),
  ('scrape-html', 'scrape-html', false)
on conflict (id) do nothing;

create policy "Agency members can read agency assets"
on storage.objects for select
using (
  bucket_id = 'agency-assets'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);

create policy "Agency admins can upload agency assets"
on storage.objects for insert
with check (
  bucket_id = 'agency-assets'
  and public.is_agency_admin((storage.foldername(name))[1]::uuid)
);

create policy "Agency admins can update agency assets"
on storage.objects for update
using (
  bucket_id = 'agency-assets'
  and public.is_agency_admin((storage.foldername(name))[1]::uuid)
);

create policy "Agency members can read agent assets"
on storage.objects for select
using (
  bucket_id = 'agent-assets'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);

create policy "Agency admins can upload agent assets"
on storage.objects for insert
with check (
  bucket_id = 'agent-assets'
  and public.is_agency_admin((storage.foldername(name))[1]::uuid)
);

create policy "Agency members can read report assets"
on storage.objects for select
using (
  bucket_id = 'report-assets'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);

create policy "Agency members can upload report assets"
on storage.objects for insert
with check (
  bucket_id = 'report-assets'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);

create policy "Public can read report assets"
on storage.objects for select
using (bucket_id = 'report-assets');

create policy "Agency members can read report pdfs"
on storage.objects for select
using (
  bucket_id = 'report-pdfs'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);

create policy "Agency members can upload report pdfs"
on storage.objects for insert
with check (
  bucket_id = 'report-pdfs'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);

create policy "Public can read report pdfs"
on storage.objects for select
using (bucket_id = 'report-pdfs');

create policy "Agency members can read scrape html"
on storage.objects for select
using (
  bucket_id = 'scrape-html'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);

create policy "Agency members can upload scrape html"
on storage.objects for insert
with check (
  bucket_id = 'scrape-html'
  and public.is_agency_member((storage.foldername(name))[1]::uuid)
);
