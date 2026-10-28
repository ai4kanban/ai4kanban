-- Daily task counts and run usage of a workspace (#2066), derived from tasks and runs.
--
-- - **Closed at**: set as a task becomes `done` or `cancelled`, cleared when it reopens. Tasks
--   closed before this migration take their `updated_at`.
-- - **Rejected** is `cancelled`; `failed` counts as neither completed nor rejected.

alter table cloud.tasks add column closed_at timestamptz;
update cloud.tasks set closed_at = updated_at where status in ('done', 'cancelled');

create function cloud.task_closed_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status not in ('done', 'cancelled') then
    new.closed_at := null;
  elsif tg_op = 'INSERT' or old.status not in ('done', 'cancelled') then
    new.closed_at := now();
  end if;
  return new;
end;
$$;
create trigger tasks_closed_at before insert or update of status on cloud.tasks
  for each row execute function cloud.task_closed_at();

-- One row per day of `p_from`..`p_to` in `p_tz` that has anything; the caller must be a member.
create function api.v1_workspace_stats(p_account uuid, p_workspace text, p_from date, p_to date, p_tz text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
  v_start timestamptz;
  v_end timestamptz;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then
    raise exception 'That is not a time zone.' using errcode = 'AKB28';
  end if;
  v_start := p_from::timestamp at time zone p_tz;
  v_end := (p_to + 1)::timestamp at time zone p_tz;
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(jsonb_build_object(
      'date', d.day, 'created', d.created, 'completed', d.completed, 'rejected', d.rejected,
      'usage', jsonb_build_object('input', d.input, 'cacheCreation', d.cache_creation, 'cacheRead', d.cache_read,
                                  'output', d.output),
      'costUsd', d.cost) order by d.day)
    from (
      select e.day, sum(e.created)::int as created, sum(e.completed)::int as completed, sum(e.rejected)::int as rejected,
             sum(e.input)::bigint as input, sum(e.cache_creation)::bigint as cache_creation,
             sum(e.cache_read)::bigint as cache_read, sum(e.output)::bigint as output, sum(e.cost)::float8 as cost
      from (
        select (t.created_at at time zone p_tz)::date as day, 1 as created, 0 as completed, 0 as rejected,
               0 as input, 0 as cache_creation, 0 as cache_read, 0 as output, 0::numeric as cost
          from cloud.tasks t where t.workspace_id = v_ws and t.created_at >= v_start and t.created_at < v_end
        union all
        select (t.closed_at at time zone p_tz)::date, 0, (t.status = 'done')::int, (t.status = 'cancelled')::int,
               0, 0, 0, 0, 0
          from cloud.tasks t where t.workspace_id = v_ws and t.closed_at >= v_start and t.closed_at < v_end
        union all
        select (j.finished_at at time zone p_tz)::date, 0, 0, 0,
               coalesce((j.usage ->> 'input')::numeric, 0), coalesce((j.usage ->> 'cacheCreation')::numeric, 0),
               coalesce((j.usage ->> 'cacheRead')::numeric, 0), coalesce((j.usage ->> 'output')::numeric, 0),
               coalesce(j.cost_usd, 0)
          from cloud.runner_jobs j join cloud.tasks t on t.id = j.task_id
         where t.workspace_id = v_ws and j.finished_at >= v_start and j.finished_at < v_end
           and (j.usage is not null or j.cost_usd is not null)
      ) e
      group by e.day
    ) d
  ), '[]'));
end;
$$;

revoke all on function cloud.task_closed_at() from public;
revoke all on function api.v1_workspace_stats(uuid, text, date, date, text) from public;
grant execute on function api.v1_workspace_stats(uuid, text, date, date, text) to service_role;
