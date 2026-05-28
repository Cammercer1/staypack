-- Allow agencies to override the public landing page URL with their own listing URL.
-- The effective URL (used for QR codes, Copy Link, etc.) is:
--   COALESCE(custom_landing_url, public_url)

alter table listings
  add column if not exists custom_landing_url text;
