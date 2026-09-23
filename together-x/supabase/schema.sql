-- ============================================================================
-- TOGETHER X — Supabase schema + RLS
-- Run this in Supabase SQL Editor (or `supabase db push` with this as a migration)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------
create type user_role as enum (
  'super_admin',
  'business',
  'tech_manager',
  'developer',
  'studio_manager',
  'creator'
);

create type project_type as enum ('tech', 'studio');

create type project_status as enum (
  'lead', 'meeting', 'requirement', 'tor', 'quote', 'contract',
  'kickoff', 'dev_design', 'uat',
  'delivery', 'acceptance', 'invoice', 'maintenance', 'closed'
);

create type task_status as enum ('todo', 'in_progress', 'review', 'done');

create type storage_bucket_kind as enum ('contracts_and_docs', 'artworks_and_assets');

-- ---------------------------------------------------------------------------
-- 2. USERS  (extends auth.users — do NOT store passwords here, Supabase Auth
--    already hashes/manages them in auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role user_role not null default 'developer',
  skills text[] not null default '{}',
  kudos_points integer not null default 0,
  avatar_url text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep a users row in sync whenever someone signs up via Supabase Auth
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 3. PROJECTS
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type project_type not null,
  client_name text,
  project_value numeric(14,2) default 0,
  status project_status not null default 'lead',
  owner_id uuid references public.users(id),          -- Business who created it
  tech_manager_id uuid references public.users(id),    -- assigned once past Kickoff
  studio_manager_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. PIPELINE STAGES (the 14 fixed steps — reference/lookup table)
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  step_number integer primary key,
  key project_status not null unique,
  label_th text not null,
  label_en text not null,
  phase text not null check (phase in ('pre_sales', 'execution', 'closing'))
);

insert into public.pipeline_stages (step_number, key, label_th, label_en, phase) values
  (1,  'lead',        'Lead',            'Lead',            'pre_sales'),
  (2,  'meeting',     'นัดพบลูกค้า',      'Meeting',         'pre_sales'),
  (3,  'requirement', 'เก็บ Requirement', 'Requirement',     'pre_sales'),
  (4,  'tor',         'TOR',             'TOR',             'pre_sales'),
  (5,  'quote',       'เสนอราคา',        'Quote',           'pre_sales'),
  (6,  'contract',    'เซ็นสัญญา',        'Contract',        'pre_sales'),
  (7,  'kickoff',     'Kickoff',         'Kickoff',         'execution'),
  (8,  'dev_design',  'Dev / Design',    'Dev / Design',    'execution'),
  (9,  'uat',         'UAT',             'UAT',             'execution'),
  (10, 'delivery',    'ส่งมอบงาน',        'Delivery',        'closing'),
  (11, 'acceptance',  'ลูกค้ารับงาน',     'Acceptance',      'closing'),
  (12, 'invoice',     'วางบิล',          'Invoice',         'closing'),
  (13, 'maintenance', 'Maintenance',     'Maintenance',     'closing'),
  (14, 'closed',      'ปิดงาน',          'Closed',          'closing');

-- ---------------------------------------------------------------------------
-- 5. TASKS (Quests)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.users(id),
  status task_status not null default 'todo',
  kpi_points integer not null default 0,
  github_url text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. PROFIT POOL
