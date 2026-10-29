-- Starting an idea can skip planning (#2202), as Build now does on Triage.

-- 0098's, passing `skip_plan` to v1_create_task.
drop function api.v1_start_idea(uuid, text, text, text, jsonb, integer, integer, integer);
create function api.v1_start_idea(
  p_account uuid, p_discussion text, p_idea text, p_project text, p_workflow jsonb, p_daily_write_budget integer,
  p_max_tasks integer default null, p_expected_version integer default null, p_skip_plan boolean default false
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
    where (n.nspname = 'api' and p.proname = 'v1_start_idea')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
