-- All application writes go through a small, checked RPC surface.
-- Privileged implementations live outside the schemas exposed by PostgREST.
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon;
grant usage on schema crm_private to authenticated, service_role;

create type public.user_role as enum ('dispatcher', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (display_name ~ '[^[:space:]]'),
  role public.user_role not null
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '[^[:space:]]'),
  address text not null check (address ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (title ~ '[^[:space:]]'),
  description text not null default '',
  project_id uuid not null references public.projects(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  assignee_name text not null,
  status public.task_status not null default 'new',
  author_id uuid not null references public.profiles(id) on delete restrict,
  author_name text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.task_status_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text,
  constraint meaningful_rework_comment check (to_status <> 'rework' or (comment is not null and comment ~ '[^[:space:]]'))
);
create index tasks_assignee_project_active_idx on public.tasks(assignee_id, project_id) where deleted_at is null;
create index tasks_project_active_idx on public.tasks(project_id) where deleted_at is null;
create index history_task_idx on public.task_status_history(task_id, id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create function crm_private.is_dispatcher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'dispatcher');
$$;
create function crm_private.project_active(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.projects where id = p_project_id and deleted_at is null);
$$;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select crm_private.is_dispatcher()));
create policy tasks_read on public.tasks for select to authenticated
using (deleted_at is null and crm_private.project_active(project_id)
  and ((select crm_private.is_dispatcher()) or assignee_id = (select auth.uid())));
create policy projects_read on public.projects for select to authenticated
using (deleted_at is null and ((select crm_private.is_dispatcher()) or exists (
  select 1 from public.tasks t where t.project_id = projects.id and t.assignee_id = (select auth.uid()) and t.deleted_at is null
)));
create policy history_read on public.task_status_history for select to authenticated
using (exists(select 1 from public.tasks t where t.id = task_status_history.task_id));

revoke all on public.profiles, public.projects, public.tasks, public.task_status_history from public, anon, authenticated;
grant select on public.profiles, public.projects, public.tasks, public.task_status_history to authenticated;
grant all on public.profiles, public.projects, public.tasks, public.task_status_history to service_role;
grant all on sequence public.task_status_history_id_seq to service_role;
revoke all on sequence public.task_status_history_id_seq from public, anon, authenticated;

create function crm_private.actor(p_dispatcher_only boolean default false) returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare v_actor public.profiles;
begin
  select * into v_actor from public.profiles where id = (select auth.uid());
  if v_actor.id is null or (p_dispatcher_only and v_actor.role <> 'dispatcher') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

-- One lock order for task mutations and project deletion: parent(s), then task.
-- If the task moved while waiting, reject; do not operate under the wrong parent lock.
create function crm_private.lock_task(p_task_id uuid, p_new_project_id uuid default null) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_old_project uuid;
begin
  select project_id into v_old_project from public.tasks where id = p_task_id and deleted_at is null;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform id from public.projects where id in (v_old_project, p_new_project_id) order by id for update;
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.project_id <> v_old_project then raise exception 'STALE_TASK' using errcode = '40001'; end if;
  if v_task.deleted_at is not null or not crm_private.project_active(v_old_project)
     or (p_new_project_id is not null and not crm_private.project_active(p_new_project_id)) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_task;
end;
$$;

create function crm_private.create_project(p_name text, p_address text) returns public.projects
language plpgsql security definer set search_path = '' as $$
declare v_project public.projects;
begin
  perform crm_private.actor(true);
  insert into public.projects(name,address) values (btrim(p_name),btrim(p_address)) returning * into v_project;
  return v_project;
end;
$$;
create function crm_private.update_project(p_project_id uuid, p_name text, p_address text) returns public.projects
language plpgsql security definer set search_path = '' as $$
declare v_project public.projects;
begin
  perform crm_private.actor(true);
  update public.projects set name=btrim(p_name), address=btrim(p_address)
    where id=p_project_id and deleted_at is null returning * into v_project;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  return v_project;
end;
$$;
create function crm_private.delete_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform crm_private.actor(true);
  perform id from public.projects where id=p_project_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  update public.projects set deleted_at=now() where id=p_project_id;
  update public.tasks set deleted_at=now() where project_id=p_project_id and deleted_at is null;
end;
$$;

