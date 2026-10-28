-- What a board's server runs the board's runtimes as (#345).
--
-- 0005 made a machine record — a machine id it minted and the hostname it calls itself —
-- and that is all Cloud knew about the computer running a board's work. The board names its
-- runtimes (#343) and each computer binds them to a harness (#344), so only that computer
-- holds the answer to what the work actually runs on. This is where it sends it.
--
-- The record `cloud.board_servers` holds is now, in full: the machine id, the machine name,
-- and one entry per runtime the board names —
--
--   [{"name": "fast", "harness": "claude-code", "model": "claude-opus-5", "fallback": true}]
--
-- `name` is the board's own name for the runtime, `harness` and `model` are NAMES, and
-- `fallback` marks a runtime this computer bound nothing for. Never a key, an argument
-- string, a path or a board folder — the shape is fixed by the Worker, which caps the count
-- and each name's length before this ever sees it. A board that names no runtimes reports
-- an empty list.

alter table cloud.board_servers
  add column runtimes jsonb not null default '[]'::jsonb;

-- The server as every reader takes it, with the runtimes added to 0005's.
create or replace function cloud.server_json(p_server cloud.board_servers)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_server.id,
    'boardId', p_server.board_id,
    'machineId', p_server.machine_id,
    'machineName', p_server.machine_name,
    'enabled', p_server.enabled,
    'runtimes', p_server.runtimes
  );
$$;
revoke all on function cloud.server_json(cloud.board_servers) from public;

-- 0005's attach, taking what this computer runs the board's runtimes as.
--
-- The machine already holding the board calls this again to REFRESH: a rebinding reaches
-- Cloud through no other path. It stays free for a machine nobody rebound, because the
-- early return that already skipped a write for an unchanged name now covers the runtimes
-- too — so the tick and the read may both report on every pass and cost the day's write
-- budget nothing.
create or replace function api.attach_server(
  p_subject uuid,
  p_board uuid,
  p_machine uuid,
  p_machine_name text,
  p_take_over boolean,
  p_runtimes jsonb,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_holder cloud.board_servers;
  v_mine cloud.board_servers;
  v_runtimes jsonb := coalesce(p_runtimes, '[]'::jsonb);
begin
  select * into v_board from cloud.boards where id = p_board;
  if v_board.id is null then return null; end if;
  perform cloud.require_owner(v_board.owner_id, p_subject);

  select * into v_holder from cloud.board_servers
   where board_id = p_board and enabled and machine_id is distinct from p_machine;
  if v_holder.id is not null then
    if not coalesce(p_take_over, false) then
      raise exception 'This board already runs its work on %.',
        coalesce(nullif(v_holder.machine_name, ''), 'another machine')
        using errcode = 'AKB05';
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.board_servers set enabled = false, updated_at = now() where id = v_holder.id;
  end if;

  select * into v_mine from cloud.board_servers
   where board_id = p_board and machine_id = p_machine;
  if v_mine.id is not null then
    if v_mine.enabled and v_mine.machine_name = p_machine_name and v_mine.runtimes = v_runtimes then
      return cloud.server_json(v_mine);
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.board_servers
       set enabled = true, machine_name = p_machine_name, runtimes = v_runtimes, updated_at = now()
     where id = v_mine.id
    returning * into v_mine;
    return cloud.server_json(v_mine);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.board_servers (owner_id, board_id, machine_id, machine_name, runtimes)
  values (v_board.owner_id, p_board, p_machine, coalesce(p_machine_name, ''), v_runtimes)
  returning * into v_mine;
  return cloud.server_json(v_mine);
end;
$$;
revoke all on function api.attach_server(uuid, uuid, uuid, text, boolean, jsonb, integer) from public;
grant execute on function api.attach_server(uuid, uuid, uuid, text, boolean, jsonb, integer) to service_role;

-- 0005's six-argument attach is replaced by the one above. Dropped rather than left beside
-- it: two functions of one name would leave PostgREST choosing between them.
drop function if exists api.attach_server(uuid, uuid, uuid, text, boolean, integer);

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
--
-- The runtimes are a column on the server row, so they are kept while the board is on Cloud
-- and go with it — `on delete cascade` from `cloud.boards`. Nothing to sweep.
