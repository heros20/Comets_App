alter table public.game_profiles
  add column if not exists equipped_title text,
  add column if not exists equipped_trail text,
  add column if not exists equipped_theme text,
  add column if not exists public_near_misses integer not null default 0,
  add column if not exists public_missions_done integer not null default 0;

create table if not exists public.game_player_state (
  admin_id uuid primary key references public.game_profiles(admin_id) on delete cascade,
  loadout jsonb not null default '{}'::jsonb,
  meta_stats jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '{}'::jsonb,
  unlocked_items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.game_player_state (admin_id)
select gp.admin_id
from public.game_profiles gp
on conflict (admin_id) do nothing;

alter table public.game_player_state enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_player_state'
      and policyname = 'game_player_state_select_own'
  ) then
    create policy game_player_state_select_own
      on public.game_player_state
      for select
      using (auth.uid() = admin_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_player_state'
      and policyname = 'game_player_state_insert_own'
  ) then
    create policy game_player_state_insert_own
      on public.game_player_state
      for insert
      with check (auth.uid() = admin_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_player_state'
      and policyname = 'game_player_state_update_own'
  ) then
    create policy game_player_state_update_own
      on public.game_player_state
      for update
      using (auth.uid() = admin_id)
      with check (auth.uid() = admin_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_player_state'
      and policyname = 'game_player_state_delete_own'
  ) then
    create policy game_player_state_delete_own
      on public.game_player_state
      for delete
      using (auth.uid() = admin_id);
  end if;
end $$;
