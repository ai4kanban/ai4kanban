-- The line that says how a delivery ended (#359 left this out).
--
-- 0013 made the top message the CARD and the thread its log: one reply per event, written
-- once, and every move of the card a rewrite of the top message rather than a new line. That
-- loses the one thing the chat cannot afford to lose. A delivery refused because the checkout
-- has uncommitted changes rewrites the top message with the reason; the board then puts the
-- card back to `ready` and raises a fresh event, and the next rewrite takes the reason with
-- it. What the user has to fix was readable for as long as it took the board to come back —
-- under a minute, in practice.
--
-- So an ending that is not `completed` gets a reply of its own, written once and never
-- rewritten, carrying the state and why it ended that way. `completed` gets none: nothing
-- follows a delivery that landed, so the top message goes on saying so.
--
-- Where that reply is, is stored beside the event's own. It is a second message under one
-- delivery record, and a reference the connector can read back is the whole of what stops it
-- being posted again on every pass.

-- ---------------------------------------------------------------------------
-- The ending's own reference
-- ---------------------------------------------------------------------------

alter table cloud.event_deliveries add column if not exists ended_ref text;

comment on column cloud.event_deliveries.ended_ref is
  'The chat''s own id for the reply saying how this delivery ended. Null until it has one.';

-- Written the moment the chat answers rather than with the event's delivery, for the reason
-- 0013 records the card's message that way: a pass that then fails, retried an hour later,
-- must not cost the thread a second ending.
--
-- `coalesce(d.ended_ref, excluded.ended_ref)` is what makes it written once. A row that
-- already names an ending keeps the one it has, whatever a later pass believes.
create or replace function api.record_delivery_ending(
  p_subject uuid,
  p_event uuid,
  p_connector text,
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
  perform cloud.require_owner(v_event.owner_id, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.event_deliveries as d (event_id, connector, ended_ref)
  values (p_event, p_connector, p_external_ref)
  on conflict (event_id, connector) do update
    set ended_ref = coalesce(d.ended_ref, excluded.ended_ref),
        updated_at = now();
  return json_build_object('endedRef', p_external_ref);
end;
$$;
revoke all on function api.record_delivery_ending(uuid, uuid, text, text, integer) from public;
grant execute on function api.record_delivery_ending(uuid, uuid, text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The job, with the ending on it
-- ---------------------------------------------------------------------------

-- 0013's, plus `endingRef` — the reply this delivery's ending already has, and null when it
-- has none. A connector reads null as "owed" and an absent field as "this schema does not
-- keep one", which is why the key is always built rather than left out.
--
-- Nothing is owed here that was not already owed: an ending moves `content_at`, so the pass
-- that redraws the top message with the reason is the same pass that logs it. An event that
-- ended before this shipped is already rendered and is not raked back up — the thread says
-- what happened from here, not what happened before it could.
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
    order by e.content_at
    limit greatest(coalesce(p_limit, 20), 1)
  ) due;
$$;
revoke all on function api.connector_jobs(text, uuid, integer, integer) from public;
grant execute on function api.connector_jobs(text, uuid, integer, integer) to service_role;
