# Hudson

A small household system of trackers (health, meals/groceries, chores, and
more) built on one shared Supabase backend, with a future master agent
("Hudson") able to summarize across them.

This repo currently contains the **health tracker**, being rebuilt as a
standalone app (previously a Claude Artifact using `window.storage`, which
had persistence and portability problems). This is the first module on the
shared data layer, not a one-off.

## Status

First slice: the **vitals form** (steps, water, weight, blood pressure,
pulse) reading from and writing to Supabase, with per-day date navigation.
This proves the pipeline end to end. Everything else in the original
artifact (medication tracker, food logging via LLM lookup, favorites,
daily readout, exports, multi-user scorecard) is not ported yet — see
`docs/roadmap.md`-style notes in the project handoff for the full feature
list and what's next.

## Stack

- Vite + React + TypeScript
- Supabase (Postgres + `@supabase/supabase-js`) for persistence

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase project's URL
   and anon/public key (Supabase dashboard → Project Settings → API):

   ```
   cp .env.example .env
   ```

3. Run the dev server:

   ```
   npm run dev
   ```

The `users` table must already have at least one row (see schema below) —
the app loads the user list on startup and lets you switch between them
with a dropdown in the header. The last user you picked is remembered in
`localStorage`.

## Data model

Everything flows through one generic `entries` table so new trackers
(chores, expenses, etc.) don't need schema changes — just a new
`entry_type` and whatever fields belong in that entry's `data` jsonb blob.

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  entry_type text not null,           -- 'vitals', 'medication', 'food', ...
  scheduled_at timestamptz,           -- when it was supposed to happen
  logged_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  entry_type text not null,
  nickname text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Vitals are stored one `entries` row per user per calendar day
(`entry_type = 'vitals'`), keyed by a `date` field (`YYYY-MM-DD`) inside
`data`. Saving a day that already has an entry updates it in place rather
than creating duplicates.

**RLS note:** Row Level Security is on for all three tables with a
temporary "allow all" policy. That's a placeholder to satisfy Supabase,
not real access control — before this is used for anything sensitive,
add real auth and tighten the policies to check `auth.uid()`.

## Project layout

```
src/
  lib/
    supabase.ts    Supabase client, reads env vars
    types.ts       Shared TS types (HudsonUser, EntryRow, VitalsData)
    dateUtils.ts   Calendar-day helpers (YYYY-MM-DD keys)
    users.ts       fetchUsers()
    vitals.ts      fetchVitalsForDate() / saveVitals() (upsert-by-day)
  components/
    UserSwitcher.tsx
    DateNav.tsx
    VitalsForm.tsx
  App.tsx          Wires user + date state to the vitals form
```

## Migrating old artifact data

The previous Claude Artifact version stored a full JSON backup (all
logged days + favorites) via its own export feature. That format isn't
consumed by this app yet — an import path preserving old data is planned
for a future session so no historical logging is lost when moving off the
artifact.
