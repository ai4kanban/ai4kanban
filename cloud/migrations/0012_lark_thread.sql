-- A card's Lark messages in one 话题 (#353).
--
-- 0011 gave every connector the same root — the earliest message still recorded for a
-- `(board_id, task_id)` — and Slack was the one that replied under it. Lark replies now too,
-- and it needs two things Slack did not.
--
-- WHERE the root sits. Lark's reply endpoint takes no destination: a reply lands in whichever
-- chat the message it answers is in, so a root left behind in a chat the account has moved
-- away from would post there and Lark would answer success. The Worker records the chat
-- beside the message id in the delivery's own reference — `<destination>:<message_id>` — and
-- the root is looked up only among the references that start with the chat this connection
-- posts to now. A reference written before this change names no chat, so it is never a root:
-- that card keeps a message per event until the sweep takes it, which is what it has today.
--
-- WHO the reply names. A topic reply notifies the topic's subscribers and a bot opening one
-- subscribes nobody, so a reply asking for a decision carries an `<at>` on the account the
-- connection was made under. That is the connection's own `open_id`, and it goes in the Lark
-- half of `posts` beside Slack's `actorId` — how a person is named is the connector's
-- business, and the root is not.
--
-- Numbered after 0011 rather than beside it: migrations apply in filename order, and this one
-- rewrites the function 0011_card_thread.sql creates.

-- 0011's, plus the chat a root has to be in and the account a Lark reply names.
--
-- `thread_scope` is what a reference must start with to be this connection's root. Slack
-- records a bare `ts` and posts wherever `channelId` says, so its scope is empty and every
-- recorded message is a candidate — exactly 0011's behaviour.
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
