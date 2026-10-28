-- Archived cards leave the workspace after their keep (#1338).
--
-- A Local board deletes an archived card 30 days after it was archived (#1335). A Cloud
-- board only ever dropped the machine's copy: the row stayed, so the archive grew without
-- bound and the next read brought every dropped card back.
--
-- WHICH cards are due is the client's call, not this function's. The rule reads the card —
-- its `archived:` day, its `release`, and `releases.md` — and `data` is opaque here. What the
-- workspace holds onto is the one thing it can check: only a card that has LEFT the board is
-- ever deleted.
--
-- `p_cards` is `[3, 7, 12]`. A number the workspace no longer holds counts as deleted, so two
-- machines pruning on the same day do not refuse each other. One still on the board refuses
-- the whole call (AKB10) and nothing is deleted.
--
-- The number is never handed out again (`next_card_id` does not move), the card's lock goes
-- with it, and its delivery rows stay.
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
