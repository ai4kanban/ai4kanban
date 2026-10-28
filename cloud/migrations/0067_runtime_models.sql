-- Runtime models (#2087): the models each connector offers on the Runner's computer, as the Runner
-- last reported them, so the page offers a menu instead of an empty box.

-- `{ "<connector>": [{ id, name }] }`; a connector that reported none is left out.
create function cloud.v1_connector_models(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name', e -> 'models'), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account and e ->> 'name' in ('claude-code', 'codex')
    and jsonb_typeof(e -> 'models') = 'array' and coalesce((e ->> 'installed')::boolean, false);
$$;

create or replace function api.v1_list_runtimes(p_account uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_default_runtime(p_account);
  return jsonb_build_object(
    'data', (select jsonb_agg(cloud.v1_runtime_json(r) order by r.is_default desc, r.created_at, r.id)
             from cloud.runtimes r where r.account_id = p_account),
    'next', null,
    'connectors', cloud.v1_connectors(p_account),
    'models', cloud.v1_connector_models(p_account),
    'runner_connected', exists (select 1 from cloud.runners x where x.owner_id = p_account and x.live_until > now()));
end;
$$;

revoke all on function cloud.v1_connector_models(uuid) from public;
revoke all on function api.v1_list_runtimes(uuid) from public;
grant execute on function api.v1_list_runtimes(uuid) to service_role;
