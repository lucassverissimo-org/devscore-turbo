create table if not exists public.jira_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.jira_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  atlassian_account_id text,
  cloud_id text not null,
  site_url text not null,
  site_name text,
  scope text not null default '',
  encrypted_access_token text,
  access_token_expires_at timestamptz,
  encrypted_refresh_token text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jira_sprint_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cloud_id text not null,
  sprint_id integer not null,
  board_id integer,
  sprint_name text,
  issues jsonb not null default '[]'::jsonb,
  jira_fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cloud_id, sprint_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists jira_oauth_states_user_id_idx
  on public.jira_oauth_states (user_id);

create index if not exists jira_oauth_states_expires_at_idx
  on public.jira_oauth_states (expires_at);

create index if not exists jira_sprint_cache_user_board_idx
  on public.jira_sprint_cache (user_id, cloud_id, board_id);

drop trigger if exists set_jira_connections_updated_at on public.jira_connections;
drop trigger if exists set_jira_sprint_cache_updated_at on public.jira_sprint_cache;

create trigger set_jira_connections_updated_at
before update on public.jira_connections
for each row
execute function public.set_updated_at();

create trigger set_jira_sprint_cache_updated_at
before update on public.jira_sprint_cache
for each row
execute function public.set_updated_at();

alter table public.jira_oauth_states enable row level security;
alter table public.jira_connections enable row level security;
alter table public.jira_sprint_cache enable row level security;

drop policy if exists "No direct access to jira oauth states" on public.jira_oauth_states;
drop policy if exists "No direct access to jira connections" on public.jira_connections;
drop policy if exists "No direct access to jira sprint cache" on public.jira_sprint_cache;

revoke all on public.jira_oauth_states from anon, authenticated;
revoke all on public.jira_connections from anon, authenticated;
revoke all on public.jira_sprint_cache from anon, authenticated;
