-- The events read is paged (#1245).
--
-- `api.list_events` answered every event the account held, and every start read it twice —
-- 700 rows and most of a megabyte, nearly all of it landed history nobody was looking at. It
-- now answers one page, newest change first, with a cursor to the next, narrowed by:
--
--   • `open`    — what the bell and the reconciliation need whole: every event not yet over,
--                 and each failed or interrupted delivery no later action on its card took over;
--   • `landed`  — completed deliveries, the Landed tab's history;
--   • a home    — one board or one workspace;
--   • a task    — one card's events, whose first page is its newest.
--
-- Nothing asked for is every event, one page at a time.

drop function if exists api.list_events(uuid);

create or replace function api.list_events(
  p_subject uuid,
  p_scope text default null,
  p_board uuid default null,
  p_workspace uuid default null,
  p_task integer default null,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select e.id, e.changed_at, e.state, e.task_id, e.board_id, e.workspace_id from cloud.events e
     where e.board_id is not null
       and e.owner_id = p_subject
       and p_workspace is null
       and (p_board is null or e.board_id = p_board)
    union all
    select e.id, e.changed_at, e.state, e.task_id, e.board_id, e.workspace_id from cloud.events e
     where e.workspace_id in (select m.workspace_id from cloud.workspace_members m where m.account_id = p_subject)
       and p_board is null
       and (p_workspace is null or e.workspace_id = p_workspace)
       and exists (select 1 from cloud.event_audience(e) a where a.account_id = p_subject)
  ),
  size as (select least(greatest(coalesce(p_limit, 30), 1), 100) as n),
  page as (
    select e.id, e.changed_at,
           row_number() over (order by e.changed_at desc, e.id desc) as at
      from mine e
     where (p_task is null or e.task_id = p_task)
       and (p_before_at is null or (e.changed_at, e.id) < (p_before_at, p_before_id))
       and case p_scope
         when 'landed' then e.state = 'completed'
         -- A failed or interrupted delivery waits for a person until a later action on the
         -- same card takes it over (#695); the bell reads the same rule again.
         when 'open' then e.state in ('actionable', 'accepted', 'waiting_for_server', 'running')
           or (e.state in ('failed', 'interrupted') and not exists (
             select 1 from cloud.events n
              where n.task_id = e.task_id
                and (n.board_id = e.board_id or n.workspace_id = e.workspace_id)
                and n.changed_at > e.changed_at
                and exists (select 1 from cloud.event_actions a where a.event_id = n.id)))
         else true
       end
     order by e.changed_at desc, e.id desc
     limit (select n + 1 from size)
  )
  select json_build_object(
    'events', coalesce(
      (select json_agg(cloud.event_json(ev) order by p.at)
         from page p join cloud.events ev on ev.id = p.id, size
        where p.at <= size.n),
      '[]'::json),
    -- The last row handed back, when there is a row after it.
    'next', (select (to_json(p.changed_at) #>> '{}') || '|' || p.id
               from page p, size
              where p.at = size.n and exists (select 1 from page q where q.at > size.n)));
$$;
revoke all on function api.list_events(uuid, text, uuid, uuid, integer, timestamptz, uuid, integer) from public;
grant execute on function api.list_events(uuid, text, uuid, uuid, integer, timestamptz, uuid, integer) to service_role;

-- A home's landed history, newest first, and what is still open, per publisher and per workspace.
create index if not exists events_board_landed
  on cloud.events (board_id, changed_at desc, id desc) where state = 'completed';
create index if not exists events_workspace_landed
  on cloud.events (workspace_id, changed_at desc, id desc) where state = 'completed';
create index if not exists events_owner_open
  on cloud.events (owner_id)
  where state in ('actionable', 'accepted', 'waiting_for_server', 'running', 'failed', 'interrupted');
create index if not exists events_workspace_task on cloud.events (workspace_id, task_id)
  where workspace_id is not null;
