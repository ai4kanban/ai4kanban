-- Slack: the account's one destination, the actor whose press it is, and the card text a
-- message is reviewed from (#320).
--
-- #319 stored an event's number, title, release, revision and questions — enough for a bell
-- sitting beside the board, not enough to review a card from a phone. Two things are added
-- here:
--
--   • the card's opening paragraph and its review notes, on the event, so a message can be
--     read while the machine that raised it is off;
--   • one Slack connection per account — a workspace, a bot token, a destination, and the
--     Slack user who made it — so a press in a channel is that account's durable action.
--
-- Cloud still learns nothing about where a board is. What is added is card TEXT the board
-- chose to publish, bounded by the publisher before it gets here.

-- ---------------------------------------------------------------------------
-- The card text an event carries
-- ---------------------------------------------------------------------------

alter table cloud.events add column if not exists summary text not null default '';
alter table cloud.events add column if not exists notes text not null default '';

comment on column cloud.events.summary is
  'The card''s opening paragraph, bounded by the publisher. Never the whole body.';
comment on column cloud.events.notes is
  'The card''s ## Worth noting and ## Worth noting after implementation, bounded by the publisher.';

-- #319's event, plus the review text and the machine a decision waits for.
--
-- `serverName` is read here rather than composed in the Worker because every surface that
-- renders a `waiting for server` event needs the same answer, and an empty one is the whole
-- of "this board has no server attached".
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
    'serverName', coalesce((
      select s.machine_name from cloud.board_servers s
       where s.board_id = p_event.board_id and s.enabled
       limit 1
    ), ''),
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;

-- #319's publication, carrying the review text. Everything else about it is unchanged: one
-- task keeps one row, an unmoved fingerprint writes nothing, and an event somebody acted on
-- is a delivery's to report rather than a publication's to refresh.
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
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_event cloud.events;
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
  where e.board_id = p_board
    and e.task_id = p_task_id
    and (
      e.finished_at is null
      or (e.state = 'stale' and not exists (select 1 from cloud.event_actions a where a.event_id = e.id))
    )
  order by e.changed_at desc
  limit 1;

  if v_event.id is not null then
    if v_event.state = 'actionable' and v_event.fingerprint = p_fingerprint then
      return cloud.event_json(v_event);
    end if;
    if v_event.state <> 'actionable' and v_event.state <> 'stale' then
      return cloud.event_json(v_event);
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.events
       set task_title = p_task_title,
           release = p_release,
           revision = p_revision,
           kind = p_kind,
           decision = p_decision,
           questions = coalesce(p_questions, '[]'::jsonb),
           summary = coalesce(p_summary, ''),
           notes = coalesce(p_notes, ''),
           fingerprint = p_fingerprint,
           state = 'actionable',
           finished_at = null,
           changed_at = now()
     where id = v_event.id
    returning * into v_event;
    perform cloud.hint(p_subject, v_event.id);
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.events (
    owner_id, board_id, task_id, task_title, release, revision, kind, decision,
    questions, summary, notes, fingerprint
  ) values (
    p_subject, p_board, p_task_id, p_task_title, coalesce(p_release, ''), p_revision,
    p_kind, p_decision, coalesce(p_questions, '[]'::jsonb), coalesce(p_summary, ''),
    coalesce(p_notes, ''), p_fingerprint
  )
  returning * into v_event;
  perform cloud.hint(p_subject, v_event.id);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, integer) from public;
grant execute on function api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, integer) to service_role;

-- #319's eleven-argument publication is replaced by the one above. Dropped rather than left
-- beside it: two functions of one name would leave PostgREST choosing between them.
drop function if exists api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, integer);

-- Which version of an event a message is currently showing.
--
-- Not `updated_at`, which says when the row was written: between reading an event and
-- Slack answering, that event can move again, and a message would then be left showing the
-- older card with nothing due. Storing the `changed_at` the message was DRAWN from makes
-- the comparison exact — a message is due whenever the event has moved past what it shows.
alter table cloud.event_deliveries add column if not exists rendered_at timestamptz;

-- ---------------------------------------------------------------------------
-- The Slack connection
-- ---------------------------------------------------------------------------

