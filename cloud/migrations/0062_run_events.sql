-- A run's log as typed events (#2059): what the agent said, the tools it called and what they
-- returned, its plan, and plain log text. A Runner that sends only `text` still lands as `log`.

alter table cloud.runner_job_events
  add column kind text not null default 'log'
    check (kind in ('message', 'tool_call', 'tool_call_update', 'plan', 'error', 'log')),
  add column data jsonb;

create or replace function api.append_runner_job_events(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_events jsonb,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (cloud.held_runner_job(p_subject, p_machine, p_job)).id is null then
    return json_build_object('accepted', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runner_job_events (job_id, seq, text, kind, data)
  select p_job, (e ->> 'seq')::integer, coalesce(e ->> 'text', ''), coalesce(e ->> 'kind', 'log'),
         case when jsonb_typeof(e -> 'data') = 'object' then e -> 'data' end
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
  on conflict (job_id, seq) do nothing;
  update cloud.runner_jobs
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job;
  return json_build_object('accepted', true);
end;
$$;

create or replace function api.read_runner_job(p_subject uuid, p_job uuid, p_after integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
begin
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then return null; end if;
  if v_job.flow is null or not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    perform cloud.require_owner(v_job.owner_id, p_subject);
  end if;
  return json_build_object(
    'job', (cloud.runner_job_json(v_job)::jsonb
            || jsonb_build_object('reply', v_job.reply, 'usage', v_job.usage, 'costUsd', v_job.cost_usd))::json,
    'events', coalesce((
      select json_agg(json_build_object('seq', e.seq, 'text', e.text, 'kind', e.kind, 'data', e.data, 'at', e.created_at)
                      order by e.seq)
      from cloud.runner_job_events e
      where e.job_id = p_job and e.seq > coalesce(p_after, -1)
    ), '[]'::json)
  );
end;
$$;
