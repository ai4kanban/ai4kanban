-- A discussion held in someone's own Claude Code session (#2161): the model there drafts the
-- ideas through the WildCrane plugin, and only the plugin's Start button makes a task.
--
-- - **One per host session**: `request_id` is the host's session id; creating again answers the
--   same discussion. No message is kept and no Runner job is sent: the conversation stays local.
-- - **Versioned ideas**: every change to a discussion's ideas moves `version`. A draft save names
--   the version it read and is refused, with the discussion as it stands, when that moved.
-- - **Start once**: starting an external discussion's idea names the version; starting a started
--   one answers its task.

alter table cloud.discussions
  add column request_id text check (request_id is null or length(request_id) between 1 and 200),
  add column version integer not null default 1;
create unique index discussions_request on cloud.discussions (account_id, request_id) where request_id is not null;

-- A cascade deletes ideas with their discussion; only inserts and updates move it.
create function cloud.discussion_ideas_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update cloud.discussions set version = version + 1 where id = new.discussion_id;
  return null;
end;
$$;
create trigger discussion_ideas_version after insert or update on cloud.discussion_ideas
  for each row execute function cloud.discussion_ideas_version();

-- 0087's, refused for a discussion held in a Claude Code session.
create or replace function api.v1_discussion_send(p_account uuid, p_id text, p_body text, p_runtime text, p_daily_write_budget integer,
                                                  p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_id);
begin
  if d.request_id is not null then perform cloud.v1_refuse('This discussion continues in its Claude Code session.'); end if;
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  return cloud.v1_discussion_send(p_account, p_id, p_body, p_runtime, p_daily_write_budget, p_images);
end;
$$;

-- 0087's, with `version` and `external`.
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

-- `p_fields`: `workspace`, `project`, `request_id`. The caller's own discussion for that request,
-- made when there is none.
create function api.v1_create_external_discussion(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', p_fields ->> 'project');
  v_request text := btrim(coalesce(p_fields ->> 'request_id', ''));
  d cloud.discussions;
begin
  if v_request = '' then perform cloud.v1_refuse('A request id is required.'); end if;
  select * into d from cloud.discussions where account_id = p_account and request_id = v_request;
  if d.id is not null then return cloud.v1_discussion_json(cloud.v1_own_discussion(p_account, d.id)); end if;
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  insert into cloud.discussions (id, account_id, workspace_id, project_id, request_id)
  values (cloud.v1_id('dsc'), p_account, v_ws, p_fields ->> 'project', v_request)
  on conflict (account_id, request_id) where request_id is not null do nothing
  returning * into d;
  if d.id is null then
    select * into d from cloud.discussions where account_id = p_account and request_id = v_request;
  end if;
  perform cloud.v1_discussion_changed(d.id);
  return cloud.v1_discussion_json(d);
end;
$$;

-- The whole set of open ideas, as the model drafted them: one with an `id` of this discussion's
-- updates it, one without is added, an open one left out is dropped; started ones stay as they
-- are. Answers `{ saved, discussion }`; `saved` false when `p_expected_version` moved.
create function api.v1_save_draft(p_account uuid, p_id text, p_expected_version integer, p_ideas jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_id);
  e jsonb;
  v_ideas jsonb;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  select * into d from cloud.discussions where id = p_id for update;
  if d.request_id is null then perform cloud.v1_refuse('Only a Claude Code discussion takes a draft.'); end if;
  if jsonb_typeof(p_ideas) is distinct from 'array' then perform cloud.v1_refuse('ideas must be an array.'); end if;
  if d.version is distinct from p_expected_version then
    return jsonb_build_object('saved', false, 'discussion', cloud.v1_discussion_json(d));
  end if;
  if jsonb_array_length(p_ideas) > 10 then perform cloud.v1_refuse('A discussion holds at most 10 ideas.'); end if;
  for e in select x from jsonb_array_elements(p_ideas) x loop
    if jsonb_typeof(e) is distinct from 'object' or btrim(coalesce(e ->> 'title', '')) = '' then
      perform cloud.v1_refuse('Every idea needs a title.');
    end if;
    if e ? 'workflow' and not (cloud.v1_installed(d.workspace_id, e ->> 'workflow')
        or exists (select 1 from cloud.workflows w where w.id = e ->> 'workflow' and w.workspace_id = d.workspace_id)) then
      perform cloud.v1_missing('workflow');
    end if;
  end loop;
  -- Drops first, so a replaced idea frees its place among the ten.
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'dropped', true)), '[]') into v_ideas
  from cloud.discussion_ideas i where i.discussion_id = p_id and i.state = 'open'
    and not exists (select 1 from jsonb_array_elements(p_ideas) x where x ->> 'id' = i.id);
  perform cloud.v1_apply_ideas(p_id, v_ideas || (
    select coalesce(jsonb_agg(x - 'start' - 'dropped'), '[]') from jsonb_array_elements(p_ideas) x));
  update cloud.discussions set updated_at = now() where id = p_id returning * into d;
  perform cloud.v1_discussion_changed(p_id);
  return jsonb_build_object('saved', true, 'discussion', cloud.v1_discussion_json(d));
end;
$$;

-- 0094's: an external discussion's start names the version it showed, and a retry answers the
-- task made the first time.
drop function api.v1_start_idea(uuid, text, text, text, jsonb, integer, integer);
create function api.v1_start_idea(
  p_account uuid, p_discussion text, p_idea text, p_project text, p_workflow jsonb, p_daily_write_budget integer,
  p_max_tasks integer default null, p_expected_version integer default null
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
      'workspace', d.workspace_id, 'project', coalesce(p_project, d.project_id), 'source', 'web', 'run', true,
      'runtime', (select x.id from cloud.runtimes x where x.id = d.runtime and x.account_id = p_account))),
    p_workflow, p_daily_write_budget, p_max_tasks);
  update cloud.tasks set discussion_id = p_discussion where id = v_task ->> 'id' returning * into t;
  for v_job in select j.id from cloud.runner_jobs j where j.task_id = t.id and j.state = 'waiting' loop
    perform cloud.v1_carry_session(v_job, t.account_id);
  end loop;
  update cloud.discussion_ideas set state = 'started', task_id = t.id, updated_at = now() where id = p_idea;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  perform cloud.v1_discussion_changed(p_discussion);
  return cloud.v1_task_json(t);
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname in ('v1_create_external_discussion', 'v1_save_draft', 'v1_start_idea', 'v1_discussion_send'))
       or (n.nspname = 'cloud' and p.proname in ('v1_discussion_json', 'discussion_ideas_version'))
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
