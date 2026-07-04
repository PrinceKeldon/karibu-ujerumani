alter table public.users
  add column if not exists postcode varchar,
  add column if not exists city_name varchar,
  add column if not exists state_name varchar,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists state_id integer,
  add column if not exists city_id integer;

create index if not exists idx_users_postcode on public.users(postcode);
create index if not exists idx_users_city_id on public.users(city_id);
create index if not exists idx_users_state_id on public.users(state_id);
