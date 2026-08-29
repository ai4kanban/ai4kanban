-- The card's own message, and the thread under it as a log (#359).
--
-- 0011 made the top of a card's thread the EARLIEST message still recorded for it, whichever
-- event that message belonged to. So the top of the thread stopped moving the moment that
-- event ended: a card whose questions were answered still led with the state that answer left
-- behind, while the **Implement** it now waits on sat further down.
--
-- The message belongs to the CARD instead. It is stored — one reference per board, task and
-- connector — rather than read back out of a delivery row, because a message that follows the
-- card cannot be identified with any one event's delivery. The Worker rewrites it whenever
-- what it shows moves, and appends one reply per event underneath, written once.
--
-- What that costs: one more stored reference per card per connector, swept with that card's
-- events and named on /privacy. What it buys: one place to act however long the thread grows,
-- and a chat that says when each event arrived.
--
-- Numbered after 0012 rather than beside it: migrations apply in filename order, and this one
-- rewrites the function 0012_lark_thread.sql creates.

-- ---------------------------------------------------------------------------
-- The card's message
-- ---------------------------------------------------------------------------

-- One row per card per connector. `external_ref` is the connector's own opaque text — a bare
-- Slack `ts`, Lark's `<destination>:<message_id>` — so the lookup below can scope it to the
-- destination this connection posts to now, exactly as 0012 scopes a delivery's.
--
-- It hangs off the board rather than the event: the card outlives every one of its events,
-- which is the whole point. `owner_id` is carried so a deleted account takes it too, and the
-- sweep is what takes it when the card's last event goes.
create table if not exists cloud.card_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  board_id uuid not null references cloud.boards (id) on delete cascade,
  task_id integer not null,
  connector text not null,
  external_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, task_id, connector)
);
alter table cloud.card_messages enable row level security;

comment on table cloud.card_messages is
  'The one message a card is shown as in a chat, per connector. No words: the chat''s own id for it.';

-- A card in flight when this ships keeps its message and its thread. The earliest message
-- still recorded for the card is the one 0011 was already treating as the top of the thread,
-- so adopting it opens no second message beside one people are already reading. A reply
-- written before this ships stays exactly as it was posted — nothing rewrites it.
--
-- A function rather than a bare statement so the check in cloud/test/sql/checks.sql runs the
-- adoption itself instead of a second copy of it that could drift. Idempotent: a card that
-- already has a message keeps the one it has.
create or replace function cloud.adopt_card_messages()
returns void
language sql
set search_path = ''
as $$
  insert into cloud.card_messages (owner_id, board_id, task_id, connector, external_ref, created_at)
  select distinct on (e.board_id, e.task_id, d.connector)
         e.owner_id, e.board_id, e.task_id, d.connector, d.external_ref, d.created_at
    from cloud.events e
    join cloud.event_deliveries d on d.event_id = e.id
   where d.external_ref is not null
   order by e.board_id, e.task_id, d.connector, d.created_at, d.id
  on conflict (board_id, task_id, connector) do nothing;
$$;
revoke all on function cloud.adopt_card_messages() from public;

select cloud.adopt_card_messages();

-- Where the card's message is, as the connector last left it.
--
-- Written the moment the chat answers rather than with the event's delivery: a reply that
-- then fails must not cost the card a second message, and neither must a second event of the
-- same card arriving in the same pass.
create or replace function api.record_card_message(
  p_subject uuid,
  p_board uuid,
  p_task_id integer,
  p_connector text,
  p_external_ref text,
  p_daily_write_budget integer
) returns json
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
revoke all on function api.record_card_message(uuid, uuid, integer, text, text, integer) from public;
grant execute on function api.record_card_message(uuid, uuid, integer, text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The job, with the card on it
-- ---------------------------------------------------------------------------

-- 0012's, plus the two things a message that follows the card needs.
--
-- `cardRef` is the card's own message under this connector, scoped by `thread_scope` the way
-- 0012 scopes a root — so #360 reads the same record for Lark and never offers one left in a
-- chat the account has moved away from. Null when the card has no message yet.
--
-- `card` is the card's NEWEST event, whichever event's delivery is due. The message is drawn
-- from it rather than from the event being delivered, so a pass cut short by the batch limit,
-- or a redraw aimed at one event, never leaves the message showing a state the card has moved
-- past. Ordered by `content_at`: that is the clock every field of an event moves, and the one
-- a rewrite is already owed against.
--
-- `threadRef` stays as 0012 left it. Lark replies under it until #360.
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
    order by e.content_at
    limit greatest(coalesce(p_limit, 20), 1)
  ) due;
$$;
revoke all on function api.connector_jobs(text, uuid, integer, integer) from public;
grant execute on function api.connector_jobs(text, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The sweep
-- ---------------------------------------------------------------------------
--
-- 0004's, plus the card's message. It is not an event's row, so no foreign key cascades it:
-- it goes when the card has no event left on Cloud, which is what /privacy promises. A card
-- that comes back after that opens a fresh message, exactly as one whose thread was swept
-- does today.

create or replace function api.sweep_events()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
  v_messages integer;
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

  return json_build_object('deleted', v_deleted, 'cardMessages', v_messages);
end;
$$;
revoke all on function api.sweep_events() from public;
grant execute on function api.sweep_events() to service_role;
