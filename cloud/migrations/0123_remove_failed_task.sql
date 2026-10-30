-- Every task not yet over can be removed (#112): a failed one too, restored back to failed for a retry.

-- 0116's, refusing only a task already done or removed.
create or replace function api.v1_cancel_task(p_account uuid, p_id text, p_daily_write_budget integer, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform 1 from cloud.tasks where id = p_id for update;
  if exists (select 1 from cloud.tasks where id = p_id and status in ('done', 'cancelled')) then
    perform cloud.v1_refuse('This task has finished.');
  end if;
  return cloud.v1_cancel(p_account, p_id, p_reason);
end;
$$;

-- 0118's, a failed task coming back failed.
create or replace function cloud.v1_restores_to(t cloud.tasks) returns text language sql immutable set search_path = '' as $$
  select case when t.status <> 'cancelled' then null when t.cancelled_from in ('waiting_review', 'failed') then t.cancelled_from else 'stopped' end;
$$;
