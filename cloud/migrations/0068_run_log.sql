-- A run's log leaves Postgres (#2085): it streams through the job's `RunLog` Durable Object and
-- ends as one R2 object, `jobs/<id>/log.json`. Logs of earlier runs go with the table.

drop function api.append_runner_job_events(uuid, uuid, uuid, jsonb, integer, integer);
drop function api.read_runner_job(uuid, uuid, integer);
drop table cloud.runner_job_events;

create function api.read_runner_job(p_subject uuid, p_job uuid)
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
            || jsonb_build_object('reply', v_job.reply, 'usage', v_job.usage, 'costUsd', v_job.cost_usd))::json
  );
end;
$$;
revoke all on function api.read_runner_job(uuid, uuid) from public;
grant execute on function api.read_runner_job(uuid, uuid) to service_role;

-- Whether this computer holds the job, for the Runner's log stream.
create function api.runner_job_held(p_subject uuid, p_machine uuid, p_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (cloud.held_runner_job(p_subject, p_machine, p_job)).id is not null;
$$;
revoke all on function api.runner_job_held(uuid, uuid, uuid) from public;
grant execute on function api.runner_job_held(uuid, uuid, uuid) to service_role;

-- The finished jobs `v1_delete_expired` takes, so their logs leave R2 first.
create or replace function api.v1_expired(p_account uuid, p_days integer, p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  with t as (
    select t.id from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
     where w.account_id = p_account and t.status in ('done', 'failed', 'cancelled')
       and t.updated_at < now() - make_interval(days => p_days)
     order by t.updated_at limit p_limit
  ), a as (select id from cloud.artifacts where task_id in (select id from t))
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(id) from t), '[]'),
    'files', coalesce((select jsonb_agg(k) from (
        select v.file ->> 'key' k from cloud.artifact_versions v where v.artifact_id in (select id from a) and v.file is not null
        union
        select u.object_key from cloud.artifact_uploads u
         where u.artifact_id in (select id from a) and u.uploaded_at is not null and u.used_at is null) f), '[]'),
    'multipart', coalesce((select jsonb_agg(jsonb_build_object('key', u.object_key, 'id', u.multipart_id))
        from cloud.artifact_uploads u
       where u.artifact_id in (select id from a) and u.uploaded_at is null and u.multipart_id is not null), '[]'),
    'jobs', coalesce((select jsonb_agg(j.id) from cloud.runner_jobs j
       where j.owner_id = p_account and j.state = 'finished' and j.finished_at < now() - make_interval(days => p_days)), '[]'));
$$;
