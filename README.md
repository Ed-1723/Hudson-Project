# Hudson

A small household system of trackers (health, meals/groceries, chores, and
more) built on one shared Supabase backend, with a future master agent
("Hudson") able to summarize across them.

This repo currently contains the **health tracker**, being rebuilt as a
standalone app (previously a Claude Artifact using `window.storage`, which
had persistence and portability problems). This is the first module on the
shared data layer, not a one-off.

## Status

Ported so far, all reading from and writing to Supabase with per-day date
navigation:

- **Vitals** — steps, water, weight, blood pressure, pulse. Water also has
  quick-add buttons (12/32/40 oz) that save immediately, for logging a
  bottle refill without typing a running total.
- **Medications** — AM/PM/Bedtime taps, with manual time correction for
  backfilling.
- **Food log** — either a free-text description (Claude + web search
  estimates calories/protein/carbs/fat/sodium) or a nutrition label photo
  (Claude reads the label's per-serving values directly, scaled by a
  servings count you enter) — both return a confidence level and source
  note, and compound entries sum their components.

Not yet ported: favorites, the daily readout view, exports (doctor report /
backup JSON), and the multi-user household scorecard.

## Stack

- Vite + React + TypeScript
- Supabase (Postgres + `@supabase/supabase-js`) for persistence

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase project's URL
   and publishable key (Supabase dashboard → Project Settings → API →
   Connect, or the API Keys page — this is the client-safe key, previously
   called the "anon" key):

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

## Food lookup (Supabase Edge Function)

The food log calls Claude server-side via a Supabase Edge Function
(`supabase/functions/food-lookup`), so the Anthropic API key never reaches
the browser. This needs a one-time deploy:

1. Install the Supabase CLI and log in:

   ```
   npm install -g supabase
   supabase login
   ```

2. Link this repo to your Supabase project (find the project ref in the
   dashboard URL: `supabase.com/dashboard/project/<ref>`):

   ```
   supabase link --project-ref <your-project-ref>
   ```

3. Set your Anthropic API key as a function secret (from
   console.anthropic.com — this is a real secret, never commit it):

   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Deploy the function:

   ```
   supabase functions deploy food-lookup
   ```

After that, the app's food log will call it automatically via
`supabase.functions.invoke('food-lookup', ...)` using the same publishable
key already in `.env`. Re-run step 4 any time `supabase/functions/food-lookup/index.ts`
changes (e.g. after pulling an update to it) — just:

```
supabase functions deploy food-lookup
```

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

Medications are one `entries` row per user/day/slot (`entry_type =
'medication'`, `data.slot` is `AM`/`PM`/`Bedtime`); `logged_at` is the
actual time taken, editable for backfilling. Food entries
(`entry_type = 'food'`) store the typed description plus the full nutrition
estimate (per-component breakdown, total, confidence, source note) — one
row per logged item, not per day, since a day can have several.

**RLS note:** Row Level Security is on for all three tables with a
temporary "allow all" policy. That's a placeholder to satisfy Supabase,
not real access control — before this is used for anything sensitive,
add real auth and tighten the policies to check `auth.uid()`.

## Project layout

```
src/
  lib/
    supabase.ts     Supabase client, reads env vars
    types.ts        Shared TS types (HudsonUser, EntryRow, Vitals/Medication/FoodData)
    dateUtils.ts    Calendar-day + time helpers
    users.ts        fetchUsers()
    vitals.ts       fetchVitalsForDate() / saveVitals() (upsert-by-day)
    medications.ts  fetchMedicationsForDate() / markTaken() / markUntaken() / updateTakenTime()
    food.ts         lookupNutrition() (calls the Edge Function) / fetchFoodForDate() / logFood() / deleteFoodEntry()
  components/
    UserSwitcher.tsx
    DateNav.tsx
    VitalsForm.tsx
    MedicationTracker.tsx
    FoodLog.tsx
  App.tsx           Wires user + date state to each tracker
supabase/
  functions/
    food-lookup/    Edge Function: calls Claude (+ web search) for nutrition estimates
```

## Migrating old artifact data

The previous Claude Artifact version stored a full JSON backup (all
logged days + favorites) via its own export feature. That format isn't
consumed by this app yet — an import path preserving old data is planned
for a future session so no historical logging is lost when moving off the
artifact.
