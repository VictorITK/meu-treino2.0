-- Meu Treino: esquema inicial Supabase/PostgreSQL.
-- Execute no SQL Editor do Supabase antes de usar a aplicação.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  height numeric(4,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  group_name text,
  muscles text,
  equipment text,
  description text,
  instructions text,
  is_official boolean not null default false,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  youtube_url text not null,
  youtube_video_id text not null,
  title text,
  channel text,
  thumbnail text,
  origin text default 'youtube',
  status text not null default 'pendente de verificação',
  created_at timestamptz not null default now(),
  last_verified_at timestamptz
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  workout_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null default 0,
  sets integer not null default 3,
  min_reps integer not null default 8,
  max_reps integer not null default 12,
  rir numeric(3,1),
  rest_seconds integer not null default 40,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min integer,
  cardio jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  set_number integer not null,
  weight numeric,
  reps integer,
  rir numeric(3,1),
  rest_seconds integer not null default 40
);

create table if not exists public.weight_records (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  weight numeric(6,2) not null,
  measured_date date not null,
  measured_time time,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cardio_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  activity_type text not null,
  duration_min numeric,
  distance_km numeric,
  avg_pace numeric,
  avg_speed numeric,
  calories numeric,
  avg_heart_rate numeric,
  started_at timestamptz,
  gps_route jsonb,
  source text default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  storage_path text,
  photo_date date not null,
  photo_type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  unique(user_id, exercise_id)
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generated_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  request jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  record_type text not null,
  record_id uuid,
  record_data jsonb not null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  record_type text,
  record_id uuid,
  action text not null check (action in ('CREATE','UPDATE','DELETE','RESTORE','PERMANENT_DELETE')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.user_snapshots enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_videos enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.weight_records enable row level security;
alter table public.cardio_records enable row level security;
alter table public.photos enable row level security;
alter table public.favorites enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_generated_workouts enable row level security;
alter table public.trash enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

-- User-owned tables
do $$ declare t text; begin
for t in select unnest(array['profiles','user_snapshots','exercises','exercise_videos','workouts','workout_sessions','weight_records','cardio_records','photos','favorites','ai_conversations','ai_generated_workouts','trash','audit_logs','settings']) loop
  execute format('drop policy if exists "owner_select" on public.%I',t);
  execute format('drop policy if exists "owner_insert" on public.%I',t);
  execute format('drop policy if exists "owner_update" on public.%I',t);
  execute format('drop policy if exists "owner_delete" on public.%I',t);
  execute format('create policy "owner_select" on public.%I for select using (user_id = auth.uid() OR id = auth.uid())',t);
  execute format('create policy "owner_insert" on public.%I for insert with check (user_id = auth.uid() OR id = auth.uid())',t);
  execute format('create policy "owner_update" on public.%I for update using (user_id = auth.uid() OR id = auth.uid()) with check (user_id = auth.uid() OR id = auth.uid())',t);
  execute format('create policy "owner_delete" on public.%I for delete using (user_id = auth.uid() OR id = auth.uid())',t);
end loop;
end $$;

-- workout_exercises and workout_sets derive ownership through parent rows.
create policy "workout_exercises_owner" on public.workout_exercises for all
using (exists(select 1 from public.workouts w where w.id=workout_id and w.user_id=auth.uid()))
with check (exists(select 1 from public.workouts w where w.id=workout_id and w.user_id=auth.uid()));

create policy "workout_sets_owner" on public.workout_sets for all
using (exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=auth.uid()))
with check (exists(select 1 from public.workout_sessions s where s.id=session_id and s.user_id=auth.uid()));

-- Official exercises are readable by everyone, but only service/admin can mutate them.
create policy "official_exercises_read" on public.exercises for select using (is_official=true or user_id=auth.uid());
