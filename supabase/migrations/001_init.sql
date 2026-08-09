-- Optional cloud backup schema for Storybook.
-- The app is fully functional WITHOUT Supabase (data lives in the browser's
-- IndexedDB). Run this only if you enable cloud sync / multi-device backup.
--
-- Cloud sync covers book text + metadata. Page illustrations stay local
-- (they are large binary blobs and can always be regenerated).

create table if not exists public.books (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled Book',
  status text not null default 'drafting'
    check (status in ('drafting', 'illustrating', 'ready')),
  trim_size text not null default '8.5x8.5',
  manuscript_text text not null default '',
  page_breaks jsonb not null default '[]'::jsonb,
  breaks_locked boolean not null default false,
  style jsonb not null default '{}'::jsonb,
  published jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.books enable row level security;

drop policy if exists "own books" on public.books;
create policy "own books" on public.books
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index if not exists books_owner_updated_idx
  on public.books (owner_id, updated_at desc);
