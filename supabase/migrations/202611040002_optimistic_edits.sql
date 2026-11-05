-- Prevent a stale edit from undoing another dispatcher's reassignment or move.
alter table public.projects add column revision integer not null default 1 check (revision > 0);
alter table public.tasks add column revision integer not null default 1 check (revision > 0);

create function crm_private.bump_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function crm_private.bump_revision() from public,anon,authenticated;
create trigger projects_revision before update on public.projects
for each row execute function crm_private.bump_revision();
create trigger tasks_revision before update on public.tasks
for each row execute function crm_private.bump_revision();

drop function public.update_project(uuid,text,text);
drop function crm_private.update_project(uuid,text,text);
drop function public.update_task(uuid,text,text,uuid,uuid);
drop function crm_private.update_task(uuid,text,text,uuid,uuid);

create function crm_private.update_project(p_project_id uuid,p_name text,p_address text,p_expected_revision integer)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare v_project public.projects;
begin
  perform crm_private.actor(true);
  select * into v_project from public.projects where id=p_project_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_project.revision is distinct from p_expected_revision then
    raise exception 'STALE_RECORD' using errcode = '40001';
  end if;
  update public.projects set name=btrim(p_name),address=btrim(p_address)
    where id=p_project_id returning * into v_project;
  return v_project;
end;
$$;

create function crm_private.update_task(p_task_id uuid,p_title text,p_description text,p_project_id uuid,p_assignee_id uuid,p_expected_revision integer)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_assignee public.profiles;
begin
  perform crm_private.actor(true);
  if p_project_id is null then raise exception 'INVALID_PROJECT' using errcode = '22023'; end if;
  v_task := crm_private.lock_task(p_task_id,p_project_id);
  if v_task.revision is distinct from p_expected_revision then
    raise exception 'STALE_RECORD' using errcode = '40001';
  end if;
  select * into v_assignee from public.profiles where id=p_assignee_id and role='executor';
  if not found then raise exception 'INVALID_ASSIGNEE' using errcode = '22023'; end if;
  update public.tasks set title=btrim(p_title),description=coalesce(p_description,''),
    project_id=p_project_id,assignee_id=p_assignee_id,assignee_name=v_assignee.display_name
    where id=p_task_id returning * into v_task;
  return v_task;
end;
$$;

create function public.update_project(p_project_id uuid,p_name text,p_address text,p_expected_revision integer)
returns public.projects language sql security invoker set search_path = '' as $$
  select crm_private.update_project(p_project_id,p_name,p_address,p_expected_revision);
$$;
create function public.update_task(p_task_id uuid,p_title text,p_description text,p_project_id uuid,p_assignee_id uuid,p_expected_revision integer)
returns public.tasks language sql security invoker set search_path = '' as $$
  select crm_private.update_task(p_task_id,p_title,p_description,p_project_id,p_assignee_id,p_expected_revision);
$$;

revoke all on function public.update_project(uuid,text,text,integer),crm_private.update_project(uuid,text,text,integer),
  public.update_task(uuid,text,text,uuid,uuid,integer),crm_private.update_task(uuid,text,text,uuid,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.update_project(uuid,text,text,integer),crm_private.update_project(uuid,text,text,integer),
  public.update_task(uuid,text,text,uuid,uuid,integer),crm_private.update_task(uuid,text,text,uuid,uuid,integer)
  to authenticated,service_role;