-- ---------------------------------------------------------------------------
create table public.profit_pool (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revenue numeric(14,2) not null default 0,
  cost numeric(14,2) not null default 0,
  profit numeric(14,2) generated always as (revenue - cost) stored,
  share_percentage jsonb not null default '{}',  -- e.g. {"tech": 40, "studio": 20, "company": 40}
  visible_to_staff boolean not null default false, -- Admin toggles what staff can see
  recorded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. VOTES & KUDOS
-- ---------------------------------------------------------------------------
create table public.kudos (
  id uuid primary key default uuid_generate_v4(),
  from_user_id uuid not null references public.users(id),
  to_user_id uuid not null references public.users(id),
  message text,
  points integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.polls (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  created_by uuid references public.users(id),
  options jsonb not null default '[]', -- [{"id":"1","label":"เชียงใหม่"}, ...]
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.poll_votes (
  id uuid primary key default uuid_generate_v4(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.users(id),
  option_id text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id) -- one vote per user per poll
);

-- Together Board (idea threads)
create table public.board_posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.users(id),
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

create table public.board_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.board_posts(id) on delete cascade,
  author_id uuid references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Showcase / Hall of Fame
create table public.showcase_items (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id),
  title text not null,
  description text,
  image_path text, -- path inside artworks_and_assets bucket
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. STORAGE BUCKETS
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('contracts_and_docs', 'contracts_and_docs', false),
  ('artworks_and_assets', 'artworks_and_assets', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. HELPER FUNCTIONS (used inside RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role() = 'super_admin';
$$;

create or replace function public.is_business_or_admin()
returns boolean language sql stable as $$
  select public.current_role() in ('super_admin','business');
$$;

create or replace function public.is_manager_or_admin()
returns boolean language sql stable as $$
  select public.current_role() in ('super_admin','tech_manager','studio_manager');
$$;

-- ---------------------------------------------------------------------------
-- 10. ENABLE RLS
-- ---------------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.projects       enable row level security;
alter table public.tasks          enable row level security;
alter table public.profit_pool    enable row level security;
alter table public.kudos          enable row level security;
alter table public.polls          enable row level security;
alter table public.poll_votes     enable row level security;
alter table public.board_posts    enable row level security;
alter table public.board_comments enable row level security;
alter table public.showcase_items enable row level security;
alter table public.pipeline_stages enable row level security;

-- ---- users -----------------------------------------------------------------
create policy "users_select_all_authenticated"
  on public.users for select
  using (auth.role() = 'authenticated');

create policy "users_update_self_or_admin"
  on public.users for update
  using (id = auth.uid() or public.is_admin());

create policy "users_admin_insert_delete"
  on public.users for insert
  with check (public.is_admin());

create policy "users_admin_delete"
  on public.users for delete
  using (public.is_admin());

-- ---- pipeline_stages (read-only reference data for everyone) --------------
create policy "pipeline_stages_read_all"
  on public.pipeline_stages for select
  using (auth.role() = 'authenticated');

-- ---- projects ---------------------------------------------------------------
-- Everyone authenticated can see project *cards* on the Kanban board.
-- Financial fields (project_value) are still on this row — front-end should
-- hide project_value for non Business/Admin/managers if you want it hidden,
-- OR split project_value into a separate view (see note at bottom of file).
create policy "projects_select_all_authenticated"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "projects_insert_business_or_admin"
  on public.projects for insert
  with check (public.is_business_or_admin());

create policy "projects_update_business_manager_or_admin"
  on public.projects for update
  using (
    public.is_admin()
    or public.is_business_or_admin()
    or public.is_manager_or_admin()
  );

create policy "projects_delete_admin_only"
  on public.projects for delete
  using (public.is_admin());

-- ---- tasks (Quests) ----------------------------------------------------------
create policy "tasks_select_all_authenticated"
  on public.tasks for select
  using (auth.role() = 'authenticated');

create policy "tasks_insert_manager_or_admin"
  on public.tasks for insert
  with check (public.is_manager_or_admin());

-- Assignee can update their own quest's status/github link; managers/admin can edit anything
create policy "tasks_update_assignee_or_manager"
  on public.tasks for update
  using (
    assignee_id = auth.uid()
    or public.is_manager_or_admin()
  );

create policy "tasks_delete_manager_or_admin"
  on public.tasks for delete
  using (public.is_manager_or_admin());

-- ---- profit_pool — THE sensitive financial table ----------------------------
-- Only Admin/Business/Managers see it at all; staff visibility further
-- filtered by visible_to_staff flag, enforced at the row level.
create policy "profit_pool_select_priveleged_or_flagged"
  on public.profit_pool for select
  using (
    public.is_admin()
    or public.is_business_or_admin()
    or public.is_manager_or_admin()
    or visible_to_staff = true
  );

create policy "profit_pool_write_admin_only"
  on public.profit_pool for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- kudos --------------------------------------------------------------
create policy "kudos_select_all_authenticated"
  on public.kudos for select
  using (auth.role() = 'authenticated');

create policy "kudos_insert_self_as_sender"
  on public.kudos for insert
  with check (from_user_id = auth.uid());

-- ---- polls & votes ---------------------------------------------------------
create policy "polls_select_all_authenticated"
  on public.polls for select using (auth.role() = 'authenticated');

create policy "polls_insert_authenticated"
  on public.polls for insert with check (auth.role() = 'authenticated');

create policy "poll_votes_select_all_authenticated"
  on public.poll_votes for select using (auth.role() = 'authenticated');

create policy "poll_votes_insert_self"
  on public.poll_votes for insert with check (user_id = auth.uid());

-- ---- together board ----------------------------------------------------------
create policy "board_posts_select_all_authenticated"
  on public.board_posts for select using (auth.role() = 'authenticated');
create policy "board_posts_insert_self"
  on public.board_posts for insert with check (author_id = auth.uid());

create policy "board_comments_select_all_authenticated"
  on public.board_comments for select using (auth.role() = 'authenticated');
create policy "board_comments_insert_self"
  on public.board_comments for insert with check (author_id = auth.uid());

-- ---- showcase -----------------------------------------------------------------
create policy "showcase_select_all_authenticated"
  on public.showcase_items for select using (auth.role() = 'authenticated');
create policy "showcase_insert_manager_or_admin"
  on public.showcase_items for insert with check (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- 11. STORAGE POLICIES
-- ---------------------------------------------------------------------------
create policy "contracts_docs_business_admin_only"
  on storage.objects for all
  using (
    bucket_id = 'contracts_and_docs'
    and public.is_business_or_admin()
  )
  with check (
    bucket_id = 'contracts_and_docs'
    and public.is_business_or_admin()
  );

create policy "artworks_read_all_write_creator_studio_admin"
  on storage.objects for select
  using (bucket_id = 'artworks_and_assets');

create policy "artworks_write_creator_studio_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'artworks_and_assets'
    and (public.is_manager_or_admin() or public.current_role() = 'creator')
  );

-- ---------------------------------------------------------------------------
-- 12. REALTIME
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.kudos;
alter publication supabase_realtime add table public.board_posts;
alter publication supabase_realtime add table public.board_comments;

-- ---------------------------------------------------------------------------
-- NOTE on hiding project_value from Developers/Creators:
-- RLS is row-level, not column-level. If Coders must NEVER see project_value
-- (as required in section 4 "RLS ป้องกันไม่ให้ Coder เห็นสัญญาการเงิน"),
-- create a view instead of querying `projects` directly from low-privilege
-- roles, e.g.:
--
--   create view public.projects_public as
--     select id, name, type, status, owner_id, tech_manager_id,
--            studio_manager_id, created_at, updated_at
--     from public.projects;
--
-- Have Developer/Creator dashboards query `projects_public`; have
-- Business/Admin/Manager dashboards query `projects` directly.
-- ---------------------------------------------------------------------------
