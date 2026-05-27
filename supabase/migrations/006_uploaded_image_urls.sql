alter table public.reports
add column if not exists uploaded_image_urls text[] default '{}';
