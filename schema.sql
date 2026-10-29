-- FoundIt database schema for Supabase
-- Run this file in Supabase Dashboard -> SQL Editor.
-- IMPORTANT: enable Row Level Security and never put the service_role key in frontend code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Campus member',
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  description text not null check (char_length(description) between 5 and 1200),
  category text not null,
  location text not null check (char_length(location) between 2 and 120),
  item_date date not null default current_date,
  item_type text not null check (item_type in ('lost', 'found')),
  image_url text,
  status text not null default 'reported' check (status in ('reported', 'claimed', 'returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  claimant_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  details text not null check (char_length(details) between 8 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, claimant_id)
);

create index if not exists items_created_at_idx on public.items(created_at desc);
create index if not exists items_search_idx on public.items(item_type, status, category);
create index if not exists claims_item_id_idx on public.claims(item_id, created_at desc);

-- Keep profile rows in sync with new accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Campus member')
  )
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.claims enable row level security;

-- Profiles: signed-in users can read display names; users can only edit their own.
drop policy if exists "Profiles readable by authenticated users" on public.profiles;
create policy "Profiles readable by authenticated users"
  on public.profiles for select to authenticated using (true);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Items are publicly readable to make the community board discoverable.
drop policy if exists "Items are publicly readable" on public.items;
create policy "Items are publicly readable"
  on public.items for select to anon, authenticated using (true);
drop policy if exists "Authenticated users create own items" on public.items;
create policy "Authenticated users create own items"
  on public.items for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "Owners update own items" on public.items;
create policy "Owners update own items"
  on public.items for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Owners delete own items" on public.items;
create policy "Owners delete own items"
  on public.items for delete to authenticated using (auth.uid() = owner_id);

-- Claims: only the claimant and item owner can read them.
drop policy if exists "Claimant or item owner can read claims" on public.claims;
create policy "Claimant or item owner can read claims"
  on public.claims for select to authenticated
  using (
    auth.uid() = claimant_id or exists (
      select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid()
    )
  );

drop policy if exists "Users claim items as themselves" on public.claims;
create policy "Users claim items as themselves"
  on public.claims for insert to authenticated
  with check (
    auth.uid() = claimant_id
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id <> auth.uid() and i.status = 'reported'
    )
  );

-- Claimants may edit their own pending claim only to change details; owners may
-- approve/reject claims for their own item. Column-level restrictions are recommended
-- for production. The trigger below enforces who can change claim status.
create or replace function public.guard_claim_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_owner uuid;
begin
  select i.owner_id into item_owner from public.items i where i.id = old.item_id;

  if auth.uid() = item_owner then
    if new.item_id <> old.item_id or new.claimant_id <> old.claimant_id or new.details <> old.details then
      raise exception 'Item owners may only update claim status.';
    end if;
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Only pending claims can be approved or rejected.';
    end if;
  elsif auth.uid() = old.claimant_id then
    if old.status <> 'pending' or new.status <> old.status
       or new.item_id <> old.item_id or new.claimant_id <> old.claimant_id then
      raise exception 'Claimants may only edit details while a claim is pending.';
    end if;
  else
    raise exception 'Not allowed to update this claim.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guard_claim_update_trigger on public.claims;
create trigger guard_claim_update_trigger
  before update on public.claims
  for each row execute procedure public.guard_claim_update();

drop policy if exists "Claimant or item owner can update claims" on public.claims;
create policy "Claimant or item owner can update claims"
  on public.claims for update to authenticated
  using (
    auth.uid() = claimant_id or exists (
      select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = claimant_id or exists (
      select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid()
    )
  );

drop policy if exists "Claimants can delete own pending claims" on public.claims;
create policy "Claimants can delete own pending claims"
  on public.claims for delete to authenticated
  using (auth.uid() = claimant_id and status = 'pending');

-- Storage: create a public bucket for item photos. Public URLs mean photos are
-- viewable by anyone; do not upload IDs, faces, or private information.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view item photos" on storage.objects;
create policy "Public can view item photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'item-photos');

drop policy if exists "Users upload photos into own folder" on storage.objects;
create policy "Users upload photos into own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own photos" on storage.objects;
create policy "Users delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);
