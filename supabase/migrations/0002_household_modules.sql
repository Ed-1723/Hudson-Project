-- Hudson: household modules beyond health (tasks, storage, medications
-- list, exercise, meal planning). Reference/planning data gets its own
-- tables here, rather than being squeezed into entries.data jsonb -- these
-- are things you create, edit, and query by field (due_date, expires_on,
-- container_code), not point-in-time log events like entries already
-- handles well for vitals/meds-taken/food.
--
-- RLS is enabled on every table below with the same temporary "allow all"
-- policy already used on users/entries/favorites -- a placeholder to
-- satisfy Supabase, not real access control. Tighten with auth.uid() checks
-- before this matters for anything sensitive, same caveat as before.

-- ============================================================
-- Doctors + Medications list (separate from the AM/PM/Bedtime
-- adherence tracker already in entries -- this is the reference list:
-- what you're taking, dosage, who prescribed it, refill status)
-- ============================================================

create table doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,              -- e.g. "Dr. R Ramirez, MD"
  specialty text,
  phone text,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  name text not null,              -- e.g. "spironolactone"
  strength text,                   -- e.g. "25 mg tablet"
  directions text,                 -- e.g. "Take one tablet by mouth daily. Take with food."
  doctor_id uuid references doctors(id),
  quantity_dispensed integer,      -- e.g. 90
  refills_remaining integer,
  last_filled_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_medications_user on medications(user_id);

-- ============================================================
-- Household tasks (chores, home/vehicle maintenance, projects)
-- Shared household data, not owned by one user -- assigned_to is who's
-- responsible (nullable: some chores are "either of us"), created_by is
-- just who added it.
-- ============================================================

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in ('chore', 'home_maintenance', 'vehicle_maintenance', 'project')),
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly', 'quarterly', 'annual')),
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  assigned_to uuid references users(id),
  completed_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_assigned_to on tasks(assigned_to);

-- ============================================================
-- Storage tracker (totes/boxes in the rack system)
-- Modeled directly on the Tote_Inventory_System workbook already in use:
-- Areas (pick-list), Containers (one row per physical container, human-
-- readable container_code for QR/NFC tags), Items (what's inside).
-- ============================================================

create table storage_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,       -- e.g. "Garage Rack 1", "Attic"
  created_at timestamptz not null default now()
);

create table storage_containers (
  id uuid primary key default gen_random_uuid(),
  container_code text not null unique,  -- e.g. "R1-1-1", "ATTIC-B1" -- the physical label
  area_id uuid references storage_areas(id),
  container_type text,             -- e.g. "Tote", "Box"
  rack text,
  shelf_row text,
  slot text,
  label text,
  description text,
  category text,
  sub_category text,
  date_packed date,
  photo_path text,                 -- path in the storage-photos bucket
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table storage_items (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references storage_containers(id),
  name text not null,
  category text,
  sub_category text,
  quantity integer not null default 1,
  notes text,
  date_added date,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index idx_storage_containers_area on storage_containers(area_id);
create index idx_storage_items_container on storage_items(container_id);

-- ============================================================
-- Exercise (routines are the plan; actually doing a workout logs an
-- entries row with entry_type='workout' referencing the routine --
-- same plan-table/performance-in-entries split as medications)
-- ============================================================

create table exercise_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  name text not null,              -- e.g. "Push Day", "5k training"
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references exercise_routines(id),
  name text not null,
  target_sets integer,
  target_reps integer,
  target_weight numeric,
  order_index integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_routine_exercises_routine on routine_exercises(routine_id);

-- ============================================================
-- Meal planning: recipes, weekly plans, grocery lists, pantry inventory
-- ============================================================

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instructions text,
  servings integer,
  -- Nutrition cached once per recipe (via the same Claude lookup the food
  -- log already uses) so logging a recipe you've made before is instant.
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  sodium_mg numeric,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id),
  name text not null,
  quantity numeric,
  unit text,
  notes text,
  order_index integer not null default 0
);

create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plans(id),
  date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references recipes(id),
  freeform_text text              -- e.g. "leftovers", "eat out" when there's no recipe
);

create table grocery_lists (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid references meal_plans(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid not null references grocery_lists(id),
  name text not null,
  quantity numeric,
  unit text,
  checked boolean not null default false,
  source text not null default 'manual' check (source in ('recipe', 'manual')),
  recipe_id uuid references recipes(id)
);

create table food_inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric,
  unit text,
  location text,                  -- e.g. "pantry", "fridge", "freezer"
  expires_on date,
  -- Optional, filled in via the same label-photo lookup the food log uses.
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  sodium_mg numeric,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id);
create index idx_meal_plan_items_plan on meal_plan_items(meal_plan_id);
create index idx_meal_plan_items_date on meal_plan_items(date);
create index idx_grocery_list_items_list on grocery_list_items(grocery_list_id);

-- ============================================================
-- RLS: same temporary "allow all" placeholder as the original schema
-- ============================================================

alter table doctors enable row level security;
alter table medications enable row level security;
alter table tasks enable row level security;
alter table storage_areas enable row level security;
alter table storage_containers enable row level security;
alter table storage_items enable row level security;
alter table exercise_routines enable row level security;
alter table routine_exercises enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_plans enable row level security;
alter table meal_plan_items enable row level security;
alter table grocery_lists enable row level security;
alter table grocery_list_items enable row level security;
alter table food_inventory enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'doctors', 'medications', 'tasks',
    'storage_areas', 'storage_containers', 'storage_items',
    'exercise_routines', 'routine_exercises',
    'recipes', 'recipe_ingredients',
    'meal_plans', 'meal_plan_items',
    'grocery_lists', 'grocery_list_items',
    'food_inventory'
  ]
  loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'allow all ' || t
    ) then
      execute format('create policy %I on %I for all using (true) with check (true)', 'allow all ' || t, t);
    end if;
  end loop;
end $$;

-- ============================================================
-- Storage bucket for container photos
-- ============================================================

insert into storage.buckets (id, name, public)
values ('storage-photos', 'storage-photos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'allow all storage-photos select') then
    create policy "allow all storage-photos select" on storage.objects for select using (bucket_id = 'storage-photos');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'allow all storage-photos insert') then
    create policy "allow all storage-photos insert" on storage.objects for insert with check (bucket_id = 'storage-photos');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'allow all storage-photos update') then
    create policy "allow all storage-photos update" on storage.objects for update using (bucket_id = 'storage-photos');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'allow all storage-photos delete') then
    create policy "allow all storage-photos delete" on storage.objects for delete using (bucket_id = 'storage-photos');
  end if;
end $$;
