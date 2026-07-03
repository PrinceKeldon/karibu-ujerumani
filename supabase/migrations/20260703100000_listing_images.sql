alter table public.listings
  add column if not exists images text,
  add column if not exists postcode varchar,
  add column if not exists city_name varchar,
  add column if not exists state_name varchar,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists idx_listings_postcode on public.listings(postcode);
create index if not exists idx_listings_city_name on public.listings(city_name);
create index if not exists idx_listings_state_name on public.listings(state_name);
