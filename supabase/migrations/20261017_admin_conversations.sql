-- Only the tables and permissions required for admin conversations.
begin;
create table if not exists public.admin_chat_threads (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'ceriga'
    check (channel in ('ceriga', 'alibaba')),
  participant_user_id uuid references auth.users (id) on delete cascade,
  participant_type text not null
    check (participant_type in ('brand', 'manufacturer', 'alibaba')),
  subject text not null default 'Conversation',
  last_message text not null default '',
  last_message_at timestamptz not null default now(),
  unread_admin integer not null default 0,
  external_conversation_id text,
  external_peer_account_id text,
  external_peer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_chat_threads_ceriga_participant_chk check (
    (channel = 'ceriga' and participant_user_id is not null and participant_type in ('brand', 'manufacturer'))
    or (channel = 'alibaba' and participant_type = 'alibaba')
  )
);

-- Upgrade path for DBs that already created the older admin_chat_* shape.
alter table public.admin_chat_threads
  add column if not exists channel text;
alter table public.admin_chat_threads
  add column if not exists external_conversation_id text;
alter table public.admin_chat_threads
  add column if not exists external_peer_account_id text;
alter table public.admin_chat_threads
  add column if not exists external_peer_name text;

update public.admin_chat_threads
set channel = 'ceriga'
where channel is null;

alter table public.admin_chat_threads
  alter column channel set default 'ceriga';
alter table public.admin_chat_threads
  alter column channel set not null;

alter table public.admin_chat_threads
  alter column participant_user_id drop not null;

alter table public.admin_chat_threads
  drop constraint if exists admin_chat_threads_participant_type_check;
alter table public.admin_chat_threads
  drop constraint if exists admin_chat_threads_channel_check;
alter table public.admin_chat_threads
  drop constraint if exists admin_chat_threads_ceriga_participant_chk;

alter table public.admin_chat_threads
  add constraint admin_chat_threads_channel_check
  check (channel in ('ceriga', 'alibaba'));
alter table public.admin_chat_threads
  add constraint admin_chat_threads_participant_type_check
  check (participant_type in ('brand', 'manufacturer', 'alibaba'));
alter table public.admin_chat_threads
  add constraint admin_chat_threads_ceriga_participant_chk check (
    (channel = 'ceriga' and participant_user_id is not null and participant_type in ('brand', 'manufacturer'))
    or (channel = 'alibaba' and participant_type = 'alibaba')
  );

create unique index if not exists admin_chat_threads_alibaba_conversation_uidx
  on public.admin_chat_threads (external_conversation_id)
  where external_conversation_id is not null;

create index if not exists admin_chat_threads_updated_idx
  on public.admin_chat_threads (last_message_at desc);

create index if not exists admin_chat_threads_channel_idx
  on public.admin_chat_threads (channel, last_message_at desc);

create table if not exists public.admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.admin_chat_threads (id) on delete cascade,
  sender text not null check (sender in ('admin', 'participant')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  external_message_id text,
  created_at timestamptz not null default now()
);

alter table public.admin_chat_messages
  add column if not exists external_message_id text;

create unique index if not exists admin_chat_messages_external_uidx
  on public.admin_chat_messages (thread_id, external_message_id)
  where external_message_id is not null;

create index if not exists admin_chat_messages_thread_idx
  on public.admin_chat_messages (thread_id, created_at);

alter table public.admin_chat_threads enable row level security;
alter table public.admin_chat_messages enable row level security;

drop policy if exists "admin_chat_threads_superadmin" on public.admin_chat_threads;
drop policy if exists "admin_chat_threads_participant" on public.admin_chat_threads;
drop policy if exists "admin_chat_messages_superadmin" on public.admin_chat_messages;
drop policy if exists "admin_chat_messages_participant" on public.admin_chat_messages;

create policy "admin_chat_threads_superadmin"
  on public.admin_chat_threads for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "admin_chat_threads_participant"
  on public.admin_chat_threads for select
  to authenticated
  using (auth.uid() = participant_user_id);

create policy "admin_chat_messages_superadmin"
  on public.admin_chat_messages for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "admin_chat_messages_participant"
  on public.admin_chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_chat_threads t
      where t.id = thread_id and t.participant_user_id = auth.uid()
    )
  );


grant select,insert,update,delete on public.admin_chat_threads,public.admin_chat_messages to authenticated;
notify pgrst, 'reload schema';
commit;
