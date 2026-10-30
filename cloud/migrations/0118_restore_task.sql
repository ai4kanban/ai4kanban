-- A removed task restored (#94): back to waiting on review if it was, else stopped for a resume.
-- Its card is put back on the board by the Worker (`cloud/src/v1/endings.ts`).

alter table cloud.tasks add column cancelled_from text;

-- 0116's, keeping the status the task was removed from.
create or replace function cloud.v1_cancel(p_account uuid, p_id text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs := cloud.v1_flow_job(p_id);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if j.state = 'claimed' then
    update cloud.runner_jobs set stop_requested = true, updated_at = now() where id = j.id;
  end if;
  perform cloud.v1_end_waiting(p_id, 'Cancelled.');
  update cloud.tasks set status = 'cancelled', cancelled_from = status, cancel_reason = v_reason, cancelled_by = p_account,
    cancel_reviewed = case when v_reason is not null then false end, updated_at = now()
  where id = p_id returning * into t;
  perform cloud.v1_emit(t.workspace_id, 'task.cancelled', cloud.v1_task_json(t));
  return jsonb_build_object('result', cloud.v1_task_json(t),
    'job', case when j.state = 'claimed' and coalesce((select r.protocol from cloud.runners r
                where r.owner_id = coalesce(j.claimed_by, j.owner_id) and r.machine_id = j.claimed_machine), 0) >= 10 then j.id end);
end;
$$;

/** What a removed task comes back as. */
create function cloud.v1_restores_to(t cloud.tasks) returns text language sql immutable set search_path = '' as $$
  select case when t.status <> 'cancelled' then null when t.cancelled_from = 'waiting_review' then 'waiting_review' else 'stopped' end;
$$;

-- 0117's, with `restores_to`.
create or replace function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select cloud.v1_task_fields_json(t)
    || jsonb_build_object('key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
         'landing', t.landing, 'resume', cloud.v1_resume_json(t), 'waiting_for_slot', cloud.v1_waiting_for_slot(t),
         'creating', cloud.v1_creating(t), 'restores_to', cloud.v1_restores_to(t));
$$;

/** A removed task back on the board: no longer a rejection to learn. */
create function api.v1_restore_task(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  if t.status <> 'cancelled' then perform cloud.v1_refuse('Only a removed task can be restored.'); end if;
  delete from cloud.task_endings where task_id = p_id and claimed_at is null;
  update cloud.tasks set status = cloud.v1_restores_to(t), cancelled_from = null, cancel_reason = null, cancelled_by = null,
    cancel_reviewed = null, updated_at = now()
  where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

revoke all on function cloud.v1_restores_to(cloud.tasks) from public;
revoke all on function api.v1_restore_task(uuid, text, integer) from public;
grant execute on function api.v1_restore_task(uuid, text, integer) to service_role;
