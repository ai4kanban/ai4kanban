-- Load triage history page by page (#2112): `v1_list_triage` takes several states, and pages
-- newest first when asked.

drop function api.v1_list_triage(uuid, text, text, text, text, integer);

create function api.v1_list_triage(p_account uuid, p_workspace text, p_project text, p_states text[], p_desc boolean,
                                   p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.n) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n = cloud.v1_limit(p_limit)) end)
  from (
    select i.id, cloud.v1_triage_json(i) j,
           row_number() over (order by case when p_desc then i.id end desc, i.id) n
    from cloud.triage_items i
    where i.workspace_id = cloud.v1_target(p_account, p_workspace, p_project)
      and (p_after is null or case when p_desc then i.id < p_after else i.id > p_after end)
      and (p_project is null or i.project_id = p_project) and (p_states is null or i.state = any(p_states))
    order by case when p_desc then i.id end desc, i.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

revoke all on function api.v1_list_triage(uuid, text, text, text[], boolean, text, integer) from public;
grant execute on function api.v1_list_triage(uuid, text, text, text[], boolean, text, integer) to service_role;
