-- Only after str_workspace_fixture + STR workspace migration in an EMPTY disposable DB.
alter table public.listings add column updated_at timestamptz not null default now();
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
