-- A task an idea started straight to building has no plan to talk over, so its chat stays off the
-- rail's list (#49); the task page still shows it. Chats already listed keep their place.

alter table cloud.task_chats add column in_rail boolean not null default true;

-- 0105's, with a direct build's chat off the rail.
create or replace function api.v1_start_idea(
  p_account uuid, p_discussion text, p_idea text, p_project text, p_workflow jsonb, p_daily_write_budget integer,
  p_expected_version integer default null, p_skip_plan boolean default false, p_machine uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_discussion);
  i cloud.discussion_ideas;
  t cloud.tasks;
  v_task jsonb;
  v_job uuid;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  select * into d from cloud.discussions where id = p_discussion for update;
  if d.request_id is not null then
    select * into t from cloud.tasks where id = (
      select x.task_id from cloud.discussion_ideas x where x.id = p_idea and x.discussion_id = d.id and x.state = 'started');
    if t.id is not null then return cloud.v1_task_json(t); end if;
    if d.version is distinct from p_expected_version then
      raise exception 'The ideas changed since version %; read them and start again.', p_expected_version using errcode = 'AKB27';
    end if;
  end if;
  i := cloud.v1_open_idea(d, p_idea);
  if p_workflow ->> 'id' is distinct from i.workflow then perform cloud.v1_refuse('This idea''s workflow has changed.'); end if;
  v_task := api.v1_create_task(p_account, jsonb_strip_nulls(jsonb_build_object(
      'title', i.title,
      'request', btrim(concat(i.outcome, E'\n\n## Done when\n' || (
        select string_agg('- ' || btrim(a), E'\n' order by n) from jsonb_array_elements_text(i.acceptance) with ordinality x(a, n))),
        E'\n'),
      'workspace', d.workspace_id, 'project', coalesce(p_project, d.project_id), 'source', 'web', 'run', true, 'skip_plan', p_skip_plan,
      'runtime', (select x.id from cloud.runtimes x where x.id = d.runtime and x.account_id = p_account),
      'machine', p_machine)),
    p_workflow, p_daily_write_budget);
  update cloud.tasks set discussion_id = p_discussion where id = v_task ->> 'id' returning * into t;
  if p_skip_plan then update cloud.task_chats set in_rail = false where task_id = t.id; end if;
  for v_job in select j.id from cloud.runner_jobs j where j.task_id = t.id and j.state = 'waiting' loop
    perform cloud.v1_carry_session(v_job, t.account_id);
  end loop;
  update cloud.discussion_ideas set state = 'started', task_id = t.id, updated_at = now() where id = p_idea;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  perform cloud.v1_discussion_changed(p_discussion);
  return cloud.v1_task_json(t);
end;
$$;

-- 0099's, less chats off the rail.
create or replace function api.v1_list_chats(p_account uuid, p_workspace text, p_after text, p_limit integer, p_external boolean default false)
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
        where h.account_id = p_account and h.in_rail and t.workspace_id = v_ws and c.at is not null
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
