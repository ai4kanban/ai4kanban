-- Storage packs outliving Pro (#2033): the users holding a pack that still renews, so the
-- hourly run can cancel those whose Pro has ended. Who is Pro stays in src/billing.ts.

create function api.storage_pack_holders()
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(distinct s.user_id), '[]'::json)
  from cloud.subscriptions s
  where s.item = 'storage' and s.status in ('active', 'trialing', 'past_due');
$$;

revoke all on function api.storage_pack_holders() from public;
grant execute on function api.storage_pack_holders() to service_role;
