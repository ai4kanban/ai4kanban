-- A workspace's Runners name their owner (#2191): `owner` is the member's display name.

-- 0089's, with `owner`.
create or replace function api.v1_list_workspace_runners(p_account uuid, p_workspace text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
begin
  return jsonb_build_object('runners', coalesce((
    select jsonb_agg(jsonb_build_object('machine', x.machine_id, 'name', x.name, 'owner', x.owner,
                                        'connected', x.connected, 'last_active', x.last_active)
                     order by x.connected desc, x.last_active desc nulls last, x.machine_id)
    from (
      select f.machine_id,
             coalesce(max(nullif(m.machine_name, '')), '') as name,
             coalesce(nullif(a.name, ''), a.handle, '') as owner,
             bool_or(r.live_until > now() and r.machine_id = f.machine_id) is true as connected,
             max(m.last_active_at) as last_active
      from cloud.project_folders f
      join cloud.projects p on p.id = f.project_id and p.workspace_id = v_ws
      join cloud.v1_workspace_members wm on wm.workspace_id = v_ws and wm.account_id = f.account_id
      join cloud.accounts a on a.id = f.account_id
      left join cloud.runner_machines m on m.owner_id = f.account_id and m.machine_id = f.machine_id
      left join cloud.runners r on r.owner_id = f.account_id
      group by f.machine_id, a.id
    ) x), '[]'));
end;
$$;
