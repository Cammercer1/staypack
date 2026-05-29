alter table listings add column if not exists listing_purpose text not null default 'sale';

alter table listings drop constraint if exists listings_listing_purpose_check;
alter table listings add constraint listings_listing_purpose_check check (listing_purpose in ('sale', 'lease'));
