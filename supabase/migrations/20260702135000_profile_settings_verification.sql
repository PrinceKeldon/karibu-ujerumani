alter table public.users
  add column if not exists profile_photo_url text,
  add column if not exists profile_photo_path text;

create table if not exists public.user_settings (
  user_id integer primary key references public.users(id) on delete cascade,
  community_replies boolean not null default true,
  host_messages boolean not null default true,
  event_reminders boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_requests (
  id bigserial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  request_type text not null default 'community',
  notes text,
  status text not null default 'pending',
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_settings_user_id_idx
  on public.user_settings (user_id);

create index if not exists verification_requests_user_id_idx
  on public.verification_requests (user_id);

create index if not exists verification_requests_user_status_idx
  on public.verification_requests (user_id, status);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'verification_requests_status_check'
      and conrelid = 'public.verification_requests'::regclass
  ) then
    alter table public.verification_requests
      add constraint verification_requests_status_check
      check (status in ('pending', 'approved', 'rejected', 'cancelled'));
  end if;
end $$;

alter table public.user_settings enable row level security;
alter table public.verification_requests enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
