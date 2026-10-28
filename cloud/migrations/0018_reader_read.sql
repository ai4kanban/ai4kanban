-- ---------------------------------------------------------------------------
-- What a browser reads (#322)
-- ---------------------------------------------------------------------------
--
-- The hosted pages at `cloud.ai4kanban.dev` draw two screens — a workspace's board and one
-- of its cards — and nothing else. So they get a read of their own rather than the
-- snapshot the app hydrates from: the workspace's NAME, its live cards, and the four
-- configuration documents those two screens draw.
--
-- What it leaves out is the point of it. The memory set, the per-flow rules, the archive,
-- a closed release's summary, the history files, the trail, the delivery records and the
-- execution nodes are all a workspace holds and none of them is on either screen — so they
-- stop here, in the database, rather than being fetched and then dropped by a Worker
-- somebody later edits. `read_snapshot` still carries memory and rules; this one cannot.
--
-- Authorization is `cloud.workspace_for` and nothing else, so a workspace this account is
-- not in and one that has been deleted meet the same AKB13 a stranger meets — #376 already
-- made that check a membership check, and this file names it rather than repeating it.

-- The four documents the two screens draw. `config.md` names the project, `modules.md`
-- orders the bands, `releases.md` fills the release picker with each version's own goal, and
-- `todo/README.md` is the board's index. `setup-checklist.md` and `.gitignore` are `config`
-- too and are drawn by neither, so the list is paths rather than the kind.
create or replace function cloud.reader_documents()
returns text[]
language sql
immutable
as $$ select array['config.md', 'modules.md', 'releases.md', 'todo/README.md']::text[] $$;
revoke all on function cloud.reader_documents() from public;

-- A workspace as a reader is shown it: what it is called, and the version that name was read
-- at. Not its owner, and not the number the board has free — a read-only page draws neither,
-- and the account behind a workspace is nobody else's business.
create or replace function cloud.reader_workspace_json(p_workspace cloud.workspaces)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_workspace.id,
    'name', p_workspace.name,
    'revision', p_workspace.revision::text
  );
$$;
revoke all on function cloud.reader_workspace_json(cloud.workspaces) from public;

-- One card, as a page draws it: its number, the version it was read at, and the portable
-- fields plus the body #315 stores under `data`. No lock, no archived stamp and no
-- timestamps — nothing on either screen says any of them.
create or replace function cloud.reader_card_json(p_card cloud.workspace_cards)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_card.card_id,
    'revision', p_card.revision::text,
    'data', p_card.data
  );
$$;
revoke all on function cloud.reader_card_json(cloud.workspace_cards) from public;

-- The whole of what a browser is served. One transaction, so the `revision` it carries
-- really is the revision every row in it was read at.
create or replace function api.read_for_reader(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
begin
  v_workspace := cloud.workspace_for(p_subject, p_workspace);
  return json_build_object(
    'revision', v_workspace.revision::text,
    'workspace', cloud.reader_workspace_json(v_workspace),
    'cards', coalesce((
      select json_agg(cloud.reader_card_json(c) order by c.card_id)
      from cloud.workspace_cards c
      where c.workspace_id = p_workspace and c.archived_at is null
    ), '[]'::json),
    'documents', coalesce((
      select json_agg(json_build_object('path', d.path, 'body', d.body) order by d.path)
      from cloud.workspace_documents d
      where d.workspace_id = p_workspace and d.path = any (cloud.reader_documents())
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.read_for_reader(uuid, uuid) from public;
grant execute on function api.read_for_reader(uuid, uuid) to service_role;
