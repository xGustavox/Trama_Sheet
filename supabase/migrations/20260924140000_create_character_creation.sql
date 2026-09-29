create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  source_page smallint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.character_classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  source_page smallint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.backgrounds (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  source_page smallint not null,
  parent_background_id uuid references public.backgrounds (id),
  created_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  level smallint not null default 1 check (level between 1 and 20),
  race_id uuid references public.races (id),
  character_class_id uuid references public.character_classes (id),
  background_id uuid references public.backgrounds (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_abilities (
  character_id uuid primary key references public.characters (id) on delete cascade,
  strength smallint check (strength between 1 and 30),
  dexterity smallint check (dexterity between 1 and 30),
  constitution smallint check (constitution between 1 and 30),
  intelligence smallint check (intelligence between 1 and 30),
  wisdom smallint check (wisdom between 1 and 30),
  charisma smallint check (charisma between 1 and 30),
  updated_at timestamptz not null default now()
);

create index if not exists characters_user_id_idx on public.characters (user_id);

create or replace function public.set_character_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_character_updated_at();

create or replace trigger character_abilities_set_updated_at
before update on public.character_abilities
for each row execute function public.set_character_updated_at();

alter table public.races enable row level security;
alter table public.character_classes enable row level security;
alter table public.backgrounds enable row level security;
alter table public.characters enable row level security;
alter table public.character_abilities enable row level security;

create policy "Reference data is readable by everyone"
on public.races for select
to anon, authenticated
using (true);

create policy "Class reference data is readable by everyone"
on public.character_classes for select
to anon, authenticated
using (true);

create policy "Background reference data is readable by everyone"
on public.backgrounds for select
to anon, authenticated
using (true);

create policy "Users can read their characters"
on public.characters for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create their characters"
on public.characters for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their characters"
on public.characters for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their characters"
on public.characters for delete
to authenticated
using (user_id = auth.uid());

create policy "Users can read their character abilities"
on public.character_abilities for select
to authenticated
using (
  exists (
    select 1
    from public.characters
    where characters.id = character_abilities.character_id
      and characters.user_id = auth.uid()
  )
);

create policy "Users can create their character abilities"
on public.character_abilities for insert
to authenticated
with check (
  exists (
    select 1
    from public.characters
    where characters.id = character_abilities.character_id
      and characters.user_id = auth.uid()
  )
);

create policy "Users can update their character abilities"
on public.character_abilities for update
to authenticated
using (
  exists (
    select 1
    from public.characters
    where characters.id = character_abilities.character_id
      and characters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.characters
    where characters.id = character_abilities.character_id
      and characters.user_id = auth.uid()
  )
);

insert into public.races (slug, name, source_page)
values
  ('anao', 'Anão', 18),
  ('elfo', 'Elfo', 21),
  ('halfling', 'Halfling', 26),
  ('humano', 'Humano', 29),
  ('draconato', 'Draconato', 32),
  ('gnomo', 'Gnomo', 35),
  ('meio-elfo', 'Meio-elfo', 38),
  ('meio-orc', 'Meio-orc', 40),
  ('tiefling', 'Tiefling', 42)
on conflict (slug) do update
set name = excluded.name,
    source_page = excluded.source_page;

insert into public.character_classes (slug, name, source_page)
values
  ('barbaro', 'Bárbaro', 46),
  ('bardo', 'Bardo', 51),
  ('bruxo', 'Bruxo', 57),
  ('clerigo', 'Clérigo', 63),
  ('druida', 'Druida', 69),
  ('feiticeiro', 'Feiticeiro', 75),
  ('guerreiro', 'Guerreiro', 80),
  ('ladino', 'Ladino', 86),
  ('mago', 'Mago', 92),
  ('monge', 'Monge', 99),
  ('paladino', 'Paladino', 104),
  ('patrulheiro', 'Patrulheiro', 110)
on conflict (slug) do update
set name = excluded.name,
    source_page = excluded.source_page;

insert into public.backgrounds (slug, name, source_page)
values
  ('acolito', 'Acólito', 127),
  ('artesao-de-guilda', 'Artesão de Guilda', 128),
  ('artista', 'Artista', 129),
  ('charlatao', 'Charlatão', 131),
  ('criminoso', 'Criminoso', 132),
  ('eremita', 'Eremita', 133),
  ('forasteiro', 'Forasteiro', 134),
  ('heroi-do-povo', 'Herói do Povo', 135),
  ('marinheiro', 'Marinheiro', 136),
  ('nobre', 'Nobre', 137),
  ('orfao', 'Órfão', 138),
  ('sabio', 'Sábio', 139),
  ('soldado', 'Soldado', 140)
on conflict (slug) do update
set name = excluded.name,
    source_page = excluded.source_page;

insert into public.backgrounds (slug, name, source_page, parent_background_id)
values
  ('mercador-de-guilda', 'Mercador de Guilda', 129, (select id from public.backgrounds where slug = 'artesao-de-guilda')),
  ('gladiador', 'Gladiador', 130, (select id from public.backgrounds where slug = 'artista')),
  ('espiao', 'Espião', 133, (select id from public.backgrounds where slug = 'criminoso')),
  ('pirata', 'Pirata', 137, (select id from public.backgrounds where slug = 'marinheiro')),
  ('cavaleiro', 'Cavaleiro', 138, (select id from public.backgrounds where slug = 'nobre'))
on conflict (slug) do update
set name = excluded.name,
    source_page = excluded.source_page,
    parent_background_id = excluded.parent_background_id;
