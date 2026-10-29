-- The stats also sum each connector and model's runs over the whole range (#38), from the same
-- runs as the daily cost, so the rows add up to the total.

create or replace function api.v1_workspace_stats(p_account uuid, p_workspace text, p_from date, p_to date, p_tz text)
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
  return (
    with runs as (
      select (j.finished_at at time zone p_tz)::date as day, j.runtime, j.model, j.usage, j.cost_usd
        from cloud.runner_jobs j join cloud.tasks t on t.id = j.task_id
       where t.workspace_id = v_ws and j.finished_at >= v_start and j.finished_at < v_end
         and (j.usage is not null or j.cost_usd is not null)
    )
    select jsonb_build_object(
      'data', coalesce((
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
            select r.day, 0, 0, 0,
                   coalesce((r.usage ->> 'input')::numeric, 0), coalesce((r.usage ->> 'cacheCreation')::numeric, 0),
                   coalesce((r.usage ->> 'cacheRead')::numeric, 0), coalesce((r.usage ->> 'output')::numeric, 0),
                   coalesce(r.cost_usd, 0)
              from runs r
          ) e
          group by e.day
        ) d
      ), '[]'),
      'models', coalesce((
        select jsonb_agg(jsonb_build_object('connector', m.runtime, 'model', m.model, 'runs', m.runs, 'costUsd', m.cost))
        from (
          select r.runtime, r.model, count(*)::int as runs, sum(r.cost_usd)::float8 as cost
            from runs r group by r.runtime, r.model
        ) m
      ), '[]'))
  );
end;
$$;
