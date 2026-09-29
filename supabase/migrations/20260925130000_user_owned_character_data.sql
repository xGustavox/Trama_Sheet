alter table public.characters
  add column if not exists experience_points integer not null default 0 check (experience_points >= 0),
  add column if not exists max_hit_points smallint check (max_hit_points is null or max_hit_points >= 0),
  add column if not exists portrait_path text,
  add column if not exists details jsonb not null default '{}'::jsonb;

create table if not exists public.character_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  details jsonb not null default '{}'::jsonb,
  furthest_step smallint not null default 0 check (furthest_step between 0 and 7),
  last_step smallint not null default 0 check (last_step between 0 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_user_updated_idx on public.characters (user_id, updated_at desc);

create or replace trigger character_drafts_set_updated_at
before update on public.character_drafts
for each row execute function public.set_character_updated_at();

alter table public.character_drafts enable row level security;

create policy "Users can read their character draft"
on public.character_drafts for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create their character draft"
on public.character_drafts for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their character draft"
on public.character_drafts for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their character draft"
on public.character_drafts for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.character_drafts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-portraits',
  'character-portraits',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their character portraits"
on storage.objects for select
to authenticated
using (
  bucket_id = 'character-portraits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their character portraits"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'character-portraits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their character portraits"
on storage.objects for update
to authenticated
using (
  bucket_id = 'character-portraits'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'character-portraits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their character portraits"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'character-portraits'
  and (storage.foldername(name))[1] = auth.uid()::text
);
