-- A direct build's chat comes back to the rail once its user sends a message (#55), and stays there.

update cloud.task_chats h set in_rail = true
where not h.in_rail and (select count(*) from cloud.task_chat_messages m
                         where m.task_id = h.task_id and m.account_id = h.account_id and m.role = 'user') > 1;

-- 0104's, putting the chat back on the rail.
create or replace function cloud.v1_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer,
                                   p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  h cloud.task_chats;
  r cloud.runtimes;
  v_pick text;
  v_ready text;
  v_key text;
  v_job uuid;
  v_host uuid;
begin
  select * into t from cloud.tasks where id = p_task for update;
  v_host := cloud.v1_task_host(t);
  if v_host is null then perform cloud.v1_runner_unavailable(); end if;
  insert into cloud.task_chats (task_id, account_id) values (p_task, p_account) on conflict do nothing;
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  if v_host <> t.account_id then
    r := cloud.v1_host_runtime(v_host, t.machine_id);
  else
    v_pick := case when p_runtime is null then h.runtime when p_runtime = 'task' then null
                   else (cloud.v1_own_runtime(p_account, p_runtime)).id end;
    if v_pick is null then r := cloud.v1_task_runtime(t);
    else select * into r from cloud.runtimes where id = v_pick;
    end if;
  end if;
  if not exists (select 1 from cloud.runners x where x.owner_id = v_host and x.live_until > now()
                   and (v_host = t.account_id or x.machine_id = t.machine_id)) then
    raise exception 'The Runner this task runs on is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  v_ready := cloud.v1_connectors(v_host) ->> r.connector;
  if v_ready in ('not_installed', 'signed_out') then
    raise exception '% is not ready on the computer running this task.', r.connector
      using errcode = 'AKB30', detail = r.connector, hint = v_ready;
  end if;
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body, image_names)
  values (cloud.v1_id('msg'), p_task, p_account, 'user', coalesce(p_body, ''), cloud.v1_image_names(p_images));
  v_job := (api.dispatch_runner_job(t.account_id, r.connector, null, cloud.task_chat_prompt(p_task, p_account),
                                    cloud.v1_image_files(p_images), p_daily_write_budget, p_task) ->> 'id')::uuid;
  perform cloud.v1_refuse_removed(v_job, t.workspace_id);
  v_key := cloud.v1_session_key(r.connector, r.model);
  update cloud.runner_jobs set model = r.model,
    resume = case when h.session_runtime is not distinct from v_key then h.session end
  where id = v_job;
  perform cloud.v1_carry_session(v_job, p_account);
  update cloud.task_chats set runtime = v_pick, job_id = v_job, failure = null, in_rail = true,
    session = case when session_runtime is distinct from v_key then null else session end,
    context = case when session_runtime is distinct from v_key then null else context end,
    updated_at = now()
  where task_id = p_task and account_id = p_account;
  perform cloud.v1_chat_changed(p_task, p_account);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;
