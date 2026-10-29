-- A replying chat names its job (#2200), so the page can watch that run's log.

-- 0099's, with `job`.
create or replace function cloud.v1_discussion_json(d cloud.discussions) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
  v_ready jsonb := cloud.v1_connectors(d.account_id);
  v_status text := 'idle';
begin
  if d.job_id is not null then
    j := cloud.v1_discussion_job(d);
    v_status := case when j.id is null then 'failed' else 'replying' end;
  elsif d.failure is not null then
    v_status := d.failure;
  end if;
  return jsonb_build_object(
    'object', 'discussion', 'id', d.id, 'workspace', d.workspace_id, 'project', d.project_id,
    'title', cloud.v1_discussion_title(d),
    'version', d.version,
    'external', d.request_id is not null,
    'host', d.host,
    'messages', coalesce((
      select jsonb_agg(cloud.v1_message_json(m.id, m.role, m.body, m.created_at, m.image_names, m.stopped, m.job_id)
        order by m.seq)
      from cloud.discussion_messages m where m.discussion_id = d.id), '[]'),
    'status', v_status,
    'job', j.id,
    'runtime', coalesce(d.runtime, (select x.id from cloud.runtimes x where x.account_id = d.account_id and x.is_default)),
    'runtimes', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'default', x.is_default,
        'connector', x.connector, 'model', x.model, 'status', coalesce(v_ready ->> x.connector, 'ready'))
        order by x.is_default desc, x.created_at, x.id)
      from cloud.runtimes x where x.account_id = d.account_id), '[]'),
    'runner', jsonb_build_object('connected', exists (
      select 1 from cloud.runners r where r.owner_id = d.account_id and r.live_until > now())),
    'context', case when d.session is not null and (d.context ->> 'limit')::integer > 0 then
      jsonb_build_object('used', (d.context ->> 'used')::integer, 'limit', (d.context ->> 'limit')::integer) end,
    'ideas', coalesce((
      select jsonb_agg(cloud.v1_idea_json(i) order by i.seq)
      from cloud.discussion_ideas i where i.discussion_id = d.id and i.state <> 'dropped'), '[]'),
    'created_at', cloud.v1_ts(d.created_at), 'updated_at', cloud.v1_ts(d.updated_at));
end;
$$;

-- 0067's, with `job`.
create or replace function cloud.task_chat_json(p_account uuid, p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  j cloud.runner_jobs;
  r cloud.runners;
  t cloud.tasks;
  tr cloud.runtimes;
  v_ready jsonb;
  v_status text := 'idle';
begin
  select * into t from cloud.tasks where id = p_task;
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  select * into r from cloud.runners where owner_id = t.account_id;
  tr := cloud.v1_task_runtime_read(t);
  v_ready := cloud.v1_connectors(t.account_id);
  if h.job_id is not null then
    j := cloud.task_chat_job(h);
    if j.id is null then v_status := 'failed';
    elsif j.state = 'waiting' and cloud.runner_job_queued(j) then v_status := 'queued';
    else v_status := 'replying';
    end if;
  elsif h.failure is not null then
    v_status := h.failure;
  end if;
  return jsonb_build_object(
    'object', 'task_chat',
    'messages', coalesce((
      select jsonb_agg(cloud.v1_chat_message_json(m) order by m.seq)
      from cloud.task_chat_messages m where m.task_id = p_task and m.account_id = p_account), '[]'),
    'status', v_status,
    'job', j.id,
    'runtime', coalesce(h.runtime, 'task'),
    'runtimes', jsonb_build_array(jsonb_build_object('id', 'task',
        'name', case when p_account = t.account_id then tr.name end,
        'default', p_account = t.account_id and tr.is_default,
        'connector', tr.connector, 'model', tr.model,
        'status', coalesce(v_ready ->> tr.connector, 'ready')))
      || coalesce((
        select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'default', x.is_default,
          'connector', x.connector, 'model', x.model, 'status', coalesce(v_ready ->> x.connector, 'ready'))
          order by x.is_default desc, x.created_at, x.id)
        from cloud.runtimes x
        where x.account_id = p_account and (p_account <> t.account_id or x.id is distinct from tr.id)), '[]'),
    'runner', jsonb_build_object('connected', coalesce(r.live_until > now(), false)),
    'context', case when h.session is not null and (h.context ->> 'limit')::integer > 0 then
      jsonb_build_object('used', (h.context ->> 'used')::integer, 'limit', (h.context ->> 'limit')::integer) end);
end;
$$;
