create extension if not exists pgcrypto;

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
  distribution_data jsonb not null default '{
    "pointsType": "hrs",
    "devs": []
  }'::jsonb,
  planning_updated_at timestamptz,
  distribution_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_plannings_project_name_key unique (project, name)
);

create index if not exists sprint_plannings_project_start_date_idx
  on public.sprint_plannings (project, start_date desc);

create or replace function public.set_sprint_plannings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sprint_plannings_updated_at on public.sprint_plannings;

create trigger set_sprint_plannings_updated_at
before update on public.sprint_plannings
for each row
execute function public.set_sprint_plannings_updated_at();

alter table public.sprint_plannings enable row level security;

drop policy if exists "Allow anon select sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow anon insert sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow anon update sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated select sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated insert sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated update sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow anon sprint plannings" on public.sprint_plannings;
drop policy if exists "Allow authenticated sprint plannings" on public.sprint_plannings;

create policy "Allow anon sprint plannings"
on public.sprint_plannings
for all
to anon
using (true)
with check (true);

create policy "Allow authenticated sprint plannings"
on public.sprint_plannings
for all
to authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.sprint_plannings to anon, authenticated;
