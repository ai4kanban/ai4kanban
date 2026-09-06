-- Moving the watched scope raises nothing that was already waiting (#451).
--
-- `Configuration → Cloud → Watching` filters what the publisher raises. Widening it — one
-- release to every release — published every card the new scope brought in as ordinary news:
-- an unread bell row, a system notification and its own Slack/Lark message each. So `0.9 →
-- all` fired a burst, every switch back and forth fired it again, and the first fill of a
-- board fired the whole backlog at a chat that had just been connected.
--
-- What a switch brings in was ALREADY waiting. The person moving the switch is looking at
-- the bell; nothing about those cards is news. So a publication for a card the board held no
-- live event for when the scope moved carries a mark from the publisher through to storage,
-- and every reader takes one answer off it rather than each guessing at one:
--
--   `cloud.events.brought_in_at`  when the switch brought this publication in, and null on
--                                 ordinary news. Cleared by the next news write, because a
--                                 card that has moved since is news again, and read only
--                                 while the row is still asking — a delivery taken on such a
--                                 card ends as news like any other.
--
-- Two readers:
--   • the bell reads `broughtIn` off the event and lands the row read, raising nothing;
--   • `api.connector_jobs` owes such a publication no NEW message to a destination that was
--     already connected when it landed.
--
-- Narrowing is untouched. A retired event already leaves the bell without raising anybody,
-- and 0015's redraw is what keeps a chat from showing an **Implement** `record_event_action`
-- refuses.
--
-- Beside the mark, the switch gets one message of its own: `cloud.watch_summaries`, addressed
-- to the account that moved it, saying what is watched now and how many cards it brought in.
-- One message instead of N.

-- ---------------------------------------------------------------------------
-- The mark
-- ---------------------------------------------------------------------------

alter table cloud.events add column if not exists brought_in_at timestamptz;

comment on column cloud.events.brought_in_at is
  'When a scope change brought this publication in, and null on ordinary news. A row that carries one lands in the bell read and owes no new message to a destination already connected.';

-- Every event that exists was raised as news, which is what a null already says. Nothing to
-- backfill.

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
    'serverName', coalesce((
      select s.machine_name from cloud.board_servers s
       where s.board_id = p_event.board_id and s.enabled
       limit 1
    ), ''),
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    -- Only while the row is still ASKING. The mark says how this publication arrived, and a
    -- delivery taken on it afterwards ends as news like any other: an outcome nobody was
    -- told about is a delivery that finished in silence.
    'broughtIn', p_event.brought_in_at is not null and p_event.state = 'actionable',
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;

-- ---------------------------------------------------------------------------
-- The publication, carrying the mark
-- ---------------------------------------------------------------------------

-- 0008's, plus `p_brought_in`. Only the two branches that write NEWS touch the mark — a
-- publication that is news sets it, and one that is not clears it — so a card the switch
-- brought in and then edited is news like any other.
--
-- The quiet-refresh branch leaves it exactly as it stands: writing the revision through is
-- not the card moving, and it must not turn a quiet fill into an interruption.
create or replace function api.publish_event(
  p_subject uuid,
  p_board uuid,
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
  select * into v_board from cloud.boards where id = p_board;
  if v_board.id is null then
    perform cloud.count_write(p_daily_write_budget);
    insert into cloud.boards (id, owner_id, name) values (p_board, p_subject, '');
    select * into v_board from cloud.boards where id = p_board;
  end if;
  perform cloud.require_owner(v_board.owner_id, p_subject);

  -- The row this task's event should go on: the live one, or one retired as `stale` that
  -- nobody ever acted on. A row with an action on record is never reused — that one is
  -- history, and the bell's 30 days are what it is for.
  select * into v_event
  from cloud.events e
  where e.board_id = p_board
    and e.task_id = p_task_id
    and (
      e.finished_at is null
      or (e.state = 'stale' and not exists (select 1 from cloud.event_actions a where a.event_id = e.id))
    )
  order by e.changed_at desc
  limit 1;

  if v_event.id is not null then
    -- Nothing the person is being asked to decide has moved. Whatever else did — the card's
    -- revision, the release it is promised to — is written through without touching
    -- `changed_at`: an action binds the revision, so Cloud has to hold the current one, and
    -- a row the user has already read must stay read.
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
    -- Live work somebody already acted on is a delivery's to report, not a publication's to
    -- refresh: the revision it bound is the one the action was granted against.
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
    perform cloud.hint(p_subject, v_event.id);
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.events (
    owner_id, board_id, task_id, task_title, release, revision, kind, decision,
    questions, summary, notes, fingerprint, brought_in_at
  ) values (
    p_subject, p_board, p_task_id, p_task_title, coalesce(p_release, ''), p_revision,
    p_kind, p_decision, coalesce(p_questions, '[]'::jsonb), coalesce(p_summary, ''),
    coalesce(p_notes, ''), p_fingerprint, v_brought_in
  )
  returning * into v_event;
  perform cloud.hint(p_subject, v_event.id);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer) from public;
grant execute on function api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer) to service_role;
-- The argument is new, so the above is a second function rather than a replacement. 0008's
-- goes, or the schema keeps a publishing path that leaves no mark at all.
drop function if exists api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, integer);

