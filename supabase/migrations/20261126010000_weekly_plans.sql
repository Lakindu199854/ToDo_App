begin;

create table public.weekly_plans (
  week_start date not null check (extract(isodow from week_start) = 7),
  owner_slot smallint not null check (owner_slot in (1, 2)),
  notes text not null check (char_length(notes) <= 6000),
  revision uuid not null,
  primary key (week_start, owner_slot)
);

alter table public.weekly_plans enable row level security;
revoke all on public.weekly_plans from public, anon, authenticated;
grant select on public.weekly_plans to anon;
grant insert (week_start, owner_slot, notes, revision) on public.weekly_plans to anon;
grant update (notes, revision) on public.weekly_plans to anon;

-- Weekly plans have the same public access as the daily board.
create policy "Visitors can read planning notes"
  on public.weekly_plans for select to anon using (true);
create policy "Visitors can add planning notes"
  on public.weekly_plans for insert to anon with check (true);
create policy "Visitors can update planning notes"
  on public.weekly_plans for update to anon using (true) with check (true);

commit;
