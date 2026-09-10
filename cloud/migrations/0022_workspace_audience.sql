-- A card's decision reaches the teammates who can act on it (#328).
--
-- 0021 gave an event a workspace to belong to. It left every route addressed to ONE account:
-- `api.list_events` filters `owner_id`, `cloud.hint` broadcasts to `account:<uid>` alone, and
-- `api.connector_jobs` joins a connection on `e.owner_id` — the account whose machine
-- published. On a team that is the wrong person: the member whose agent asked is usually not
-- the owner who has to answer.
--
-- So a workspace event gains an AUDIENCE, resolved when the event is read:
--
--   • a user-owned question  → the workspace's OWNERS,
--   • a card ready for review → every MEMBER, owners included.
--
-- Read at delivery time rather than stored, so a member added since is included and one
-- removed since is dropped with nothing to keep in step.
--
-- Filtered by the watch, which is why the watch has to leave the machine: `~/.ai4kanban/`
-- cannot answer "the members watching this release". `cloud.workspace_watches` holds #319's
-- one switch and one release per member per workspace, so it follows them to every machine
-- and Cloud can resolve who is listening.
--
-- What that changes route by route:
--   • `api.list_events`     — a member's catch-up read answers the events they are in the
--                             audience of, whichever machine published them;
--   • `cloud.hint_audience` — the Realtime hint reaches every account in the audience;
--   • `api.connector_jobs`  — one message per DISTINCT DESTINATION across the audience's own
--                             Slack and Lark connections, so two members sharing a channel
--                             still get one;
--   • `cloud.raise_request` — the request an action raises is bound to the member who took
--                             it, and waits until a machine of THEIRS is up.
--
-- 0.8.0's board-kept events are untouched everywhere: their audience is their one owner, and
-- their one delivery per connector keeps the empty destination it already has.

-- ---------------------------------------------------------------------------
-- The watch, in the workspace
-- ---------------------------------------------------------------------------

-- #319's two answers, per member per workspace. `notify` is the switch; `watching` is `*` for
-- every release, one release's name, or '' for a member whose watched release closed and who
-- has not picked another — which is the state #319's rail already asks about.
--
-- `carried_at` is stamped the first time one of that member's machines hands its own record
-- over (`api.carry_watch`). Once, and never again: carrying on every open would undo a change
-- made in a browser.
create table cloud.workspace_watches (
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  notify boolean not null default true,
  watching text not null default '*',
  carried_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, account_id)
);
-- Read the other way round by the audience of every event of one workspace.
create index workspace_watches_workspace on cloud.workspace_watches (workspace_id) where notify;
alter table cloud.workspace_watches enable row level security;

comment on table cloud.workspace_watches is
  'One member''s notification switch and watched release inside one workspace (#328). It follows them to every machine, and is what lets Cloud resolve the members watching a release.';

-- One release line's id, exactly as `releaseLineEntry` in cli/src/lib/board/assemble.ts reads
-- it: the bullet stripped, cut at the em dash, and `**bold**` taken off. Null for a line that
-- names no release, which is every other line in the file.
create or replace function cloud.release_line_id(p_line text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(coalesce((regexp_match(head, '^\*\*(.+)\*\*$'))[1], head)), '')
  from (
    select trim(split_part(regexp_replace(p_line, '^\s*[-*]\s+', ''), '—', 1)) as head
     where p_line ~ '^\s*[-*]\s+'
  ) cut;
$$;
revoke all on function cloud.release_line_id(text) from public;

-- The release this workspace is shipping now, or '' when it has none open.
--
-- `releases.md` lists the open releases in the order they ship and `release new` appends, so
-- the newest is the file's last release line. Closing one takes its line away, which is what
-- makes "on the list" and "open" the same thing.
create or replace function cloud.newest_open_release(p_workspace uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select cloud.release_line_id(t.line)
      from cloud.workspace_documents d,
           lateral unnest(string_to_array(d.body, E'\n')) with ordinality as t(line, at)
     where d.workspace_id = p_workspace
       and d.path = 'releases.md'
       and cloud.release_line_id(t.line) is not null
     order by t.at desc
     limit 1
  ), '');
$$;
revoke all on function cloud.newest_open_release(uuid) from public;

