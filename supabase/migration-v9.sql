-- Meu Treino v9 — migration for an existing Meu Treino database.
-- Execute once in Supabase SQL Editor. Safe to re-run.
-- Migration-safe columns for existing installations.
alter table public.exercises add column if not exists slug text;
alter table public.exercises add column if not exists secondary_muscles text;
alter table public.exercises add column if not exists movement_type text;
alter table public.exercises add column if not exists difficulty text;
alter table public.exercises add column if not exists exercise_type text;
alter table public.exercises add column if not exists image_url text;
alter table public.exercises add column if not exists video_url text;
alter table public.exercises add column if not exists active boolean not null default true;
update public.exercises set slug=lower(regexp_replace(translate(name,'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),'[^a-zA-Z0-9]+','-','g')) where slug is null or slug='';
update public.exercises set active=true where active is null;
create unique index if not exists exercises_official_slug_unique on public.exercises(slug) where is_official=true;
create unique index if not exists exercises_user_slug_unique on public.exercises(user_id,slug) where user_id is not null;

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


-- Banco inicial oficial de exercícios (idempotente).
insert into public.exercises
(name,slug,group_name,muscles,secondary_muscles,movement_type,equipment,difficulty,exercise_type,is_official,active)
select v.name,v.slug,v.group_name,v.muscles,v.secondary_muscles,v.movement_type,v.equipment,v.difficulty,v.exercise_type,true,true
from (values
  ('Supino máquina','supino-maquina','Peito','Peitoral','Tríceps, deltoide anterior','compound','Máquinas','Iniciante','Musculação'),
  ('Supino reto','supino-reto','Peito','Peitoral','Tríceps, deltoide anterior','compound','Barras','Iniciante','Musculação'),
  ('Supino inclinado','supino-inclinado','Peito','Peitoral superior','Tríceps, deltoide anterior','compound','Barras','Iniciante','Musculação'),
  ('Crucifixo máquina','crucifixo-maquina','Peito','Peitoral','Deltoide anterior','isolation','Máquinas','Iniciante','Musculação'),
  ('Crossover','crossover','Peito','Peitoral','Deltoide anterior, tríceps','isolation','Polias','Iniciante','Musculação'),
  ('Peck deck','peck-deck','Peito','Peitoral','Deltoide anterior','isolation','Máquinas','Iniciante','Musculação'),
  ('Puxada frontal','puxada-frontal','Costas','Latíssimo do dorso','Bíceps, romboides','compound','Polias','Iniciante','Musculação'),
  ('Remada máquina','remada-maquina','Costas','Dorsais, romboides','Bíceps','compound','Máquinas','Iniciante','Musculação'),
  ('Remada baixa','remada-baixa','Costas','Dorsais, romboides','Bíceps','compound','Polias','Iniciante','Musculação'),
  ('Remada unilateral','remada-unilateral','Costas','Dorsais, romboides','Bíceps','compound','Halteres','Intermediário','Musculação'),
  ('Pulldown','pulldown','Costas','Latíssimo do dorso','Bíceps','isolation','Polias','Iniciante','Musculação'),
  ('Pullover máquina','pullover-maquina','Costas','Latíssimo do dorso','Peitoral','isolation','Máquinas','Iniciante','Musculação'),
  ('Desenvolvimento máquina','desenvolvimento-maquina','Ombros','Deltoides','Tríceps','compound','Máquinas','Iniciante','Musculação'),
  ('Desenvolvimento com halteres','desenvolvimento-com-halteres','Ombros','Deltoides','Tríceps','compound','Halteres','Iniciante','Musculação'),
  ('Elevação lateral','elevacao-lateral','Ombros','Deltoide lateral','Trapézio','isolation','Halteres','Iniciante','Musculação'),
  ('Elevação frontal','elevacao-frontal','Ombros','Deltoide anterior','Peitoral superior','isolation','Halteres','Iniciante','Musculação'),
  ('Crucifixo inverso','crucifixo-inverso','Ombros','Deltoide posterior','Trapézio, romboides','isolation','Máquinas','Iniciante','Musculação'),
  ('Rosca direta','rosca-direta','Bíceps','Bíceps braquial','Braquial','isolation','Barras','Iniciante','Musculação'),
  ('Rosca alternada','rosca-alternada','Bíceps','Bíceps braquial','Braquial','isolation','Halteres','Iniciante','Musculação'),
  ('Rosca martelo','rosca-martelo','Bíceps','Braquial, braquiorradial','Bíceps','isolation','Halteres','Iniciante','Musculação'),
  ('Rosca máquina','rosca-maquina','Bíceps','Bíceps braquial','Braquial','isolation','Máquinas','Iniciante','Musculação'),
  ('Rosca Scott','rosca-scott','Bíceps','Bíceps braquial','Braquial','isolation','Máquinas','Iniciante','Musculação'),
  ('Tríceps máquina','triceps-maquina','Tríceps','Tríceps braquial','Deltoide anterior','isolation','Máquinas','Iniciante','Musculação'),
  ('Tríceps pulley','triceps-pulley','Tríceps','Tríceps braquial','Anconeu','isolation','Polias','Iniciante','Musculação'),
  ('Tríceps corda','triceps-corda','Tríceps','Tríceps braquial','Anconeu','isolation','Polias','Iniciante','Musculação'),
  ('Tríceps testa','triceps-testa','Tríceps','Tríceps braquial','Deltoide anterior','isolation','Barras','Intermediário','Musculação'),
  ('Tríceps francês','triceps-frances','Tríceps','Tríceps braquial','Anconeu','isolation','Halteres','Iniciante','Musculação'),
  ('Leg press','leg-press','Quadríceps','Quadríceps','Glúteos, posteriores','compound','Máquinas','Iniciante','Musculação'),
  ('Cadeira extensora','cadeira-extensora','Quadríceps','Quadríceps','—','isolation','Máquinas','Iniciante','Musculação'),
  ('Agachamento','agachamento','Quadríceps','Quadríceps','Glúteos, posteriores','compound','Barras','Intermediário','Musculação'),
  ('Agachamento no Smith','agachamento-no-smith','Quadríceps','Quadríceps','Glúteos, posteriores','compound','Máquinas','Iniciante','Musculação'),
  ('Hack squat','hack-squat','Quadríceps','Quadríceps','Glúteos, posteriores','compound','Máquinas','Intermediário','Musculação'),
  ('Cadeira flexora','cadeira-flexora','Posterior de coxa','Isquiotibiais','Glúteos','isolation','Máquinas','Iniciante','Musculação'),
  ('Mesa flexora','mesa-flexora','Posterior de coxa','Isquiotibiais','Glúteos','isolation','Máquinas','Iniciante','Musculação'),
  ('Stiff','stiff','Posterior de coxa','Isquiotibiais, glúteos','Eretores da coluna','compound','Barras','Intermediário','Musculação'),
  ('Levantamento terra romeno','levantamento-terra-romeno','Posterior de coxa','Isquiotibiais, glúteos','Eretores da coluna','compound','Barras','Intermediário','Musculação'),
  ('Cadeira abdutora','cadeira-abdutora','Glúteos','Glúteo médio e mínimo','Glúteo máximo','isolation','Máquinas','Iniciante','Musculação'),
  ('Hip thrust','hip-thrust','Glúteos','Glúteo máximo','Posteriores','compound','Máquinas','Iniciante','Musculação'),
  ('Glúteo máquina','gluteo-maquina','Glúteos','Glúteo máximo','Posteriores','isolation','Máquinas','Iniciante','Musculação'),
  ('Elevação pélvica','elevacao-pelvica','Glúteos','Glúteo máximo','Posteriores','compound','Barras','Iniciante','Musculação'),
  ('Cadeira adutora','cadeira-adutora','Adutores','Adutores','Glúteos','isolation','Máquinas','Iniciante','Musculação'),
  ('Panturrilha sentado','panturrilha-sentado','Panturrilhas','Sóleo','Gastrocnêmio','isolation','Máquinas','Iniciante','Musculação'),
  ('Panturrilha em pé','panturrilha-em-pe','Panturrilhas','Gastrocnêmio','Sóleo','isolation','Máquinas','Iniciante','Musculação'),
  ('Panturrilha no leg press','panturrilha-no-leg-press','Panturrilhas','Gastrocnêmio, sóleo','—','isolation','Máquinas','Iniciante','Musculação'),
  ('Abdominal na máquina','abdominal-na-maquina','Abdômen','Reto abdominal','Oblíquos','isolation','Máquinas','Iniciante','Musculação'),
  ('Pallof Press','pallof-press','Abdômen','Core','Oblíquos','isolation','Polias','Iniciante','Musculação')
) as v(name,slug,group_name,muscles,secondary_muscles,movement_type,equipment,difficulty,exercise_type)
where not exists (
  select 1 from public.exercises e where e.is_official=true and e.slug=v.slug
);


-- Keep official exercises readable without exposing user-owned records.
drop policy if exists "official_exercises_read" on public.exercises;
create policy "official_exercises_read" on public.exercises
for select using (is_official=true or user_id=auth.uid());


-- Diagnóstico final: o resultado esperado é pelo menos 46 exercícios oficiais ativos.
select count(*) as official_exercises
from public.exercises
where is_official=true and active=true;
