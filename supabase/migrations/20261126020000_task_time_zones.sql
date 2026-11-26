begin;

-- Existing wall-clock values were entered under the Colombo board setting.
alter table public.daily_tasks
  add column due_zone text not null default 'Asia/Colombo'
    check (due_zone in ('Asia/Colombo', 'Europe/Rome'));

alter table public.daily_tasks
  add column due_at timestamptz generated always as (
    (due_date + due_time) at time zone due_zone
  ) stored;

-- PostgreSQL shifts nonexistent local times forward by default. Reject those
-- values so the saved instant always matches the time the user selected.
alter table public.daily_tasks
  add constraint daily_tasks_due_time_exists_in_zone
  check (due_time is null or (due_at at time zone due_zone) = (due_date + due_time));

grant insert (due_zone) on public.daily_tasks to anon;
grant update (due_zone) on public.daily_tasks to anon;

commit;