-- ---------------------------------------------------------------------------
-- What a connector is owed, against the mark
-- ---------------------------------------------------------------------------

-- 0014's, plus the one clause the mark adds. A publication a scope change brought in owes no
-- NEW message to a destination that was already connected when it landed — that is the burst
-- this card is about. Two exceptions keep the chat truthful:
--
--   • a destination connected AFTERWARDS is asking for the board, so a mark that silences one
--     switch must not leave a channel connected after it permanently empty;
--   • a message that ALREADY EXISTS goes on following its card. An edit pings nobody and
--     costs no message, and a chat still showing "No longer waiting" over a card that is
--     waiting is 0015's defect the other way round.
--
-- `connected_at` is when the connection was made rather than when its destination was last
-- picked: re-pointing a chat is the same connection, and a board's whole backlog must not
-- arrive because somebody changed channel.
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
           s.state = 'active' as active,
           s.channel_id <> '' as addressed,
           s.created_at as connected_at,
           ''::text as thread_scope,
           json_build_object(
             'botToken', s.bot_token,
             'channelId', s.channel_id,
             'actorId', s.slack_user_id
           ) as posts
      from cloud.slack_connections s
     where p_connector = 'slack'
    union all
    select l.owner_id,
           l.state = 'active',
           l.destination_id <> '',
           l.created_at,
           l.destination_id || ':',
           json_build_object(
             'cloud', l.cloud,
             'tenantKey', l.tenant_key,
             'destinationId', l.destination_id,
             'direct', l.direct,
             'openId', l.open_id
           )
      from cloud.lark_connections l
     where p_connector = 'lark'
  )
  select coalesce(json_agg(job), '[]'::json) from (
    select json_build_object(
      'ownerId', e.owner_id,
      'eventId', e.id,
      'contentAt', e.content_at,
      'changedAt', e.content_at,
      'posts', c.posts,
      'messageRef', d.external_ref,
      'endingRef', d.ended_ref,
      'cardRef', (
        select m.external_ref
          from cloud.card_messages m
         where m.board_id = e.board_id
           and m.task_id = e.task_id
           and m.connector = p_connector
           and starts_with(m.external_ref, c.thread_scope)
      ),
      'card', (
        select cloud.event_json(newest)
          from cloud.events newest
         where newest.board_id = e.board_id
           and newest.task_id = e.task_id
         order by newest.content_at desc, newest.created_at desc, newest.id desc
         limit 1
      ),
      'threadRef', (
        select root.external_ref
          from cloud.events sibling
          join cloud.event_deliveries root
            on root.event_id = sibling.id and root.connector = p_connector
         where sibling.board_id = e.board_id
           and sibling.task_id = e.task_id
           and root.external_ref is not null
           and starts_with(root.external_ref, c.thread_scope)
         order by root.created_at, root.id
         limit 1
      ),
      'attempts', coalesce(d.attempts, 0),
      'event', cloud.event_json(e)
    ) as job
    from cloud.events e
    join connected c on c.owner_id = e.owner_id
    left join cloud.event_deliveries d on d.event_id = e.id and d.connector = p_connector
    where c.active
      and c.addressed
      and (p_event is null or e.id = p_event)
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
-- The switch's own message
-- ---------------------------------------------------------------------------

-- One row per switch that brought a waiting card in. It belongs to no card — every connector
-- message until now hung off an event, and a summary of twelve of them is not one of the
-- twelve — so it gets a row of its own rather than an event nobody can act on.
--
-- Best effort by design: it acknowledges a click whose result the user can already see in
-- the bell. So there is no delivery record and no retry loop behind it — the route posts it
-- once, and `op_id` is what stops a machine that never heard the answer posting a second.
create table if not exists cloud.watch_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  board_id uuid not null references cloud.boards (id) on delete cascade,
  -- What is watched now: `*` for every release, or one release's name.
  watching text not null,
  -- How many waiting cards the switch brought in. Never zero — a switch that brought none
  -- in queues nothing.
  cards integer not null,
  -- The attempt that recorded it, so a retry finds its own row rather than posting again.
  op_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists watch_summaries_owner on cloud.watch_summaries (owner_id, created_at desc);
alter table cloud.watch_summaries enable row level security;

comment on table cloud.watch_summaries is
  'One message per scope change that brought waiting cards in, addressed to the account that moved the switch. No card belongs to it.';

-- Write one down, and say whether this attempt is the one that wrote it. `false` is a retry
-- of an attempt that already landed, and the route posts nothing for it.
create or replace function api.record_watch_summary(
  p_subject uuid,
  p_op_id text,
  p_board uuid,
  p_watching text,
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
  insert into cloud.watch_summaries (owner_id, board_id, watching, cards, op_id)
  values (p_subject, p_board, p_watching, greatest(p_cards, 1), p_op_id)
  on conflict (op_id) do nothing
  returning * into v_summary;

  return json_build_object(
    'summaryId', coalesce(v_summary.id, (select s.id from cloud.watch_summaries s where s.op_id = p_op_id)),
    'posted', v_summary.id is not null,
    'boardName', v_board.name,
    'watching', p_watching,
    'cards', greatest(p_cards, 1)
  );
end;
$$;
revoke all on function api.record_watch_summary(uuid, text, uuid, text, integer, integer) from public;
grant execute on function api.record_watch_summary(uuid, text, uuid, text, integer, integer) to service_role;

-- Where this account's summary goes: every connection that is active and addressed, with the
-- same `posts` shape `api.connector_jobs` hands a delivery. The switching account's own
-- destinations and no others — a summary is addressed to the member who moved the switch.
create or replace function api.watch_summary_targets(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(target), '[]'::json) from (
    select json_build_object(
      'connector', 'slack',
      'posts', json_build_object('botToken', s.bot_token, 'channelId', s.channel_id)
    ) as target
      from cloud.slack_connections s
     where s.owner_id = p_subject and s.state = 'active' and s.channel_id <> ''
    union all
    select json_build_object(
      'connector', 'lark',
      'posts', json_build_object(
        'cloud', l.cloud,
        'tenantKey', l.tenant_key,
        'destinationId', l.destination_id,
        'direct', l.direct,
        'openId', l.open_id
      )
    )
      from cloud.lark_connections l
     where l.owner_id = p_subject and l.state = 'active' and l.destination_id <> ''
  ) addressed;
$$;
revoke all on function api.watch_summary_targets(uuid) from public;
grant execute on function api.watch_summary_targets(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The sweep
-- ---------------------------------------------------------------------------

-- 0013's, plus the summaries. A summary is a message that was sent once and is never read
-- back, so it is kept for the same 30 days an event is and then goes — the row exists to
-- stop a retry posting twice, and nothing retries after an afternoon.
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
      where e.board_id = m.board_id and e.task_id = m.task_id
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
revoke all on function api.sweep_events() from public;
grant execute on function api.sweep_events() to service_role;