-- One row per account: the workspace it connected, the token the Worker posts with, the
-- conversation it posts to, and the Slack user who made it.
--
-- One connection per ACCOUNT, shared by every board that account turns Cloud on for, with
-- the board named on each message. A destination per board is a second setting to explain
-- in a preview whose whole audience is one person.
--
-- The Slack user is what makes a press an account's. A Slack id is unique only inside its
-- workspace, so the pair is what is matched, and the unique index below is what keeps one
-- Slack person from being two AI4Kanban accounts.
create table cloud.slack_connections (
  owner_id uuid primary key references cloud.accounts (id) on delete cascade,
  team_id text not null,
  team_name text not null default '',
  -- The bot token. It never leaves the Worker, and nothing outside `api` can read this
  -- table — see 0001 for why that is a property of the project.
  bot_token text not null,
  bot_user_id text not null default '',
  -- Where messages go. A channel or a direct message, whichever the user picked.
  channel_id text not null default '',
  channel_name text not null default '',
  slack_user_id text not null,
  -- `revoked` is Slack refusing us: the app was removed, the token was revoked, or the
  -- destination is gone. The pane shows it where the connection was made, because messages
  -- failing into silence read as no work waiting.
  state text not null default 'active' check (state in ('active', 'revoked')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index slack_connections_actor on cloud.slack_connections (team_id, slack_user_id);
alter table cloud.slack_connections enable row level security;

-- The OAuth handshake's nonce. Slack hands it back on the redirect, and it is the whole of
-- how that redirect — which carries no sign-in — is known to be this account's.
--
-- Spent as it is read: one answer, one use. Expired rows are cleared by the next install
-- rather than by a sweep of their own; there are never many.
create table cloud.slack_installs (
  state text primary key,
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table cloud.slack_installs enable row level security;

-- ---------------------------------------------------------------------------
-- What a connection looks like on the wire
-- ---------------------------------------------------------------------------
--
-- The token is deliberately absent: this is what the Configuration pane draws, and a token
-- that never reaches a client cannot leak from one.

create or replace function cloud.slack_json(p_connection cloud.slack_connections)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'connected', true,
    'teamName', p_connection.team_name,
    'channelId', p_connection.channel_id,
    'channelName', p_connection.channel_name,
    'slackUserId', p_connection.slack_user_id,
    'revoked', p_connection.state = 'revoked',
    'lastError', coalesce(p_connection.last_error, '')
  );
$$;
revoke all on function cloud.slack_json(cloud.slack_connections) from public;

-- ---------------------------------------------------------------------------
-- Connecting, choosing a destination, disconnecting
-- ---------------------------------------------------------------------------

-- Start one. The nonce is this account's for the next ten minutes.
create or replace function api.slack_begin_install(
  p_subject uuid,
  p_state text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from cloud.slack_installs where created_at < now() - interval '10 minutes';
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.slack_installs (state, owner_id) values (p_state, p_subject);
  return json_build_object('state', p_state);
end;
$$;
revoke all on function api.slack_begin_install(uuid, text, integer) from public;
grant execute on function api.slack_begin_install(uuid, text, integer) to service_role;

-- Finish one: the nonce back from Slack, spent, and the connection written under the
-- account that started it. A nonce we do not know is answered rather than raised — the
-- Worker turns it into a page a person is looking at, not a JSON refusal.
create or replace function api.slack_finish_install(
  p_state text,
  p_team_id text,
  p_team_name text,
  p_bot_token text,
  p_bot_user_id text,
  p_slack_user_id text,
  p_channel_id text,
  p_channel_name text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_taken uuid;
  v_connection cloud.slack_connections;
begin
  delete from cloud.slack_installs
   where state = p_state and created_at > now() - interval '10 minutes'
  returning owner_id into v_owner;
  if v_owner is null then
    return json_build_object('ok', false, 'reason', 'expired');
  end if;

  -- One Slack person is one AI4Kanban account. Connecting the same Slack user to a second
  -- account would leave a press with two accounts to be, and no way to pick.
  select owner_id into v_taken from cloud.slack_connections
   where team_id = p_team_id and slack_user_id = p_slack_user_id and owner_id <> v_owner;
  if v_taken is not null then
    return json_build_object('ok', false, 'reason', 'actor_taken');
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.slack_connections (
    owner_id, team_id, team_name, bot_token, bot_user_id, slack_user_id,
    channel_id, channel_name, state, last_error
  ) values (
    v_owner, p_team_id, coalesce(p_team_name, ''), p_bot_token, coalesce(p_bot_user_id, ''),
    p_slack_user_id, coalesce(p_channel_id, ''), coalesce(p_channel_name, ''), 'active', null
  )
  on conflict (owner_id) do update
    set team_id = excluded.team_id,
        team_name = excluded.team_name,
        bot_token = excluded.bot_token,
        bot_user_id = excluded.bot_user_id,
        slack_user_id = excluded.slack_user_id,
        channel_id = excluded.channel_id,
        channel_name = excluded.channel_name,
        state = 'active',
        last_error = null,
        updated_at = now();

  select * into v_connection from cloud.slack_connections where owner_id = v_owner;
  return json_build_object('ok', true, 'connection', cloud.slack_json(v_connection));
end;
$$;
revoke all on function api.slack_finish_install(text, text, text, text, text, text, text, text, integer) from public;
grant execute on function api.slack_finish_install(text, text, text, text, text, text, text, text, integer) to service_role;

-- What the Configuration pane draws. Null when this account has connected nothing.
create or replace function api.read_slack_connection(p_subject uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.slack_connections;
begin
  select * into v_connection from cloud.slack_connections where owner_id = p_subject;
  if v_connection.owner_id is null then return null; end if;
  return cloud.slack_json(v_connection);
end;
$$;
revoke all on function api.read_slack_connection(uuid) from public;
grant execute on function api.read_slack_connection(uuid) to service_role;

-- Where this account's messages go. Picking one again is what clears a refusal: the case
-- that reaches `revoked` is a destination the app was removed from.
create or replace function api.set_slack_destination(
  p_subject uuid,
  p_channel_id text,
  p_channel_name text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.slack_connections;
begin
  select * into v_connection from cloud.slack_connections where owner_id = p_subject;
  if v_connection.owner_id is null then return null; end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.slack_connections
     set channel_id = p_channel_id,
         channel_name = coalesce(p_channel_name, ''),
         state = 'active',
         last_error = null,
         updated_at = now()
   where owner_id = p_subject
  returning * into v_connection;
  return cloud.slack_json(v_connection);
end;
$$;
revoke all on function api.set_slack_destination(uuid, text, text, integer) from public;
grant execute on function api.set_slack_destination(uuid, text, text, integer) to service_role;

-- Stop posting. The token is answered so the Worker can hand it back to Slack; no board is
-- touched, and every event goes on exactly as it was.
create or replace function api.slack_disconnect(
  p_subject uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.slack_connections;
begin
  select * into v_connection from cloud.slack_connections where owner_id = p_subject;
  if v_connection.owner_id is null then return json_build_object('disconnected', true); end if;

  perform cloud.count_write(p_daily_write_budget);
  delete from cloud.slack_connections where owner_id = p_subject;
  return json_build_object('disconnected', true, 'botToken', v_connection.bot_token);
end;
$$;
revoke all on function api.slack_disconnect(uuid, integer) from public;
grant execute on function api.slack_disconnect(uuid, integer) to service_role;

-- The workspace's token, for a read the pane asks for — the conversations a destination is
-- picked from. Kept apart from `read_slack_connection` so the token is fetched only by the
-- one call that has to have it.
create or replace function api.slack_token(p_subject uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.slack_connections;
begin
  select * into v_connection from cloud.slack_connections where owner_id = p_subject;
  if v_connection.owner_id is null then return null; end if;
  return json_build_object(
    'botToken', v_connection.bot_token,
    'slackUserId', v_connection.slack_user_id,
    'channelId', v_connection.channel_id
  );
end;
$$;
revoke all on function api.slack_token(uuid) from public;
grant execute on function api.slack_token(uuid) to service_role;

-- Who a press in Slack is. The workspace AND the user, because a Slack id is unique only
-- inside its workspace. Null is an actor we have no account for, which the Worker answers
-- with its own words rather than acting.
create or replace function api.slack_actor(p_team_id text, p_slack_user_id text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.slack_connections;
begin
  select * into v_connection from cloud.slack_connections
   where team_id = p_team_id and slack_user_id = p_slack_user_id;
  if v_connection.owner_id is null then return null; end if;
  return json_build_object(
    'ownerId', v_connection.owner_id,
    'botToken', v_connection.bot_token,
    'channelId', v_connection.channel_id,
    'revoked', v_connection.state = 'revoked'
  );
end;
$$;
revoke all on function api.slack_actor(text, text) from public;
grant execute on function api.slack_actor(text, text) to service_role;

-- Slack refused us. Recorded where the connection was made, because a message failing into
-- silence reads to the user as no work waiting.
create or replace function api.slack_refused(
  p_owner uuid,
  p_error text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.count_write(p_daily_write_budget);
  update cloud.slack_connections
     set state = 'revoked', last_error = left(coalesce(p_error, ''), 300), updated_at = now()
   where owner_id = p_owner;
  return json_build_object('ok', true);
end;
$$;
revoke all on function api.slack_refused(uuid, text, integer) from public;
grant execute on function api.slack_refused(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- What Slack is owed
-- ---------------------------------------------------------------------------

-- Every event this account's Slack connection has a message to write or rewrite.
--
-- One event keeps ONE message however many attempts it takes: the delivery row holds the
-- `ts` Slack answered with, and an event that has one is edited in place rather than posted
-- again. A delivery is due when the event has moved since the message was last written —
-- that comparison is the whole of the synchronisation, and it needs no flag anybody has to
-- remember to set.
--
-- An event nobody has posted yet is due only while it is `actionable`: a task that stopped
-- needing a person before Slack ever heard about it is not news. Once a message exists it
-- follows the event to whatever it ends as.
create or replace function api.slack_jobs(
  p_event uuid,
  p_limit integer,
  p_max_attempts integer
) returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(job), '[]'::json) from (
    select json_build_object(
      'ownerId', e.owner_id,
      'eventId', e.id,
      'changedAt', e.changed_at,
      'botToken', c.bot_token,
      'channelId', c.channel_id,
      'messageRef', d.external_ref,
      'attempts', coalesce(d.attempts, 0),
      'event', cloud.event_json(e)
    ) as job
    from cloud.events e
    join cloud.slack_connections c on c.owner_id = e.owner_id
    left join cloud.event_deliveries d on d.event_id = e.id and d.connector = 'slack'
    where c.state = 'active'
      and c.channel_id <> ''
      and (p_event is null or e.id = p_event)
      and (e.state = 'actionable' or d.external_ref is not null)
      and (d.id is null or d.state <> 'sent' or d.rendered_at is null or d.rendered_at < e.changed_at)
      and coalesce(d.attempts, 0) < p_max_attempts
    order by e.changed_at
    limit greatest(coalesce(p_limit, 20), 1)
  ) due;
$$;
revoke all on function api.slack_jobs(uuid, integer, integer) from public;
grant execute on function api.slack_jobs(uuid, integer, integer) to service_role;

-- #319 left this ready for one connector and nobody called it. It is Slack's now, with two
-- lines added.
--
-- A message that got through resets the attempt count, so an event edited a hundred times
-- over a week never runs out of attempts while one Slack keeps refusing stops after a
-- handful. And `p_rendered_at` is the version the message shows — the caller's own answer,
-- not `now()`, so an event that moved while Slack was answering is still due.
create or replace function api.record_event_delivery(
  p_subject uuid,
  p_event uuid,
  p_connector text,
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
  perform cloud.require_owner(v_event.owner_id, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.event_deliveries as d (
    event_id, connector, state, attempts, external_ref, last_error, rendered_at
  ) values (
    p_event, p_connector, p_state, case when p_state = 'sent' then 0 else 1 end,
    p_external_ref, nullif(p_last_error, ''),
    case when p_state = 'sent' then p_rendered_at end
  )
  on conflict (event_id, connector) do update
    set state = excluded.state,
        attempts = case when excluded.state = 'sent' then 0 else d.attempts + 1 end,
        external_ref = coalesce(excluded.external_ref, d.external_ref),
        last_error = excluded.last_error,
        rendered_at = coalesce(excluded.rendered_at, d.rendered_at),
        updated_at = now();
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_delivery(uuid, uuid, text, text, text, text, timestamptz, integer) from public;
grant execute on function api.record_event_delivery(uuid, uuid, text, text, text, text, timestamptz, integer) to service_role;

-- #319's seven-argument delivery is replaced by the one above. Dropped rather than left
-- beside it: two functions of one name would leave PostgREST choosing between them.
drop function if exists api.record_event_delivery(uuid, uuid, text, text, text, text, integer);

-- ---------------------------------------------------------------------------
-- The sweep
-- ---------------------------------------------------------------------------
--
-- A delivery goes with the event it belongs to — `on delete cascade` — so #319's sweep is
-- the whole of the retention this card adds. A connection is the account's and is kept
-- until the account disconnects or is deleted.
