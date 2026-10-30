-- The version of the copy each connector runs on the Runner's computer (#131).
create function cloud.v1_connector_versions(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name', e ->> 'version'), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account and e ->> 'version' is not null and coalesce((e ->> 'installed')::boolean, false);
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
    'connector_versions', cloud.v1_connector_versions(p_account),
    'models', cloud.v1_connector_models(p_account),
    'connector_settings', cloud.v1_connector_settings(p_account),
    'runners', coalesce((select jsonb_agg(jsonb_build_object('id', x.machine_id, 'name', x.machine_name,
                 'online', x.live_until > now())) from cloud.runners x where x.owner_id = p_account), '[]'::jsonb),
    'runner_connected', exists (select 1 from cloud.runners x where x.owner_id = p_account and x.live_until > now()));
end;
$$;
