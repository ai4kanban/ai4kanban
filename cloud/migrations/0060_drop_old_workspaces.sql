-- The old board workspace is gone (#2054): its nine tables, the `workspace_id uuid` columns on
-- events, requests, card messages and board servers, and every function only it used. An event
-- now always belongs to a board. The public API's workspaces (`cloud.v1_workspaces`) are untouched.

-- Workspace-owned events, requests, card messages and nodes go with their workspace.
delete from cloud.workspaces;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create or replace function cloud.event_json(p_event cloud.events)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_event.id,
    'boardId', p_event.board_id,
    'boardName', coalesce((select b.name from cloud.boards b where b.id = p_event.board_id), ''),
    'taskId', p_event.task_id,
    'taskTitle', p_event.task_title,
    'revision', p_event.revision,
    'kind', p_event.kind,
    'decision', coalesce(
      (select a.decision from cloud.event_actions a where a.event_id = p_event.id),
      p_event.decision
    ),
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
      ''
    ),
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'broughtIn', p_event.brought_in_at is not null and p_event.state = 'actionable',
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;

create or replace function cloud.event_audience(p_event cloud.events)
returns table (account_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p_event.owner_id;
$$;

create or replace function cloud.require_event_reader(p_event cloud.events, p_subject uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform cloud.require_owner(p_event.owner_id, p_subject);
end;
$$;

create or replace function cloud.require_node_reader(p_node cloud.board_servers, p_subject uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform cloud.require_owner(p_node.owner_id, p_subject);
end;
$$;

create or replace function cloud.require_request_reader(p_request cloud.event_requests, p_subject uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform cloud.require_owner(p_request.owner_id, p_subject);
end;
$$;

drop function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid);

create function api.publish_event(
  p_subject uuid,
  p_board uuid,
  p_task_id integer,
  p_task_title text,
  p_revision text,
  p_kind text,
  p_decision text,
  p_questions jsonb,
  p_summary text,
  p_notes text,
  p_fingerprint text,
  p_brought_in boolean,
  p_daily_write_budget integer,
  p_besides uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_event cloud.events;
  v_brought_in timestamptz := case when coalesce(p_brought_in, false) then now() else null end;
begin
  select * into v_board from cloud.boards where id = p_board;
  if v_board.id is null then
    perform cloud.count_write(p_daily_write_budget);
    insert into cloud.boards (id, owner_id, name) values (p_board, p_subject, '');
    select * into v_board from cloud.boards where id = p_board;
  end if;
  perform cloud.require_owner(v_board.owner_id, p_subject);

  select * into v_event
  from cloud.events e
  where e.task_id = p_task_id
    and e.board_id = p_board
    and (p_besides is null or e.id <> p_besides)
    and (
      e.finished_at is null
      or (e.state = 'stale' and not exists (select 1 from cloud.event_actions a where a.event_id = e.id))
    )
  order by e.changed_at desc
  limit 1;

  if v_event.id is not null then
    if v_event.state = 'actionable' and v_event.fingerprint = p_fingerprint then
      if v_event.revision is distinct from p_revision then
        perform cloud.count_write(p_daily_write_budget);
        update cloud.events
           set revision = p_revision,
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
    owner_id, board_id, task_id, task_title, revision, kind, decision,
    questions, summary, notes, fingerprint, brought_in_at
  ) values (
    v_board.owner_id, p_board, p_task_id, p_task_title, p_revision, p_kind, p_decision,
    coalesce(p_questions, '[]'::jsonb), coalesce(p_summary, ''), coalesce(p_notes, ''),
    p_fingerprint, v_brought_in
  )
  returning * into v_event;
  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;

revoke all on function api.publish_event(uuid, uuid, integer, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid) from public;
grant execute on function api.publish_event(uuid, uuid, integer, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid) to service_role;

drop function api.list_events(uuid, text, uuid, uuid, integer, timestamptz, uuid, integer);

create function api.list_events(
  p_subject uuid,
  p_scope text default null,
  p_board uuid default null,
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
  with size as (select least(greatest(coalesce(p_limit, 30), 1), 100) as n),
  page as (
    select e.id, e.changed_at,
           row_number() over (order by e.changed_at desc, e.id desc) as at
      from cloud.events e
     where e.owner_id = p_subject
       and (p_board is null or e.board_id = p_board)
       and (p_task is null or e.task_id = p_task)
       and (p_before_at is null or (e.changed_at, e.id) < (p_before_at, p_before_id))
       and case p_scope
         when 'landed' then e.state = 'completed'
         -- A failed or interrupted delivery waits for a person until a later action on the
         -- same card takes it over (#695); the bell reads the same rule again.
         when 'open' then e.state in ('actionable', 'accepted', 'waiting_for_server', 'running')
           or (e.state in ('failed', 'interrupted') and not exists (
             select 1 from cloud.events n
              where n.task_id = e.task_id
                and n.board_id = e.board_id
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

revoke all on function api.list_events(uuid, text, uuid, integer, timestamptz, uuid, integer) from public;
grant execute on function api.list_events(uuid, text, uuid, integer, timestamptz, uuid, integer) to service_role;

drop function api.record_card_message(uuid, uuid, uuid, integer, text, text, text, integer);

create function api.record_card_message(
  p_subject uuid,
  p_board uuid,
  p_task_id integer,
  p_connector text,
  p_destination text,
  p_external_ref text,
  p_daily_write_budget integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
begin
  select * into v_board from cloud.boards where id = p_board;
  if v_board.id is null then return null; end if;
  perform cloud.require_owner(v_board.owner_id, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.card_messages as m (owner_id, board_id, task_id, connector, external_ref)
  values (v_board.owner_id, p_board, p_task_id, p_connector, p_external_ref)
  on conflict (board_id, task_id, connector) do update
    set external_ref = excluded.external_ref,
        updated_at = now();
  return json_build_object('externalRef', p_external_ref);
end;
$$;

revoke all on function api.record_card_message(uuid, uuid, integer, text, text, text, integer) from public;
grant execute on function api.record_card_message(uuid, uuid, integer, text, text, text, integer) to service_role;

create or replace function api.record_event_action(
  p_subject uuid,
  p_op_id text,
  p_event uuid,
  p_decision text,
  p_revision text,
  p_answers jsonb,
  p_state text,
  p_daily_write_budget integer
)
returns json
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
  -- `stale` and unacted is the row this click is about, taken down a moment too early. Every
  -- other state is an event whose work is somebody else's to finish.
  if v_event.state <> 'actionable' and v_event.state <> 'stale' then
    raise exception 'That event is no longer waiting for anybody.' using errcode = 'AKB03';
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  insert into cloud.event_actions (event_id, owner_id, decision, revision, answers, op_id)
  values (p_event, p_subject, p_decision, p_revision, coalesce(p_answers, '[]'::jsonb), p_op_id);

  update cloud.events
     set state = case when p_state = 'waiting_for_server' then 'waiting_for_server' else 'accepted' end,
         -- A retirement finished this event; the action un-finishes it, or the sweep that
         -- clears finished rows after 30 days would take a live delivery's row with it.
         finished_at = null,
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

create or replace function api.connector_jobs(p_connector text, p_event uuid, p_limit integer, p_max_attempts integer)
returns json
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
           and m.board_id = e.board_id
           and m.connector = p_connector
           and m.destination = c.key
           and starts_with(m.external_ref, c.thread_scope)
      ),
      'card', (
        select cloud.event_json(newest)
          from cloud.events newest
         where newest.task_id = e.task_id
           and newest.board_id = e.board_id
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
           and sibling.board_id = e.board_id
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
      -- The earliest connection decides whether a card a scope change brought in owes a
      -- message at all.
      select distinct on (n.destination)
             n.owner_id, n.connected_at, n.thread_scope, n.posts, ''::text as key
        from connected n
       where n.owner_id = e.owner_id
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

create or replace function api.sweep_events()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
  v_messages integer;
  v_summaries integer;
begin
  delete from cloud.events
   where finished_at is not null
     and finished_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;

  delete from cloud.card_messages m
   where not exists (
     select 1 from cloud.events e
      where e.task_id = m.task_id
        and e.board_id = m.board_id
   );
  get diagnostics v_messages = row_count;

  delete from cloud.watch_summaries
   where created_at < now() - interval '30 days';
  get diagnostics v_summaries = row_count;

  return json_build_object(
    'deleted', v_deleted,
    'cardMessages', v_messages,
    'watchSummaries', v_summaries
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------

create or replace function cloud.raise_request(p_event cloud.events, p_actor uuid)
returns cloud.event_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server uuid;
  v_request cloud.event_requests;
begin
  select id into v_server from cloud.board_servers where board_id = p_event.board_id and enabled;
  insert into cloud.event_requests (owner_id, board_id, event_id, server_id)
  values (p_event.owner_id, p_event.board_id, p_event.id, v_server)
  on conflict (event_id) do nothing
  returning * into v_request;
  if v_request.id is null then
    select * into v_request from cloud.event_requests where event_id = p_event.id;
  end if;
  perform cloud.hint_server(p_event.owner_id, v_server, v_request.id);
  return v_request;
end;
$$;

create or replace function cloud.request_json(p_request cloud.event_requests)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_request.id,
    'boardId', p_request.board_id,
    'eventId', p_request.event_id,
    'serverId', p_request.server_id,
    'claimedBy', p_request.claimed_by,
    'state', case when cloud.request_interrupted(p_request) then 'interrupted' else p_request.state end,
    'leaseExpiresAt', p_request.lease_expires_at,
    'taskId', e.task_id,
    'taskTitle', e.task_title,
    'revision', a.revision,
    'decision', a.decision,
    'answers', a.answers,
    'questions', e.questions
  )
  from cloud.events e
  join cloud.event_actions a on a.event_id = e.id
  where e.id = p_request.event_id;
$$;

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
  if not v_server.enabled then return '[]'::json; end if;

  return coalesce((
    select json_agg(cloud.request_json(r) order by r.created_at)
    from cloud.event_requests r
    where r.state <> 'finished'
      and r.board_id = v_server.board_id
      and (r.claimed_by is null or r.claimed_by = v_server.id)
  ), '[]'::json);
end;
$$;

create or replace function api.claim_request(p_subject uuid, p_server uuid, p_request uuid, p_lease_seconds integer, p_daily_write_budget integer)
returns json
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
  if not v_server.enabled then
    return json_build_object('claimed', false, 'reason', 'This machine no longer runs that board’s work.');
  end if;

  select * into v_request from cloud.event_requests where id = p_request for update;
  if v_request.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such request.');
  end if;
  perform cloud.require_request_reader(v_request, p_subject);
  if v_request.board_id <> v_server.board_id then
    return json_build_object('claimed', false, 'reason', 'That request belongs to another board.');
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

create or replace function api.renew_claim(p_subject uuid, p_server uuid, p_request uuid, p_lease_seconds integer, p_daily_write_budget integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server cloud.board_servers;
  v_request cloud.event_requests;
begin
  select * into v_server from cloud.board_servers where id = p_server;
  if v_server.id is null or not v_server.enabled then
    return json_build_object('renewed', false);
  end if;
  perform cloud.require_node_reader(v_server, p_subject);

  select * into v_request from cloud.event_requests where id = p_request;
  if v_request.id is null then return json_build_object('renewed', false); end if;
  perform cloud.require_request_reader(v_request, p_subject);
  if v_request.state <> 'claimed' or v_request.claimed_by <> v_server.id then
    return json_build_object('renewed', false);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.event_requests
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_request
  returning * into v_request;
  return json_build_object('renewed', true, 'request', cloud.request_json(v_request));
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create or replace function cloud.remove_account(p_handle text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_subjects uuid[];
  v_removed integer;
begin
  select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_subjects
  from (
    select a.subject as s from cloud.admitted_accounts a
     where a.subject is not null and lower(a.handle) = lower(p_handle)
    union
    select a.id from cloud.accounts a where lower(a.handle) = lower(p_handle)
  ) found;

  delete from cloud.admitted_accounts
   where lower(handle) = lower(p_handle) or subject = any (v_subjects);
  delete from cloud.invite_requests where subject = any (v_subjects);
  delete from cloud.accounts where id = any (v_subjects);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- What only the old workspace used
-- ---------------------------------------------------------------------------

drop function api.add_member(uuid, uuid, text, text, text, integer);
drop function api.begin_import(uuid, uuid, text, text, integer);
drop function api.carry_watch(uuid, uuid, boolean, integer);
drop function api.confirm_delivery(uuid, uuid, text, uuid, uuid, text, jsonb, integer);
drop function api.create_workspace(uuid, text, text, integer);
drop function api.delete_archived_cards(uuid, uuid, text, uuid, jsonb, integer);
drop function api.delete_workspace(uuid, uuid);
drop function api.export_board(uuid, uuid);
drop function api.export_events(uuid, uuid, bigint, integer);
drop function api.finish_import(uuid, uuid, text, integer, integer);
drop function api.import_deliveries(uuid, uuid, text, jsonb, integer);
drop function api.import_events(uuid, uuid, text, jsonb, integer);
drop function api.list_locks(uuid, uuid);
drop function api.list_members(uuid, uuid);
drop function api.list_nodes(uuid, uuid);
drop function api.list_workspace_events(uuid, uuid);
drop function api.list_workspaces(uuid);
drop function api.open_delivery(uuid, uuid, text, uuid, integer, integer);
drop function api.prune_operations();
drop function api.read_archive(uuid, uuid);
drop function api.read_audit(uuid, uuid, integer);
drop function api.read_card(uuid, uuid, integer);
drop function api.read_cards(uuid, uuid);
drop function api.read_deliveries(uuid, uuid, integer);
drop function api.read_documents(uuid, uuid, text);
drop function api.read_for_reader(uuid, uuid);
drop function api.read_snapshot(uuid, uuid);
drop function api.read_watch(uuid, uuid);
drop function api.read_workspace(uuid, uuid);
drop function api.record_delivery(uuid, uuid, text, uuid, uuid, jsonb, text, text, integer);
drop function api.register_node(uuid, uuid, uuid, text, jsonb, integer);
drop function api.release_lock(uuid, uuid, integer, uuid);
drop function api.remove_member(uuid, uuid, text, uuid, integer);
drop function api.remove_node(uuid, uuid, text, uuid, integer);
drop function api.rename_node(uuid, uuid, text, uuid, text, integer);
drop function api.rename_workspace(uuid, uuid, text, uuid, text, text, integer);
drop function api.renew_node(uuid, uuid, uuid, integer, integer);
drop function api.set_member_role(uuid, uuid, text, uuid, text, integer);
drop function api.set_watch(uuid, uuid, boolean, integer);
drop function api.take_lock(uuid, uuid, uuid, integer, uuid, integer, integer);
drop function api.write_cards(uuid, uuid, text, uuid, jsonb, integer);
drop function api.write_documents(uuid, uuid, text, uuid, uuid, jsonb, integer);
drop function cloud.audit(uuid, uuid, uuid, text, integer, jsonb);
drop function cloud.admitted_account_for(text);
drop function cloud.card_json(cloud.workspace_cards);
drop function cloud.claim_operation(uuid, text, jsonb);
drop function cloud.delivery_json(cloud.workspace_deliveries);
drop function cloud.document_json(cloud.workspace_documents);
drop function cloud.expect_revision(text, bigint, text);
drop function cloud.live_kinds();
drop function cloud.lock_holder(uuid, uuid);
drop function cloud.lock_json(cloud.workspace_locks, text);
drop function cloud.member_json(cloud.workspace_members);
drop function cloud.member_role(uuid, uuid);
drop function cloud.node_json(cloud.board_servers);
drop function cloud.portable_delivery(jsonb);
drop function cloud.reader_card_json(cloud.workspace_cards);
drop function cloud.reader_documents();
drop function cloud.reader_workspace_json(cloud.workspaces);
drop function cloud.record_operation(uuid, text, json);
drop function cloud.require_an_owner(uuid);
drop function cloud.require_lock(uuid, integer, uuid);
drop function cloud.require_member(uuid, uuid);
drop function cloud.require_node(uuid, uuid);
drop function cloud.require_workspace_owner(uuid, uuid);
drop function cloud.revision_at(uuid, integer);
drop function cloud.start_watching(uuid, uuid);
drop function cloud.touch_workspace(uuid);
drop function cloud.watch_json(cloud.workspace_watches);
drop function cloud.workspace_counts(uuid);
drop function cloud.workspace_for(uuid, uuid);
drop function cloud.workspace_for_update(uuid, uuid);
drop function cloud.workspace_json(cloud.workspaces);

drop trigger workspace_audit_immutable on cloud.workspace_audit;
drop function cloud.audit_is_immutable();

alter table cloud.events
  drop constraint events_one_home,
  drop column workspace_id,
  alter column board_id set not null;

alter table cloud.event_requests
  drop constraint event_requests_one_home,
  drop column workspace_id,
  drop column actor_id,
  alter column board_id set not null;

alter table cloud.card_messages
  drop constraint card_messages_one_home,
  drop column workspace_id,
  alter column board_id set not null;

alter table cloud.board_servers
  drop constraint board_servers_one_home,
  drop column workspace_id,
  drop column node_name,
  drop column lease_expires_at,
  drop column removed_at,
  alter column board_id set not null;

drop table
  cloud.workspace_audit,
  cloud.workspace_cards,
  cloud.workspace_deliveries,
  cloud.workspace_documents,
  cloud.workspace_locks,
  cloud.workspace_members,
  cloud.workspace_operations,
  cloud.workspace_watches,
  cloud.workspaces;
