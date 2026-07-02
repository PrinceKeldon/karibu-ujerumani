alter table public.listings
  add column if not exists approval_status text not null default 'approved';

alter table public.events
  add column if not exists is_ticketed boolean not null default false,
  add column if not exists ticket_url text,
  add column if not exists ticket_price text,
  add column if not exists approval_status text not null default 'approved';

update public.listings
set approval_status = 'approved'
where approval_status is null;

update public.events
set
  is_ticketed = coalesce(is_ticketed, false),
  approval_status = coalesce(approval_status, 'approved');

create index if not exists idx_listings_approval_status on public.listings(approval_status);
create index if not exists idx_events_approval_status on public.events(approval_status);
