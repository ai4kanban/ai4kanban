-- The reader read carries when each card was last written (#1640): the board's Stale column
-- sorts the cards nobody has touched in five days out of the others.
create or replace function cloud.reader_card_json(p_card cloud.workspace_cards)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_card.card_id,
    'revision', p_card.revision::text,
    'updatedAt', p_card.updated_at,
    'data', p_card.data
  );
$$;
revoke all on function cloud.reader_card_json(cloud.workspace_cards) from public;
