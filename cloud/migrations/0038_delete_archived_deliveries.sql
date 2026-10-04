-- A deleted archived card takes its ended delivery rows with it (#1520).
--
-- 0036 left them behind, pointing at a number the workspace no longer holds, so they grew
-- until the workspace itself went. Otherwise as 0036: the number is never handed out again,
-- the card's lock goes with it, and so does every delivery row of it no longer `open`.
create or replace function api.delete_archived_cards(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_cards jsonb,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
  v_done json;
  v_result json;
  v_cards jsonb := coalesce(p_cards, '[]'::jsonb);
  v_ids integer[];
  v_live integer;
  v_gone integer[];
  v_id integer;
  v_revision bigint;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_node(p_workspace, p_node);
  if jsonb_typeof(v_cards) <> 'array' or jsonb_array_length(v_cards) = 0 then
    return json_build_object('revision', v_workspace.revision::text, 'deleted', '[]'::json);
  end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id, v_cards);
  if v_done is not null then return v_done; end if;

  select array_agg(distinct e::integer) into v_ids from jsonb_array_elements_text(v_cards) e;

  select min(card_id) into v_live from cloud.workspace_cards
   where workspace_id = p_workspace and card_id = any(v_ids) and archived_at is null;
  if v_live is not null then
    raise exception 'Card % is still on the board, so nothing was deleted.', v_live
      using errcode = 'AKB10';
  end if;

  select coalesce(array_agg(card_id order by card_id), '{}') into v_gone from cloud.workspace_cards
   where workspace_id = p_workspace and card_id = any(v_ids);

  -- Nothing left to delete changes nothing, so it costs nothing and moves no revision.
  if cardinality(v_gone) = 0 then
    v_result := json_build_object('revision', v_workspace.revision::text, 'deleted', '[]'::json);
    perform cloud.record_operation(p_workspace, p_op_id, v_result);
    return v_result;
  end if;

  -- The cards, the trail beside each of them, the workspace's own revision, and the ledger.
  perform cloud.count_write(p_daily_write_budget, cardinality(v_gone) * 2 + 2);

  delete from cloud.workspace_cards where workspace_id = p_workspace and card_id = any(v_gone);
  delete from cloud.workspace_locks where workspace_id = p_workspace and card_id = any(v_gone);
  delete from cloud.workspace_deliveries
   where workspace_id = p_workspace and card_id = any(v_gone) and state <> 'open';
  foreach v_id in array v_gone loop
    perform cloud.audit(p_workspace, p_subject, p_node, 'card.deleted', v_id, '{}'::jsonb);
  end loop;

  update cloud.workspaces set revision = revision + 1, updated_at = now()
   where id = p_workspace
  returning revision into v_revision;

  v_result := json_build_object('revision', v_revision::text, 'deleted', to_json(v_gone));
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.delete_archived_cards(uuid, uuid, text, uuid, jsonb, integer) from public;
grant execute on function api.delete_archived_cards(uuid, uuid, text, uuid, jsonb, integer) to service_role;
