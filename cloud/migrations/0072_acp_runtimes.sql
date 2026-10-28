-- OpenCode and Cursor runtimes (#2084): the Runner drives both over ACP. Global default still
-- picks between Claude Code and Codex alone.

alter table cloud.runtimes
  drop constraint runtimes_connector_check,
  add constraint runtimes_connector_check check (connector in ('claude-code', 'codex', 'opencode', 'cursor'));

alter table cloud.runner_jobs
  drop constraint runner_jobs_runtime_check,
  add constraint runner_jobs_runtime_check check (runtime in ('codex', 'claude-code', 'opencode', 'cursor'));

create or replace function cloud.v1_connectors(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name',
    case when not coalesce((e ->> 'installed')::boolean, false) then 'not_installed'
         when (e ->> 'loggedIn')::boolean is false then 'signed_out' else 'ready' end), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account and e ->> 'name' in ('claude-code', 'codex', 'opencode', 'cursor');
$$;

create or replace function cloud.v1_connector_models(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name', e -> 'models'), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account and e ->> 'name' in ('claude-code', 'codex', 'opencode', 'cursor')
    and jsonb_typeof(e -> 'models') = 'array' and coalesce((e ->> 'installed')::boolean, false);
$$;
