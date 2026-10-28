-- Codex sessions draft ideas too (#2160): an external discussion names the host it is held in,
-- and `GET /v1/chats?external=1` lists the external ones beside the web's.
--
-- - **Host**: `claude-code` or `codex`, given when the discussion is opened; 0098's are Claude Code's.
-- - **Listed**: with `p_external`, an external discussion with an open idea is listed at its last
--   change, reading `host`.

alter table cloud.discussions
  add column host text check (host in ('claude-code', 'codex'));
update cloud.discussions set host = 'claude-code' where request_id is not null;
alter table cloud.discussions
  add constraint discussions_host check ((request_id is null) = (host is null));

-- 0098's, refused for any external discussion.
create or replace function api.v1_discussion_send(p_account uuid, p_id text, p_body text, p_runtime text, p_daily_write_budget integer,
                                                  p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_id);
begin
  if d.request_id is not null then perform cloud.v1_refuse('This discussion continues in the session that opened it.'); end if;
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  return cloud.v1_discussion_send(p_account, p_id, p_body, p_runtime, p_daily_write_budget, p_images);
end;
$$;

-- 0098's, with `host`.
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

-- 0098's, taking `host` (`claude-code` when left out).
create or replace function api.v1_create_external_discussion(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', p_fields ->> 'project');
  v_request text := btrim(coalesce(p_fields ->> 'request_id', ''));
  v_host text := coalesce(p_fields ->> 'host', 'claude-code');
  d cloud.discussions;
begin
  if v_request = '' then perform cloud.v1_refuse('A request id is required.'); end if;
  if v_host not in ('claude-code', 'codex') then perform cloud.v1_refuse('host must be claude-code or codex.'); end if;
  select * into d from cloud.discussions where account_id = p_account and request_id = v_request;
  if d.id is not null then return cloud.v1_discussion_json(cloud.v1_own_discussion(p_account, d.id)); end if;
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  insert into cloud.discussions (id, account_id, workspace_id, project_id, request_id, host)
  values (cloud.v1_id('dsc'), p_account, v_ws, p_fields ->> 'project', v_request, v_host)
  on conflict (account_id, request_id) where request_id is not null do nothing
  returning * into d;
  if d.id is null then
    select * into d from cloud.discussions where account_id = p_account and request_id = v_request;
  end if;
  perform cloud.v1_discussion_changed(d.id);
  return cloud.v1_discussion_json(d);
end;
$$;

-- 0074's, listing external discussions with `p_external`.
drop function api.v1_list_chats(uuid, text, text, integer);
create function api.v1_list_chats(p_account uuid, p_workspace text, p_after text, p_limit integer, p_external boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_workspace, null);
  v_limit integer := cloud.v1_limit(p_limit);
  v_at timestamptz;
begin
  if p_after is not null then
    select coalesce(
      (select max(m.created_at) from cloud.task_chat_messages m where m.task_id = p_after and m.account_id = p_account),
      (select max(m.created_at) from cloud.discussion_messages m join cloud.discussions d on d.id = m.discussion_id
        where d.id = p_after and d.account_id = p_account),
      (select d.updated_at from cloud.discussions d where d.id = p_after and d.account_id = p_account and d.request_id is not null))
      into v_at;
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.n) filter (where x.n <= v_limit), '[]'),
      'next', case when count(*) > v_limit then (array_agg(x.id order by x.n))[v_limit] end)
    from (
      select u.id, u.j, row_number() over (order by u.at desc, u.id desc) n
      from (
        select t.id, c.at,
          jsonb_build_object('task', t.id,
            'key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
            'title', t.title, 'project', t.project_id, 'last_message_at', cloud.v1_ts(c.at), 'state', cloud.v1_chat_state(h)) j
        from cloud.task_chats h
        join cloud.tasks t on t.id = h.task_id
        cross join lateral (select max(m.created_at) at from cloud.task_chat_messages m
                            where m.task_id = h.task_id and m.account_id = h.account_id) c
        where h.account_id = p_account and t.workspace_id = v_ws and c.at is not null
        union all
        select d.id, c.at,
          jsonb_build_object('discussion', d.id, 'title', cloud.v1_discussion_title(d), 'project', d.project_id,
            'last_message_at', cloud.v1_ts(c.at), 'state', cloud.v1_discussion_state(d))
        from cloud.discussions d
        cross join lateral (select max(m.created_at) at from cloud.discussion_messages m where m.discussion_id = d.id) c
        where d.account_id = p_account and d.workspace_id = v_ws and c.at is not null
          and (not exists (select 1 from cloud.discussion_ideas i where i.discussion_id = d.id)
               or exists (select 1 from cloud.discussion_ideas i where i.discussion_id = d.id and i.state = 'open'))
        union all
        select d.id, d.updated_at,
          jsonb_build_object('discussion', d.id, 'title', cloud.v1_discussion_title(d), 'project', d.project_id,
            'last_message_at', cloud.v1_ts(d.updated_at), 'state', 'idle', 'host', d.host)
        from cloud.discussions d
        where p_external and d.request_id is not null and d.account_id = p_account and d.workspace_id = v_ws
          and exists (select 1 from cloud.discussion_ideas i where i.discussion_id = d.id and i.state = 'open')
      ) u
      where p_after is null or (u.at, u.id) < (v_at, p_after)
      order by u.at desc, u.id desc limit v_limit + 1
    ) x);
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname in ('v1_create_external_discussion', 'v1_discussion_send', 'v1_list_chats'))
       or (n.nspname = 'cloud' and p.proname = 'v1_discussion_json')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
