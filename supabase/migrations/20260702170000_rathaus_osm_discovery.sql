alter table public.rathaus_offices
  add column if not exists source text,
  add column if not exists source_url text;

create index if not exists idx_rathaus_offices_lat_lng
  on public.rathaus_offices(latitude, longitude);
