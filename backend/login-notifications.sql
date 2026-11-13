create table public.gerontik_learning_login_events (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 login_at timestamptz not null,
 email text not null,
 name text not null,
 account_status text not null check(account_status in ('student','pending')),
 recorded_at timestamptz not null default now(),
 unique(auth_user_id,login_at)
);
create index gerontik_login_events_recent on public.gerontik_learning_login_events(login_at desc);
create table public.gerontik_learning_login_receipts (
 event_id uuid not null references public.gerontik_learning_login_events(id) on delete cascade,
 reader_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(event_id,reader_id)
);
alter table public.gerontik_learning_login_events enable row level security;
alter table public.gerontik_learning_login_receipts enable row level security;
revoke all on public.gerontik_learning_login_events,public.gerontik_learning_login_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.gerontik_learning_login_events,public.gerontik_learning_login_receipts to service_role;
