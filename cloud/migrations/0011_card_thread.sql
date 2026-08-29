-- A card's messages in one thread (#352).
--
-- Today one event is one top-level message, so a card that needs a person again — the first
-- question, the next one, the card being ready for review — scrolls past the chat once per
-- event, each time repeating the title, board and release the message before it already said.
--
-- A later event replies under the card's own earliest message instead. Nothing per-card is
-- stored for it: the root is the earliest message still RECORDED for that
-- `(board_id, task_id)` under that connector, read back out of the delivery rows already
-- kept. The cost is that the 30-day sweep takes a card's older messages with the events they
-- belong to, so a card that comes back once the last of them is gone starts a second thread.
--
-- A reply pings nobody, so one still asking for a decision names the account the connection
-- was made under — the one person a press is accepted from. That is Slack's `actorId`, which
-- goes in the connection's own half rather than beside the root: how a person is named is the
-- connector's, and the root is not.
--
-- Numbered after 0010 rather than beside it: migrations apply in filename order, and this one
-- rewrites the function 0010_lark.sql creates.

-- The root lookup runs once per due job and reads every event of one task, live or finished.
-- `events_one_live_per_task` is partial, so it answers only the live one.
create index if not exists events_board_task on cloud.events (board_id, task_id);

-- 0010's, plus the thread root and the account a press is accepted from.
--
-- `threadRef` is the earliest recorded message for the task under this connector — its own
-- when the event is the top of the thread, which is how the Worker tells a root from a reply,
-- and null when the card has no message left to reply to. Ordered by the delivery row's own
-- clock: that row is written with the first attempt at its message, so the oldest row is the
-- oldest message. Answered for every connector; Slack is the one that replies today.
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
           json_build_object(
             'cloud', l.cloud,
             'tenantKey', l.tenant_key,
             'destinationId', l.destination_id,
             'direct', l.direct
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
      'threadRef', (
        select root.external_ref
          from cloud.events sibling
          join cloud.event_deliveries root
            on root.event_id = sibling.id and root.connector = p_connector
         where sibling.board_id = e.board_id
           and sibling.task_id = e.task_id
           and root.external_ref is not null
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
