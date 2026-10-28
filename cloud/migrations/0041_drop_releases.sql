-- The board has no releases any more (#1671). An event names none, a watch is the switch alone,
-- and a reader is not sent `releases.md`.

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
    'boardId', coalesce(p_event.board_id::text, ''),
    'workspaceId', coalesce(p_event.workspace_id::text, ''),
    'boardName', coalesce(
      (select b.name from cloud.boards b where b.id = p_event.board_id),
      (select w.name from cloud.workspaces w where w.id = p_event.workspace_id),
      ''
    ),
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

drop function if exists api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid);

create or replace function api.publish_event(
  p_subject uuid,
  p_board uuid,
  p_workspace uuid,
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
    owner_id, board_id, workspace_id, task_id, task_title, revision, kind, decision,
    questions, summary, notes, fingerprint, brought_in_at
  ) values (
    coalesce(v_board.owner_id, p_subject), p_board, p_workspace, p_task_id, p_task_title,
    p_revision, p_kind, p_decision,
    coalesce(p_questions, '[]'::jsonb), coalesce(p_summary, ''), coalesce(p_notes, ''),
    p_fingerprint, v_brought_in
  )
  returning * into v_event;
  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid) from public;
grant execute on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The watch is the switch alone
-- ---------------------------------------------------------------------------

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
     and w.notify;
$$;
revoke all on function cloud.event_audience(cloud.events) from public;

drop function if exists cloud.start_watching(uuid, uuid, text);
create or replace function cloud.start_watching(p_workspace uuid, p_account uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into cloud.workspace_watches (workspace_id, account_id, notify)
  values (p_workspace, p_account, true)
  on conflict (workspace_id, account_id) do nothing;
end;
$$;
revoke all on function cloud.start_watching(uuid, uuid) from public;

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
  perform cloud.start_watching(v_workspace.id, p_subject);

  perform cloud.count_write(p_daily_write_budget, 4);
  perform cloud.audit(v_workspace.id, p_subject, null, 'workspace.created', null,
                      json_build_object('name', v_workspace.name)::jsonb);
  return cloud.workspace_json(v_workspace);
end;
$$;
revoke all on function api.create_workspace(uuid, text, text, integer) from public;
grant execute on function api.create_workspace(uuid, text, text, integer) to service_role;

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
  perform cloud.start_watching(p_workspace, v_account);
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

-- `watching` stays `*` for a checkout older than #1671, which mirrors it as what it raises.
drop function if exists cloud.watch_json(cloud.workspace_watches, uuid);
create or replace function cloud.watch_json(p_watch cloud.workspace_watches)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'notify', coalesce(p_watch.notify, true),
    'watching', '*',
    'carried', p_watch.carried_at is not null
  );
$$;
revoke all on function cloud.watch_json(cloud.workspace_watches) from public;

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
  return cloud.watch_json(v_watch);
end;
$$;
revoke all on function api.read_watch(uuid, uuid) from public;
grant execute on function api.read_watch(uuid, uuid) to service_role;

drop function if exists api.set_watch(uuid, uuid, boolean, text, integer);
create or replace function api.set_watch(
  p_subject uuid,
  p_workspace uuid,
  p_notify boolean,
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
  insert into cloud.workspace_watches as w (workspace_id, account_id, notify, carried_at)
  values (p_workspace, p_subject, coalesce(p_notify, true), now())
  on conflict (workspace_id, account_id) do update
    set notify = excluded.notify,
        carried_at = coalesce(w.carried_at, excluded.carried_at),
        updated_at = now()
  returning * into v_watch;
  return cloud.watch_json(v_watch);
end;
$$;
revoke all on function api.set_watch(uuid, uuid, boolean, integer) from public;
grant execute on function api.set_watch(uuid, uuid, boolean, integer) to service_role;

drop function if exists api.carry_watch(uuid, uuid, boolean, text, integer);
create or replace function api.carry_watch(
  p_subject uuid,
  p_workspace uuid,
  p_notify boolean,
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
    return cloud.watch_json(v_watch);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.workspace_watches as w (workspace_id, account_id, notify, carried_at)
  values (p_workspace, p_subject, coalesce(p_notify, true), now())
  on conflict (workspace_id, account_id) do update
    set notify = excluded.notify,
        carried_at = now(),
        updated_at = now()
  returning * into v_watch;
  return cloud.watch_json(v_watch);
end;
$$;
revoke all on function api.carry_watch(uuid, uuid, boolean, integer) from public;
grant execute on function api.carry_watch(uuid, uuid, boolean, integer) to service_role;

-- ---------------------------------------------------------------------------
-- A watch summary names no scope
-- ---------------------------------------------------------------------------

drop function if exists api.record_watch_summary(uuid, text, uuid, text, integer, integer);
create or replace function api.record_watch_summary(
  p_subject uuid,
  p_op_id text,
  p_board uuid,
  p_cards integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_summary cloud.watch_summaries;
begin
  select * into v_board from cloud.boards where id = p_board;
  if v_board.id is null then return null; end if;
  perform cloud.require_owner(v_board.owner_id, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.watch_summaries (owner_id, board_id, cards, op_id)
  values (p_subject, p_board, greatest(p_cards, 1), p_op_id)
  on conflict (op_id) do nothing
  returning * into v_summary;

  return json_build_object(
    'summaryId', coalesce(v_summary.id, (select s.id from cloud.watch_summaries s where s.op_id = p_op_id)),
    'posted', v_summary.id is not null,
    'boardName', v_board.name,
    'cards', greatest(p_cards, 1)
  );
end;
$$;
revoke all on function api.record_watch_summary(uuid, text, uuid, integer, integer) from public;
grant execute on function api.record_watch_summary(uuid, text, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- What a reader is sent
-- ---------------------------------------------------------------------------

create or replace function cloud.reader_documents()
returns text[]
language sql
immutable
as $$ select array['config.md', 'modules.md', 'todo/README.md']::text[] $$;
revoke all on function cloud.reader_documents() from public;

-- ---------------------------------------------------------------------------
-- What goes
-- ---------------------------------------------------------------------------

alter table cloud.events drop column release;
alter table cloud.workspace_watches drop column watching;
alter table cloud.watch_summaries drop column watching;
drop function cloud.newest_open_release(uuid);
drop function cloud.release_line_id(text);

comment on table cloud.workspace_watches is
  'One member''s notification switch inside one workspace (#328). It follows them to every machine, and is what lets Cloud resolve who is told about a card.';