-- What a member an owner adds starts on: the switch ON, watching the workspace's newest open
-- release. A default set once when they are added, not a rule that re-points as releases come
-- and go — either of them may change it afterwards.
--
-- A checkout starts on EVERY release (`ALL_RELEASES`), because the person turning
-- notifications on is choosing to be told. A teammate who has not opened the board yet starts
-- on the one version the team is shipping now: the smallest default that still puts a question
-- in front of an owner on day one. A workspace with no open release leaves the switch on with
-- nothing watched, and the rail asks them to choose.
create or replace function cloud.start_watching(p_workspace uuid, p_account uuid, p_watching text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into cloud.workspace_watches (workspace_id, account_id, notify, watching)
  values (p_workspace, p_account, true, coalesce(p_watching, ''))
  on conflict (workspace_id, account_id) do nothing;
end;
$$;
revoke all on function cloud.start_watching(uuid, uuid, text) from public;

-- The account that CREATES a workspace starts on every release, like a checkout turning
-- notifications on (`ALL_RELEASES`): they are choosing to be told, and a new workspace has no
-- releases.md for a narrower default to be read out of anyway.
create or replace function api.create_workspace(
  p_subject uuid,
  p_op_id text,
  p_name text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
begin
  if coalesce(p_op_id, '') <> '' then
    select * into v_workspace from cloud.workspaces
     where owner_id = p_subject and created_op = p_op_id;
    if v_workspace.id is not null then return cloud.workspace_json(v_workspace); end if;
  end if;

  begin
    insert into cloud.workspaces (owner_id, name, created_op)
    values (p_subject, coalesce(p_name, ''), nullif(p_op_id, ''))
    returning * into v_workspace;
  exception when unique_violation then
    select * into v_workspace from cloud.workspaces
     where owner_id = p_subject and created_op = p_op_id;
    return cloud.workspace_json(v_workspace);
  end;

  insert into cloud.workspace_members (workspace_id, account_id, role)
  values (v_workspace.id, p_subject, 'owner');
  perform cloud.start_watching(v_workspace.id, p_subject, '*');

  perform cloud.count_write(p_daily_write_budget, 4);
  perform cloud.audit(v_workspace.id, p_subject, null, 'workspace.created', null,
                      json_build_object('name', v_workspace.name)::jsonb);
  return cloud.workspace_json(v_workspace);
end;
$$;
revoke all on function api.create_workspace(uuid, text, text, integer) from public;
grant execute on function api.create_workspace(uuid, text, text, integer) to service_role;

-- Every member a workspace already holds starts watching every release, and not the newest
-- open one: they are all accounts that turned notifications on for themselves before this
-- migration, so `*` is what their machine is already publishing under. The narrower default
-- is for somebody with nothing to carry.
insert into cloud.workspace_watches (workspace_id, account_id, notify, watching)
select m.workspace_id, m.account_id, true, '*' from cloud.workspace_members m
on conflict do nothing;

create or replace function cloud.watch_json(p_watch cloud.workspace_watches, p_workspace uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'notify', coalesce(p_watch.notify, true),
    'watching', coalesce(p_watch.watching, ''),
    'carried', p_watch.carried_at is not null,
    -- What it could narrow to, off the board's own list, so a browser draws the picker
    -- without reading the whole board back.
    'releases', coalesce((
      select json_agg(id order by at)
        from (
          select cloud.release_line_id(t.line) as id, t.at
            from cloud.workspace_documents d,
                 lateral unnest(string_to_array(d.body, E'\n')) with ordinality as t(line, at)
           where d.workspace_id = p_workspace
             and d.path = 'releases.md'
             and cloud.release_line_id(t.line) is not null
        ) open
    ), '[]'::json)
  );
$$;
revoke all on function cloud.watch_json(cloud.workspace_watches, uuid) from public;

-- This member's own watch. A member with no row yet reads the default rather than nothing, so
-- a workspace that predates the row and one whose owner never opened it look the same.
create or replace function api.read_watch(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watch cloud.workspace_watches;
begin
  perform cloud.require_member(p_workspace, p_subject);
  select * into v_watch from cloud.workspace_watches
   where workspace_id = p_workspace and account_id = p_subject;
  return cloud.watch_json(v_watch, p_workspace);
end;
$$;
revoke all on function api.read_watch(uuid, uuid) from public;
grant execute on function api.read_watch(uuid, uuid) to service_role;

-- A member changes their OWN watch and nobody else's: an owner manages the workspace, not
-- what a teammate is told about.
--
-- It stamps `carried_at` as well, so a member who has answered for themselves is never carried
-- over by a second machine of theirs waking up with an older record.
create or replace function api.set_watch(
  p_subject uuid,
  p_workspace uuid,
  p_notify boolean,
  p_watching text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watch cloud.workspace_watches;
begin
  perform cloud.require_member(p_workspace, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.workspace_watches as w (workspace_id, account_id, notify, watching, carried_at)
  values (p_workspace, p_subject, coalesce(p_notify, true), coalesce(p_watching, ''), now())
  on conflict (workspace_id, account_id) do update
    set notify = excluded.notify,
        watching = excluded.watching,
        carried_at = coalesce(w.carried_at, excluded.carried_at),
        updated_at = now()
  returning * into v_watch;
  return cloud.watch_json(v_watch, p_workspace);
end;
$$;
revoke all on function api.set_watch(uuid, uuid, boolean, text, integer) from public;
grant execute on function api.set_watch(uuid, uuid, boolean, text, integer) to service_role;

-- What a machine already holds, handed over the first time it opens the workspace.
--
-- Once. A record carried on every open would overwrite a change the member made in a browser
-- with whatever the last machine to start up believes, so the second call answers the watch as
-- it stands and writes nothing.
create or replace function api.carry_watch(
  p_subject uuid,
  p_workspace uuid,
  p_notify boolean,
  p_watching text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watch cloud.workspace_watches;
begin
  perform cloud.require_member(p_workspace, p_subject);
  select * into v_watch from cloud.workspace_watches
   where workspace_id = p_workspace and account_id = p_subject;
  if v_watch.carried_at is not null then
    return cloud.watch_json(v_watch, p_workspace);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.workspace_watches as w (workspace_id, account_id, notify, watching, carried_at)
  values (p_workspace, p_subject, coalesce(p_notify, true), coalesce(p_watching, ''), now())
  on conflict (workspace_id, account_id) do update
    set notify = excluded.notify,
        watching = excluded.watching,
        carried_at = now(),
        updated_at = now()
  returning * into v_watch;
  return cloud.watch_json(v_watch, p_workspace);
end;
$$;
revoke all on function api.carry_watch(uuid, uuid, boolean, text, integer) from public;
grant execute on function api.carry_watch(uuid, uuid, boolean, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Who an event is addressed to
-- ---------------------------------------------------------------------------

-- The accounts one event is FOR. One function in front of every route that tells somebody
-- something, so widening or narrowing the audience cannot be forgotten on one of them.
--
-- A board event answers its one owner, exactly as #319 wrote it — no watch is consulted,
-- because a board's watch lives on the machine and its publisher has already applied it.
--
-- A workspace event answers the members whose watch covers it, and a QUESTION answers the
-- owners alone: #311 routes a question to the owner role, and a bell that showed every member
-- every event would make that routing decorative. Every member can still open the card and
-- answer it — out of the way, not out of reach.
create or replace function cloud.event_audience(p_event cloud.events)
returns table (account_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p_event.owner_id where p_event.workspace_id is null
  union
  select m.account_id
    from cloud.workspace_members m
    join cloud.workspace_watches w
      on w.workspace_id = m.workspace_id and w.account_id = m.account_id
   where p_event.workspace_id is not null
     and m.workspace_id = p_event.workspace_id
     and (p_event.kind <> 'question' or m.role = 'owner')
     and w.notify
     and w.watching <> ''
     and (w.watching = '*' or w.watching = p_event.release);
$$;
revoke all on function cloud.event_audience(cloud.events) from public;

-- Say an event moved, to every account it is addressed to. `cloud.hint` swallows its own
-- failure, so one account's Realtime having a bad minute costs the others nothing — and the
-- catch-up read on every start and reconnect is what makes the durable write enough anyway.
create or replace function cloud.hint_audience(p_event cloud.events)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
begin
  for v_account in select a.account_id from cloud.event_audience(p_event) a loop
    perform cloud.hint(v_account, p_event.id);
  end loop;
end;
$$;
revoke all on function cloud.hint_audience(cloud.events) from public;

-- The catch-up read on every start and reconnect: a board's own events, and every workspace
-- event this account is in the audience of.
--
-- The audience is resolved HERE rather than stored, so a member added since sees the row on
-- their next read with nothing interrupting them for it, and one removed since stops seeing it
-- on theirs. No write, so a reconnect storm costs the day's budget nothing.
create or replace function api.list_events(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(cloud.event_json(e) order by e.changed_at desc), '[]'::json)
  from cloud.events e
  where (e.board_id is not null and e.owner_id = p_subject)
     or (e.workspace_id is not null
         and exists (select 1 from cloud.event_audience(e) a where a.account_id = p_subject));
$$;
revoke all on function api.list_events(uuid) from public;
grant execute on function api.list_events(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The answer runs on the machine of whoever gave it
-- ---------------------------------------------------------------------------

-- 0021 addressed a workspace request to NO node, so any member's machine could take it up.
-- That attributes the work to the wrong person and waits on a teammate who may be asleep, so
-- the request names the member who ACTED: any machine of theirs may claim it, and none of
-- anybody else's. With no machine of theirs up it stays `waiting for server`, which is the
-- state every surface already draws.
alter table cloud.event_requests
  add column actor_id uuid references cloud.accounts (id) on delete set null;

comment on column cloud.event_requests.actor_id is
  'The member whose machines may run this request (#328). Null on a board request, which is addressed to that board''s one server instead.';

create or replace function cloud.raise_request(p_event cloud.events, p_actor uuid)
returns cloud.event_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server uuid;
  v_request cloud.event_requests;
  v_node cloud.board_servers;
begin
  if p_event.board_id is not null then
    select id into v_server from cloud.board_servers where board_id = p_event.board_id and enabled;
  end if;
  insert into cloud.event_requests (owner_id, board_id, workspace_id, event_id, server_id, actor_id)
  values (
    p_event.owner_id, p_event.board_id, p_event.workspace_id, p_event.id, v_server,
    case when p_event.workspace_id is null then null else p_actor end
  )
  on conflict (event_id) do nothing
  returning * into v_request;
  if v_request.id is null then
    select * into v_request from cloud.event_requests where event_id = p_event.id;
  end if;

  if p_event.workspace_id is null then
    perform cloud.hint_server(p_event.owner_id, v_server, v_request.id);
    return v_request;
  end if;
  -- Every live machine of the ANSWERING member, each on its own account's topic (#325). A
  -- hint is an optimisation either way: the catch-up read on every start and reconnect is
  -- what makes the durable row enough on its own.
  for v_node in
    select * from cloud.board_servers s
     where s.workspace_id = p_event.workspace_id
       and s.owner_id = v_request.actor_id
       and s.removed_at is null
       and s.enabled
       and s.lease_expires_at is not null
       and s.lease_expires_at > now()
  loop
    perform cloud.hint_server(v_node.owner_id, v_node.id, v_request.id);
  end loop;
  return v_request;
end;
$$;
revoke all on function cloud.raise_request(cloud.events, uuid) from public;
-- 0021's, which addressed a workspace request to every machine in the workspace.
drop function if exists cloud.raise_request(cloud.events);

-- 0021's list, refusing a machine that is not the answering member's. A board server still
-- sees its board's requests; a workspace node sees its workspace's requests that its OWN
-- account answered.
create or replace function api.list_requests(p_subject uuid, p_server uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server cloud.board_servers;
begin
  select * into v_server from cloud.board_servers where id = p_server;
  if v_server.id is null then return '[]'::json; end if;
  perform cloud.require_node_reader(v_server, p_subject);
  if not v_server.enabled or v_server.removed_at is not null then return '[]'::json; end if;

  return coalesce((
    select json_agg(cloud.request_json(r) order by r.created_at)
    from cloud.event_requests r
    where r.state <> 'finished'
      and r.board_id is not distinct from v_server.board_id
      and r.workspace_id is not distinct from v_server.workspace_id
      and (r.actor_id is null or r.actor_id = v_server.owner_id)
      and (r.claimed_by is null or r.claimed_by = v_server.id)
  ), '[]'::json);
end;
$$;
revoke all on function api.list_requests(uuid, uuid) from public;
grant execute on function api.list_requests(uuid, uuid) to service_role;

-- 0021's claim, with the same refusal in front of it. A teammate's machine reading the
-- request is not a teammate's machine RUNNING it: the work is attributed to whoever decided.
create or replace function api.claim_request(
  p_subject uuid,
  p_server uuid,
  p_request uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server cloud.board_servers;
  v_request cloud.event_requests;
begin
  select * into v_server from cloud.board_servers where id = p_server;
  if v_server.id is null then
    return json_build_object('claimed', false, 'reason', 'This machine is not registered to run that board’s work.');
  end if;
  perform cloud.require_node_reader(v_server, p_subject);
  if not v_server.enabled or v_server.removed_at is not null then
    return json_build_object('claimed', false, 'reason', 'This machine no longer runs that board’s work.');
  end if;

  select * into v_request from cloud.event_requests where id = p_request for update;
  if v_request.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such request.');
  end if;
  perform cloud.require_request_reader(v_request, p_subject);
  if v_request.board_id is distinct from v_server.board_id
     or v_request.workspace_id is distinct from v_server.workspace_id then
    return json_build_object('claimed', false, 'reason', 'That request belongs to another board.');
  end if;
  if v_request.actor_id is not null and v_request.actor_id <> v_server.owner_id then
    return json_build_object('claimed', false, 'reason', 'That decision runs on a machine of the member who took it.');
  end if;
  if v_request.state = 'finished' then
    return json_build_object('claimed', false, 'reason', 'That request has already been dealt with.');
  end if;
  if v_request.state = 'claimed' and not cloud.request_interrupted(v_request) then
    return json_build_object('claimed', false, 'reason', 'That request is already running.');
  end if;
  if v_request.claimed_by is not null and v_request.claimed_by <> v_server.id then
    return json_build_object('claimed', false, 'reason', 'That request is held by another machine.');
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.event_requests
     set state = 'claimed',
         claimed_by = v_server.id,
         lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_request
  returning * into v_request;
  return json_build_object('claimed', true, 'request', cloud.request_json(v_request));
end;
$$;
revoke all on function api.claim_request(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.claim_request(uuid, uuid, uuid, integer, integer) to service_role;

-- 0021's, naming the machine a decision is actually waiting for. Once a workspace event has
-- been answered the request names the member who answered, so the name is one of THEIR live
-- machines — a surface must not tell somebody a teammate's laptop is about to run their
-- decision. Before that, and with none of theirs up, it is any live machine in the workspace
-- and then nothing, which every surface already draws as *waiting for a machine*.
create or replace function cloud.event_json(p_event cloud.events)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_event.id,
    'boardId', coalesce(p_event.board_id::text, ''),
    'workspaceId', coalesce(p_event.workspace_id::text, ''),
    'boardName', coalesce(
      (select b.name from cloud.boards b where b.id = p_event.board_id),
      (select w.name from cloud.workspaces w where w.id = p_event.workspace_id),
      ''
    ),
    'taskId', p_event.task_id,
    'taskTitle', p_event.task_title,
    'release', p_event.release,
    'revision', p_event.revision,
    'kind', p_event.kind,
    'decision', p_event.decision,
    'state', case
      when p_event.state in ('waiting_for_server', 'running')
       and exists (
         select 1 from cloud.event_requests r
          where r.event_id = p_event.id and cloud.request_interrupted(r)
       )
      then 'interrupted'
      else p_event.state
    end,
    'questions', p_event.questions,
    'summary', p_event.summary,
    'notes', p_event.notes,
    'reason', p_event.reason,
    'serverName', coalesce(
      (select s.machine_name from cloud.board_servers s
        where s.board_id = p_event.board_id and s.enabled
        limit 1),
      (select coalesce(nullif(s.node_name, ''), s.machine_name) from cloud.board_servers s
        where s.workspace_id = p_event.workspace_id
          and s.removed_at is null
          and s.enabled
          and s.lease_expires_at is not null
          and s.lease_expires_at > now()
          and s.owner_id = (select r.actor_id from cloud.event_requests r where r.event_id = p_event.id)
        order by s.lease_expires_at desc
        limit 1),
      (select coalesce(nullif(s.node_name, ''), s.machine_name) from cloud.board_servers s
        where s.workspace_id = p_event.workspace_id
          and not exists (select 1 from cloud.event_requests r
                           where r.event_id = p_event.id and r.actor_id is not null)
          and s.removed_at is null
          and s.enabled
          and s.lease_expires_at is not null
          and s.lease_expires_at > now()
        order by s.lease_expires_at desc
        limit 1),
      ''
    ),
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'broughtIn', p_event.brought_in_at is not null and p_event.state = 'actionable',
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;

-- ---------------------------------------------------------------------------
-- Every route tells the audience
-- ---------------------------------------------------------------------------

-- 0021's, hinting the audience rather than the publisher. Everything else about publishing is
-- unchanged: one card keeps one live row in its home, and a quiet refresh stays quiet.
create or replace function api.publish_event(
  p_subject uuid,
  p_board uuid,
  p_workspace uuid,
  p_task_id integer,
  p_task_title text,
  p_release text,
  p_revision text,
  p_kind text,
  p_decision text,
  p_questions jsonb,
  p_summary text,
  p_notes text,
  p_fingerprint text,
  p_brought_in boolean,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_event cloud.events;
  v_brought_in timestamptz := case when coalesce(p_brought_in, false) then now() else null end;
begin
  if num_nonnulls(p_board, p_workspace) <> 1 then
    raise exception 'An event names a board or a workspace, never both.' using errcode = 'AKB10';
  end if;

  if p_workspace is not null then
    perform cloud.require_member(p_workspace, p_subject);
  else
    select * into v_board from cloud.boards where id = p_board;
    if v_board.id is null then
      perform cloud.count_write(p_daily_write_budget);
      insert into cloud.boards (id, owner_id, name) values (p_board, p_subject, '');
      select * into v_board from cloud.boards where id = p_board;
    end if;
    perform cloud.require_owner(v_board.owner_id, p_subject);
  end if;

  select * into v_event
  from cloud.events e
  where e.task_id = p_task_id
    and e.board_id is not distinct from p_board
    and e.workspace_id is not distinct from p_workspace
    and (
      e.finished_at is null
      or (e.state = 'stale' and not exists (select 1 from cloud.event_actions a where a.event_id = e.id))
    )
  order by e.changed_at desc
  limit 1;

  if v_event.id is not null then
    if v_event.state = 'actionable' and v_event.fingerprint = p_fingerprint then
      if v_event.revision is distinct from p_revision
         or v_event.release is distinct from coalesce(p_release, '') then
        perform cloud.count_write(p_daily_write_budget);
        update cloud.events
           set revision = p_revision,
               release = coalesce(p_release, ''),
               content_at = now()
         where id = v_event.id
        returning * into v_event;
      end if;
      return cloud.event_json(v_event);
    end if;
    if v_event.state <> 'actionable' and v_event.state <> 'stale' then
      return cloud.event_json(v_event);
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.events
       set task_title = p_task_title,
           release = coalesce(p_release, ''),
           revision = p_revision,
           kind = p_kind,
           decision = p_decision,
           questions = coalesce(p_questions, '[]'::jsonb),
           summary = coalesce(p_summary, ''),
           notes = coalesce(p_notes, ''),
           fingerprint = p_fingerprint,
           state = 'actionable',
           finished_at = null,
           brought_in_at = v_brought_in,
           changed_at = now(),
           content_at = now()
     where id = v_event.id
    returning * into v_event;
    perform cloud.hint_audience(v_event);
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.events (
    owner_id, board_id, workspace_id, task_id, task_title, release, revision, kind, decision,
    questions, summary, notes, fingerprint, brought_in_at
  ) values (
    coalesce(v_board.owner_id, p_subject), p_board, p_workspace, p_task_id, p_task_title,
    coalesce(p_release, ''), p_revision, p_kind, p_decision,
    coalesce(p_questions, '[]'::jsonb), coalesce(p_summary, ''), coalesce(p_notes, ''),
    p_fingerprint, v_brought_in
  )
  returning * into v_event;
  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer) from public;
grant execute on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer) to service_role;

create or replace function api.retire_event(
  p_subject uuid,
  p_event uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_event_reader(v_event, p_subject);
  if v_event.state <> 'actionable'
     or exists (select 1 from cloud.event_actions a where a.event_id = p_event) then
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.events
     set state = 'stale', changed_at = now(), content_at = now(), finished_at = now()
   where id = p_event
  returning * into v_event;
  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.retire_event(uuid, uuid, integer) from public;
grant execute on function api.retire_event(uuid, uuid, integer) to service_role;

-- 0021's, binding the request it raises to the member who answered and telling the whole
-- audience — so every other recipient's surface redraws as answered rather than still asking.
create or replace function api.record_event_action(
  p_subject uuid,
  p_op_id text,
  p_event uuid,
  p_decision text,
  p_revision text,
  p_answers jsonb,
  p_state text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
  v_action cloud.event_actions;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_event_reader(v_event, p_subject);

  select * into v_action from cloud.event_actions where op_id = p_op_id;
  if v_action.id is not null then return cloud.event_json(v_event); end if;

  if exists (select 1 from cloud.event_actions a where a.event_id = p_event) then
    raise exception 'That event has already been answered.' using errcode = 'AKB04';
  end if;
  if v_event.revision is distinct from p_revision then
    raise exception 'That task has changed since this was asked.' using errcode = 'AKB03';
  end if;
  if v_event.state <> 'actionable' then
    raise exception 'That event is no longer waiting for anybody.' using errcode = 'AKB03';
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  insert into cloud.event_actions (event_id, owner_id, decision, revision, answers, op_id)
  values (p_event, p_subject, p_decision, p_revision, coalesce(p_answers, '[]'::jsonb), p_op_id);
  -- A workspace decision is a workspace mutation, attributed to the member who gave it on the
  -- same trail every other one writes (#314). No node: the press came from a browser, or from
  -- a machine that is not the one answering.
  if v_event.workspace_id is not null then
    perform cloud.audit(v_event.workspace_id, p_subject, null, 'decision.' || p_decision,
                        v_event.task_id, json_build_object('eventId', p_event)::jsonb);
  end if;

  update cloud.events
     set state = case when p_state = 'waiting_for_server' then 'waiting_for_server' else 'accepted' end,
         changed_at = now(),
         content_at = now()
   where id = p_event
  returning * into v_event;

  if p_state = 'waiting_for_server' then
    perform cloud.count_write(p_daily_write_budget);
    perform cloud.raise_request(v_event, p_subject);
  end if;

  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) from public;
grant execute on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) to service_role;

create or replace function api.record_event_outcome(
  p_subject uuid,
  p_op_id text,
  p_event uuid,
  p_outcome text,
  p_reason text,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_event_reader(v_event, p_subject);
  if exists (select 1 from cloud.event_outcomes o where o.op_id = p_op_id) then
    return cloud.event_json(v_event);
  end if;
  if not exists (select 1 from cloud.event_actions a where a.event_id = p_event) then
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  insert into cloud.event_outcomes (event_id, outcome, op_id) values (p_event, p_outcome, p_op_id);
  update cloud.events
     set state = p_outcome,
         reason = coalesce(nullif(p_reason, ''), ''),
         changed_at = now(),
         content_at = now(),
         finished_at = case when p_outcome = 'running' then null else now() end
   where id = p_event
  returning * into v_event;

  update cloud.event_requests
     set state = case when p_outcome = 'running' then state else 'finished' end,
         lease_expires_at = case
           when p_outcome = 'running'
           then now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60))
           else lease_expires_at
         end,
         reason = coalesce(nullif(p_reason, ''), reason),
         updated_at = now()
   where event_id = p_event and state <> 'finished';

  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) from public;
grant execute on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- One message per destination, not one per event
-- ---------------------------------------------------------------------------

-- #320 keyed a delivery to `(event_id, connector)` — one message per event per connector,
-- which is right for a board with one owner and wrong for a workspace with five members. So a
-- delivery names the DESTINATION it went to, and the audience's connections are collapsed onto
-- their destinations first: two members pointing at one channel share one message, and a
-- five-person team with five destinations spends five deliveries.
--
-- A board event's delivery keeps the empty destination it already has, so 0.8.0's messages are
-- found, edited and threaded exactly as before.
alter table cloud.event_deliveries add column destination text not null default '';
alter table cloud.event_deliveries drop constraint event_deliveries_event_id_connector_key;
alter table cloud.event_deliveries add constraint event_deliveries_one_per_destination
  unique (event_id, connector, destination);

comment on column cloud.event_deliveries.destination is
  'Which chat destination this message went to (#328). Empty on a board event, which has one.';

alter table cloud.card_messages add column destination text not null default '';
drop index if exists cloud.card_messages_one_per_workspace_card;
create unique index card_messages_one_per_workspace_card
  on cloud.card_messages (workspace_id, task_id, connector, destination)
  where workspace_id is not null;

-- A workspace card already showing in a chat keeps the message it has. Its rows were written
-- when the only recipient was the publisher, so the destination they went to is that account's
-- own — and without this they would be orphaned and posted a second time.
update cloud.event_deliveries d
   set destination = coalesce(s.team_id || ':' || s.channel_id, '')
  from cloud.events e
  left join cloud.slack_connections s on s.owner_id = e.owner_id
 where d.event_id = e.id and d.connector = 'slack' and e.workspace_id is not null;

update cloud.event_deliveries d
   set destination = coalesce(l.cloud || ':' || l.tenant_key || ':' || l.destination_id, '')
  from cloud.events e
  left join cloud.lark_connections l on l.owner_id = e.owner_id
 where d.event_id = e.id and d.connector = 'lark' and e.workspace_id is not null;

update cloud.card_messages m
   set destination = coalesce(s.team_id || ':' || s.channel_id, '')
  from cloud.slack_connections s
 where s.owner_id = m.owner_id and m.connector = 'slack' and m.workspace_id is not null;

update cloud.card_messages m
   set destination = coalesce(l.cloud || ':' || l.tenant_key || ':' || l.destination_id, '')
  from cloud.lark_connections l
 where l.owner_id = m.owner_id and m.connector = 'lark' and m.workspace_id is not null;

create or replace function api.record_event_delivery(
  p_subject uuid,
  p_event uuid,
  p_connector text,
  p_destination text,
  p_state text,
  p_external_ref text,
  p_last_error text,
  p_rendered_at timestamptz,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_event_reader(v_event, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.event_deliveries as d (
    event_id, connector, destination, state, attempts, external_ref, last_error, rendered_at
  ) values (
    p_event, p_connector, coalesce(p_destination, ''), p_state,
    case when p_state = 'sent' then 0 else 1 end,
    p_external_ref, nullif(p_last_error, ''),
    case when p_state = 'sent' then p_rendered_at end
  )
  on conflict (event_id, connector, destination) do update
    set state = excluded.state,
        attempts = case when excluded.state = 'sent' then 0 else d.attempts + 1 end,
        external_ref = coalesce(excluded.external_ref, d.external_ref),
        last_error = excluded.last_error,
        rendered_at = coalesce(excluded.rendered_at, d.rendered_at),
        updated_at = now();
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_delivery(uuid, uuid, text, text, text, text, text, timestamptz, integer) from public;
grant execute on function api.record_event_delivery(uuid, uuid, text, text, text, text, text, timestamptz, integer) to service_role;
drop function if exists api.record_event_delivery(uuid, uuid, text, text, text, text, timestamptz, integer);

-- 0014's, in the destination's own row. A member's thread gains its own ending; a destination
-- that already logged one keeps it.
create or replace function api.record_delivery_ending(
  p_subject uuid,
  p_event uuid,
  p_connector text,
  p_destination text,
  p_external_ref text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_event_reader(v_event, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.event_deliveries as d (event_id, connector, destination, ended_ref)
  values (p_event, p_connector, coalesce(p_destination, ''), p_external_ref)
  on conflict (event_id, connector, destination) do update
    set ended_ref = coalesce(d.ended_ref, excluded.ended_ref),
        updated_at = now();
  return json_build_object('endedRef', p_external_ref);
end;
$$;
revoke all on function api.record_delivery_ending(uuid, uuid, text, text, text, integer) from public;
grant execute on function api.record_delivery_ending(uuid, uuid, text, text, text, integer) to service_role;
drop function if exists api.record_delivery_ending(uuid, uuid, text, text, integer);

-- 0021's, in the destination's own row for a workspace card. A board card's message keeps the
-- one row per `(board_id, task_id, connector)` it has always had.
create or replace function api.record_card_message(
  p_subject uuid,
  p_board uuid,
  p_workspace uuid,
  p_task_id integer,
  p_connector text,
  p_destination text,
  p_external_ref text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_owner uuid;
begin
  if num_nonnulls(p_board, p_workspace) <> 1 then
    raise exception 'A card message names a board or a workspace, never both.' using errcode = 'AKB10';
  end if;
  if p_workspace is not null then
    perform cloud.require_member(p_workspace, p_subject);
    v_owner := p_subject;
  else
    select * into v_board from cloud.boards where id = p_board;
    if v_board.id is null then return null; end if;
    perform cloud.require_owner(v_board.owner_id, p_subject);
    v_owner := v_board.owner_id;
  end if;

  perform cloud.count_write(p_daily_write_budget);
  if p_workspace is not null then
    insert into cloud.card_messages as m (owner_id, workspace_id, task_id, connector, destination, external_ref)
    values (v_owner, p_workspace, p_task_id, p_connector, coalesce(p_destination, ''), p_external_ref)
    on conflict (workspace_id, task_id, connector, destination) where workspace_id is not null do update
      set external_ref = excluded.external_ref,
          updated_at = now();
  else
    insert into cloud.card_messages as m (owner_id, board_id, task_id, connector, external_ref)
    values (v_owner, p_board, p_task_id, p_connector, p_external_ref)
    on conflict (board_id, task_id, connector) do update
      set external_ref = excluded.external_ref,
          updated_at = now();
  end if;
  return json_build_object('externalRef', p_external_ref);
end;
$$;
revoke all on function api.record_card_message(uuid, uuid, uuid, integer, text, text, text, integer) from public;
grant execute on function api.record_card_message(uuid, uuid, uuid, integer, text, text, text, integer) to service_role;
drop function if exists api.record_card_message(uuid, uuid, uuid, integer, text, text, integer);

-- 0021's jobs, fanned out over the audience.
--
-- Two changes and no others. A workspace event's connections are the AUDIENCE's rather than
-- the publisher's, and they are collapsed onto their destinations before anything is due, so
-- two members reading one channel cost one message. Every reference a job carries — the
-- delivery, the card's message, the top of the thread — is looked up in the destination it is
-- for, or a redraw aimed at one member's channel would edit another's message.
--
-- `ownerId` is therefore the RECIPIENT, which is who the delivery is recorded against and who
-- is told where their connection was made when their chat refuses us.
create or replace function api.connector_jobs(
  p_connector text,
  p_event uuid,
  p_limit integer,
  p_max_attempts integer
) returns json
language sql
security definer
set search_path = ''
as $$
  with connected as (
    select s.owner_id,
           s.created_at as connected_at,
           ''::text as thread_scope,
           s.team_id || ':' || s.channel_id as destination,
           json_build_object(
             'botToken', s.bot_token,
             'channelId', s.channel_id,
             'actorId', s.slack_user_id
           ) as posts
      from cloud.slack_connections s
     where p_connector = 'slack' and s.state = 'active' and s.channel_id <> ''
    union all
    select l.owner_id,
           l.created_at,
           l.destination_id || ':',
           l.cloud || ':' || l.tenant_key || ':' || l.destination_id,
           json_build_object(
             'cloud', l.cloud,
             'tenantKey', l.tenant_key,
             'destinationId', l.destination_id,
             'direct', l.direct,
             'openId', l.open_id
           )
      from cloud.lark_connections l
     where p_connector = 'lark' and l.state = 'active' and l.destination_id <> ''
  )
  select coalesce(json_agg(job), '[]'::json) from (
    select json_build_object(
      'ownerId', c.owner_id,
      'eventId', e.id,
      'destination', c.key,
      'contentAt', e.content_at,
      'changedAt', e.content_at,
      'posts', c.posts,
      'messageRef', d.external_ref,
      'endingRef', d.ended_ref,
      'cardRef', (
        select m.external_ref
          from cloud.card_messages m
         where m.task_id = e.task_id
           and m.board_id is not distinct from e.board_id
           and m.workspace_id is not distinct from e.workspace_id
           and m.connector = p_connector
           and m.destination = c.key
           and starts_with(m.external_ref, c.thread_scope)
      ),
      'card', (
        select cloud.event_json(newest)
          from cloud.events newest
         where newest.task_id = e.task_id
           and newest.board_id is not distinct from e.board_id
           and newest.workspace_id is not distinct from e.workspace_id
         order by newest.content_at desc, newest.created_at desc, newest.id desc
         limit 1
      ),
      'threadRef', (
        select root.external_ref
          from cloud.events sibling
          join cloud.event_deliveries root
            on root.event_id = sibling.id
           and root.connector = p_connector
           and root.destination = c.key
         where sibling.task_id = e.task_id
           and sibling.board_id is not distinct from e.board_id
           and sibling.workspace_id is not distinct from e.workspace_id
           and root.external_ref is not null
           and starts_with(root.external_ref, c.thread_scope)
         order by root.created_at, root.id
         limit 1
      ),
      'attempts', coalesce(d.attempts, 0),
      'event', cloud.event_json(e)
    ) as job
    from cloud.events e
    cross join lateral (
      -- One row per destination. The earliest connection wins, so a destination two members
      -- share is dated from when it first started listening — which is what decides whether a
      -- card a scope change brought in owes it a message at all.
      select distinct on (n.destination)
             n.owner_id, n.connected_at, n.thread_scope, n.posts,
             case when e.workspace_id is null then '' else n.destination end as key
        from connected n
       where case
               when e.workspace_id is null then n.owner_id = e.owner_id
               else exists (select 1 from cloud.event_audience(e) a where a.account_id = n.owner_id)
             end
       order by n.destination, n.connected_at
    ) c
    left join cloud.event_deliveries d
           on d.event_id = e.id and d.connector = p_connector and d.destination = c.key
    where (p_event is null or e.id = p_event)
      and (e.state = 'actionable' or d.external_ref is not null)
      and (d.id is null or d.state <> 'sent' or d.rendered_at is null or d.rendered_at < e.content_at)
      and coalesce(d.attempts, 0) < p_max_attempts
      and (
        e.brought_in_at is null
        or d.external_ref is not null
        or c.connected_at > e.brought_in_at
      )
    order by e.content_at
    limit greatest(coalesce(p_limit, 20), 1)
  ) due;
$$;
revoke all on function api.connector_jobs(text, uuid, integer, integer) from public;
grant execute on function api.connector_jobs(text, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- An event goes with what it is about
-- ---------------------------------------------------------------------------

-- A workspace's events go with the workspace, by cascade. What was left is the CARD: on a
-- Local board the publisher retires an event whose task stopped being one the board raises,
-- but a member archiving a card from a browser runs no publisher at all — so the card's live
-- decision would go on asking about a card that has left the board.
--
-- The hourly sweep is where that is settled, because it is the one pass that sees the whole
-- workspace rather than one machine's view of it. `stale` and not deleted: it is the same
-- ending a retirement writes, and 0015's redraw is what takes the press off the chat.
--
-- The card-message sweep is made home-aware at the same time. 0019's matched on `board_id`
-- alone, so a workspace card's message was never anything's to take.
create or replace function api.sweep_events()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
  v_retired integer;
  v_messages integer;
  v_summaries integer;
begin
  update cloud.events e
     set state = 'stale', changed_at = now(), content_at = now(), finished_at = now()
   where e.workspace_id is not null
     and e.finished_at is null
     and not exists (
       select 1 from cloud.workspace_cards c
        where c.workspace_id = e.workspace_id
          and c.card_id = e.task_id
          and c.archived_at is null
     );
  get diagnostics v_retired = row_count;

  delete from cloud.events
   where finished_at is not null
     and finished_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;

  delete from cloud.card_messages m
   where not exists (
     select 1 from cloud.events e
      where e.task_id = m.task_id
        and e.board_id is not distinct from m.board_id
        and e.workspace_id is not distinct from m.workspace_id
   );
  get diagnostics v_messages = row_count;

  delete from cloud.watch_summaries
   where created_at < now() - interval '30 days';
  get diagnostics v_summaries = row_count;

  return json_build_object(
    'deleted', v_deleted,
    'retired', v_retired,
    'cardMessages', v_messages,
    'watchSummaries', v_summaries
  );
end;
$$;
revoke all on function api.sweep_events() from public;
grant execute on function api.sweep_events() to service_role;

-- ---------------------------------------------------------------------------
-- A member an owner adds starts watching
-- ---------------------------------------------------------------------------

-- 0018's, seeding the watch as the membership lands. Routing works the day a team is formed:
-- the first question an owner's agent raises reaches the teammate they just added, and the
-- operating system's own permission prompt still gates every interruption.
create or replace function api.add_member(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_handle text,
  p_role text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_role text := case when p_role = 'owner' then 'owner' else 'member' end;
  v_member cloud.workspace_members;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);
  v_account := cloud.admitted_account_for(p_handle);

  select * into v_member from cloud.workspace_members
   where workspace_id = p_workspace and account_id = v_account;
  if v_member.account_id is not null then return cloud.member_json(v_member); end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('account', v_account, 'role', v_role)::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 4);
  insert into cloud.workspace_members (workspace_id, account_id, role)
  values (p_workspace, v_account, v_role)
  returning * into v_member;
  perform cloud.start_watching(p_workspace, v_account, cloud.newest_open_release(p_workspace));
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, null, 'member.added', null,
                      json_build_object('accountId', v_account, 'role', v_role)::jsonb);

  v_result := cloud.member_json(v_member);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.add_member(uuid, uuid, text, text, text, integer) from public;
grant execute on function api.add_member(uuid, uuid, text, text, text, integer) to service_role;

-- 0018's, taking the watch off with the member. Nothing reads a watch without a membership
-- beside it, so this is tidiness with one behaviour behind it: somebody added back starts on
-- the workspace's default rather than on whatever they last chose before they were removed.
create or replace function api.remove_member(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_account uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member cloud.workspace_members;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('account', p_account)::jsonb);
  if v_done is not null then return v_done; end if;

  delete from cloud.workspace_members
   where workspace_id = p_workspace and account_id = p_account
  returning * into v_member;
  if v_member.account_id is null then
    raise exception 'This workspace holds no such member.' using errcode = 'AKB10';
  end if;
  perform cloud.require_an_owner(p_workspace);
  delete from cloud.workspace_watches
   where workspace_id = p_workspace and account_id = p_account;

  perform cloud.count_write(p_daily_write_budget, 3);
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, null, 'member.removed', null,
                      json_build_object('accountId', p_account, 'role', v_member.role)::jsonb);

  v_result := json_build_object('removed', true, 'accountId', p_account);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.remove_member(uuid, uuid, text, uuid, integer) from public;
grant execute on function api.remove_member(uuid, uuid, text, uuid, integer) to service_role;