create function crm_private.create_task(p_title text, p_description text, p_project_id uuid, p_assignee_id uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_assignee public.profiles; v_task public.tasks;
begin
  v_actor := crm_private.actor(true);
  perform id from public.projects where id=p_project_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_assignee from public.profiles where id=p_assignee_id and role='executor';
  if not found then raise exception 'INVALID_ASSIGNEE' using errcode = '22023'; end if;
  insert into public.tasks(title,description,project_id,assignee_id,assignee_name,author_id,author_name)
    values (btrim(p_title),coalesce(p_description,''),p_project_id,p_assignee_id,v_assignee.display_name,v_actor.id,v_actor.display_name)
    returning * into v_task;
  insert into public.task_status_history(task_id,actor_id,actor_name,from_status,to_status)
    values(v_task.id,v_actor.id,v_actor.display_name,null,'new');
  return v_task;
end;
$$;
create function crm_private.update_task(p_task_id uuid, p_title text, p_description text, p_project_id uuid, p_assignee_id uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_assignee public.profiles;
begin
  perform crm_private.actor(true);
  if p_project_id is null then raise exception 'INVALID_PROJECT' using errcode = '22023'; end if;
  v_task := crm_private.lock_task(p_task_id, p_project_id);
  select * into v_assignee from public.profiles where id=p_assignee_id and role='executor';
  if not found then raise exception 'INVALID_ASSIGNEE' using errcode = '22023'; end if;
  update public.tasks set title=btrim(p_title), description=coalesce(p_description,''),
    project_id=p_project_id, assignee_id=p_assignee_id, assignee_name=v_assignee.display_name
    where id=p_task_id returning * into v_task;
  return v_task;
end;
$$;
create function crm_private.delete_task(p_task_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform crm_private.actor(true);
  perform crm_private.lock_task(p_task_id);
  update public.tasks set deleted_at=now() where id=p_task_id;
end;
$$;
create function crm_private.change_task_status(p_task_id uuid, p_expected_status public.task_status,
  p_target_status public.task_status, p_comment text default null) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_task public.tasks; v_from public.task_status; v_allowed boolean; v_comment text;
begin
  v_actor := crm_private.actor();
  -- Check visibility before locking so a foreign ID never leaks state or existence.
  if not exists(select 1 from public.tasks where id=p_task_id and deleted_at is null
    and (v_actor.role='dispatcher' or assignee_id=v_actor.id)) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  v_task := crm_private.lock_task(p_task_id);
  if v_actor.role='executor' and v_task.assignee_id <> v_actor.id then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_status is null or v_task.status <> p_expected_status then
    raise exception 'STALE_STATUS' using errcode = '40001';
  end if;
  v_allowed := case v_actor.role
    when 'dispatcher' then v_task.status='review' and p_target_status in ('accepted','rework')
    when 'executor' then (v_task.status in ('new','rework') and p_target_status='in_progress')
      or (v_task.status='in_progress' and p_target_status='review')
    else false end;
  if not coalesce(v_allowed,false) then raise exception 'INVALID_TRANSITION' using errcode = '22023'; end if;
  if p_target_status='rework' and (p_comment is null or p_comment !~ '[^[:space:]]') then
    raise exception 'COMMENT_REQUIRED' using errcode = '22023';
  end if;
  v_comment := case when p_comment ~ '[^[:space:]]' then btrim(p_comment) else null end;
  v_from := v_task.status;
  update public.tasks set status=p_target_status where id=p_task_id returning * into v_task;
  insert into public.task_status_history(task_id,actor_id,actor_name,from_status,to_status,comment)
    values(p_task_id,v_actor.id,v_actor.display_name,v_from,p_target_status,v_comment);
  return v_task;
end;
$$;

-- Non-privileged, typed public API wrappers. They cannot accept author, time or arbitrary columns.
create function public.create_project(p_name text,p_address text) returns public.projects
language sql security invoker set search_path='' as $$ select crm_private.create_project(p_name,p_address); $$;
create function public.update_project(p_project_id uuid,p_name text,p_address text) returns public.projects
language sql security invoker set search_path='' as $$ select crm_private.update_project(p_project_id,p_name,p_address); $$;
create function public.delete_project(p_project_id uuid) returns void
language sql security invoker set search_path='' as $$ select crm_private.delete_project(p_project_id); $$;
create function public.create_task(p_title text,p_description text,p_project_id uuid,p_assignee_id uuid) returns public.tasks
language sql security invoker set search_path='' as $$ select crm_private.create_task(p_title,p_description,p_project_id,p_assignee_id); $$;
create function public.update_task(p_task_id uuid,p_title text,p_description text,p_project_id uuid,p_assignee_id uuid) returns public.tasks
language sql security invoker set search_path='' as $$ select crm_private.update_task(p_task_id,p_title,p_description,p_project_id,p_assignee_id); $$;
create function public.delete_task(p_task_id uuid) returns void
language sql security invoker set search_path='' as $$ select crm_private.delete_task(p_task_id); $$;
create function public.change_task_status(p_task_id uuid,p_expected_status public.task_status,p_target_status public.task_status,p_comment text default null) returns public.tasks
language sql security invoker set search_path='' as $$ select crm_private.change_task_status(p_task_id,p_expected_status,p_target_status,p_comment); $$;

revoke all on all functions in schema crm_private from public,anon,authenticated;
grant execute on function crm_private.is_dispatcher(),crm_private.project_active(uuid) to authenticated;
-- Only the seven checked mutations are callable by the public invoker wrappers.
do $$
declare r record;
begin
  for r in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','crm_private') and p.proname in
      ('create_project','update_project','delete_project','create_task','update_task','delete_task','change_task_status')
  loop
    execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',r.nspname,r.proname,r.args);
    execute format('grant execute on function %I.%I(%s) to authenticated,service_role',r.nspname,r.proname,r.args);
  end loop;
end $$;

comment on schema crm_private is 'Never add this schema to the Supabase Data API exposed schemas.';
comment on table public.task_status_history is 'Append-only for application users; only checked business functions create events. Administrative SQL remains privileged.';
