create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('USER', 'SCRUM', 'ADMIN');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'USER'::public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists full_name text;

create table if not exists public.sprint_plannings (
  id uuid primary key default gen_random_uuid(),
  project text not null default 'BRAVO',
  name text not null,
  start_date date,
  end_date date,
  planning_data jsonb not null default '{
    "sprintName": "",
    "startDate": "",
    "endDate": "",
    "members": [],
    "tasks": []
  }'::jsonb,
  planning_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_plannings_project_name_key unique (project, name)
);

create table if not exists public.sprint_distributions (
  id uuid primary key default gen_random_uuid(),
  sprint_planning_id uuid not null references public.sprint_plannings(id) on delete cascade,
  distribution_data jsonb not null default '{
    "pointsType": "hrs",
    "devs": []
  }'::jsonb,
  distribution_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_distributions_sprint_planning_id_key unique (sprint_planning_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sprint_plannings'
      and column_name = 'distribution_data'
  ) then
    execute '
      insert into public.sprint_distributions (
        sprint_planning_id,
        distribution_data,
        distribution_updated_at
      )
      select
        id,
        distribution_data,
        distribution_updated_at
      from public.sprint_plannings
      on conflict (sprint_planning_id) do nothing
    ';
  end if;
end;
$$;

alter table public.sprint_plannings
  drop column if exists distribution_data,
  drop column if exists distribution_updated_at;

create index if not exists sprint_plannings_project_start_date_idx
  on public.sprint_plannings (project, start_date desc);

create index if not exists sprint_distributions_sprint_planning_id_idx
  on public.sprint_distributions (sprint_planning_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_plannings_updated_at on public.sprint_plannings;
drop trigger if exists set_sprint_distributions_updated_at on public.sprint_distributions;
drop trigger if exists set_user_profiles_updated_at on public.user_profiles;

create trigger set_sprint_plannings_updated_at
before update on public.sprint_plannings
for each row
execute function public.set_updated_at();

create trigger set_sprint_distributions_updated_at
before update on public.sprint_distributions
for each row
execute function public.set_updated_at();

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'USER'::public.app_role
  )
  on conflict (id) do update
    set
      email = excluded.email,
      full_name = coalesce(nullif(public.user_profiles.full_name, ''), excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.user_profiles where id = auth.uid()),
    'USER'::public.app_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_user_role() = 'ADMIN'::public.app_role;
$$;

create or replace function public.can_manage_sprint_plannings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_user_role() in ('ADMIN'::public.app_role, 'SCRUM'::public.app_role);
$$;

alter table public.user_profiles enable row level security;
alter table public.sprint_plannings enable row level security;
alter table public.sprint_distributions enable row level security;

drop policy if exists "Allow anon select sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow anon insert sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow anon update sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated select sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated insert sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated update sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow anon sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated sprint plannings" on public.sprint_plannings;
drop policy if exists "Public can select sprint plannings" on public.sprint_plannings;
drop policy if exists "Sprint editors can insert sprint plannings" on public.sprint_plannings;
drop policy if exists "Sprint editors can update sprint plannings" on public.sprint_plannings;

create policy "Public can select sprint plannings"
on public.sprint_plannings
for select
to anon, authenticated
using (true);

create policy "Sprint editors can insert sprint plannings"
on public.sprint_plannings
for insert
to authenticated
with check (public.can_manage_sprint_plannings());

create policy "Sprint editors can update sprint plannings"
on public.sprint_plannings
for update
to authenticated
using (public.can_manage_sprint_plannings())
with check (public.can_manage_sprint_plannings());

drop policy if exists "Public can select sprint distributions" on public.sprint_distributions;
drop policy if exists "Public can insert sprint distributions" on public.sprint_distributions;
drop policy if exists "Public can update sprint distributions" on public.sprint_distributions;

create policy "Public can select sprint distributions"
on public.sprint_distributions
for select
to anon, authenticated
using (true);

create policy "Public can insert sprint distributions"
on public.sprint_distributions
for insert
to anon, authenticated
with check (true);

create policy "Public can update sprint distributions"
on public.sprint_distributions
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Users can select own profile" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Admins can update profiles" on public.user_profiles;

create policy "Users can select own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = id or public.is_admin());

create policy "Users can insert own profile"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = id and role = 'USER'::public.app_role);

create policy "Admins can update profiles"
on public.user_profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant usage on type public.app_role to anon, authenticated;

revoke all on public.sprint_plannings from anon, authenticated;
revoke all on public.sprint_distributions from anon, authenticated;
revoke all on public.user_profiles from anon, authenticated;

grant select on public.sprint_plannings to anon, authenticated;
grant insert, update on public.sprint_plannings to authenticated;

grant select, insert, update on public.sprint_distributions to anon, authenticated;

grant select, insert, update on public.user_profiles to authenticated;
