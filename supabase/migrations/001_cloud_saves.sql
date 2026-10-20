-- Cloud saves for Starlight Fishing Club.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run again: everything is created only if missing or replaced.
--
-- One row per player. The game's public (anon) key can reach the table only
-- through these row level security rules: a signed-in player can read and
-- write their own row, and nothing else. Signed-out visitors get nothing.

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The same checksummed save code as Settings > Export. Capped so the table
  -- cannot be used to store anything large.
  data text not null check (octet_length(data) <= 256000),
  -- A small summary (water, fish caught...) so the game can compare saves
  -- without downloading and decoding the whole thing.
  progress jsonb not null default '{}'::jsonb check (octet_length(progress::text) <= 2000),
  game_version text not null default '' check (char_length(game_version) <= 20),
  -- When the game wrote the save (milliseconds, from the player's clock).
  saved_at bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- Only signed-in players, and only these actions.
revoke all on table public.saves from anon;
revoke all on table public.saves from authenticated;
grant select, insert, update, delete on table public.saves to authenticated;

drop policy if exists "Players read their own save" on public.saves;
create policy "Players read their own save" on public.saves
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players create their own save" on public.saves;
create policy "Players create their own save" on public.saves
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players update their own save" on public.saves;
create policy "Players update their own save" on public.saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players delete their own save" on public.saves;
create policy "Players delete their own save" on public.saves
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The server keeps its own time of the last change.
create or replace function public.saves_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch
  before update on public.saves
  for each row execute function public.saves_touch();

-- Settings > Account > Delete my account: removes the sign-in and, through the
-- foreign key, the cloud save. Runs as the owner so it can reach auth.users,
-- but only ever for the player who calls it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
