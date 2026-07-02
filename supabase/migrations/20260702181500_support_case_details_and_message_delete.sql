alter table public.support_cases
  add column if not exists contact_phone text,
  add column if not exists location text,
  add column if not exists request_summary text;

create index if not exists idx_messages_participants
  on public.messages(from_user_id, to_user_id);
