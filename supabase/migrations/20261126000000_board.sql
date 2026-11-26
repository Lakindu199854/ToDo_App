begin;

create table public.daily_tasks (
  id uuid primary key,
  owner_slot smallint not null check (owner_slot in (1, 2)),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  planned_date date not null check (planned_date between date '0001-01-01' and date '9999-12-31'),
  estimated_minutes integer check (estimated_minutes between 1 and 1440),
  due_date date check (due_date between date '0001-01-01' and date '9999-12-31'),
  due_time time(0) check (due_time < time '24:00'),
  notes text check (char_length(notes) <= 1000),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  check (due_time is null or due_date is not null)
);

create index daily_tasks_planned_date_idx on public.daily_tasks (planned_date);

alter table public.daily_tasks enable row level security;
revoke all on public.daily_tasks from public, anon, authenticated;
grant select, delete on public.daily_tasks to anon;
grant insert (id, owner_slot, title, planned_date, estimated_minutes, due_date, due_time, notes)
  on public.daily_tasks to anon;
grant update (title, planned_date, estimated_minutes, due_date, due_time, notes, completed)
  on public.daily_tasks to anon;

-- The board is intentionally public and opens directly without accounts.
create policy "Visitors can read tasks"
  on public.daily_tasks for select to anon using (true);

create policy "Visitors can add tasks"
  on public.daily_tasks for insert to anon with check (true);

create policy "Visitors can update tasks"
  on public.daily_tasks for update to anon using (true) with check (true);

create policy "Visitors can delete tasks"
  on public.daily_tasks for delete to anon using (true);

commit;
