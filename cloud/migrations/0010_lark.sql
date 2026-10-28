-- Lark: a second connector beside Slack, and the connector-neutral query both are owed a
-- message by (#351).
--
-- Two things happen here:
--
--   • `api.slack_jobs` becomes `api.connector_jobs`, which answers for any connector by
--     name. The comparison that decides what is due — the event has moved past what the
--     message shows — was never Slack's, and a second copy of it would be a second thing to
--     keep true;
--   • one Lark connection per account, with the cloud it came from on it, the tenant that
--     installed the app, the destination it posts to, and the Lark user whose press it is.
--
-- 飞书 and Lark international are two platforms rather than two addresses of one, so the
-- connection records which. Nothing else does: no board and no card ever learns about it.
--
-- Cloud still learns nothing about where a board is.

-- ---------------------------------------------------------------------------
-- The Lark connection
-- ---------------------------------------------------------------------------

-- One row per account, like Slack's. One connection shared by every board that account turns
-- Cloud on for, with the board named on each message.
--
-- The tenant AND the user are what a press is matched on: a Lark `open_id` is unique only
-- inside the app it was issued for, and a tenant key means nothing without the cloud it
-- belongs to. The unique index below is what keeps one Lark person from being two AI4Kanban
-- accounts.
create table cloud.lark_connections (
  owner_id uuid primary key references cloud.accounts (id) on delete cascade,
  -- Which of the two clouds this connection came from: `feishu` or `lark`.
  cloud text not null check (cloud in ('feishu', 'lark')),
  tenant_key text not null,
  open_id text not null,
  union_id text not null default '',
  user_name text not null default '',
  -- Where messages go: a group chat the bot is in, or the direct message with the person who
  -- connected — which is that person's own `open_id`, and the one destination that cannot
  -- have been dissolved or left.
  destination_id text not null default '',
  destination_name text not null default '',
  direct boolean not null default true,
  -- `revoked` is Lark refusing us: the tenant uninstalled the app, or the destination is
  -- gone. The pane shows it where the connection was made, because messages failing into
  -- silence read as no work waiting.
  state text not null default 'active' check (state in ('active', 'revoked')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index lark_connections_actor on cloud.lark_connections (cloud, tenant_key, open_id);
alter table cloud.lark_connections enable row level security;

-- The authorization's nonce. Lark hands it back on the redirect, and it is the whole of how
-- that redirect — which carries no sign-in — is known to be this account's. The cloud is on
-- it too, so a nonce minted for one cloud cannot be spent on the other.
--
-- Spent as it is read: one answer, one use. Expired rows are cleared by the next attempt
-- rather than by a sweep of their own; there are never many.
create table cloud.lark_connects (
  state text primary key,
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  cloud text not null check (cloud in ('feishu', 'lark')),
  created_at timestamptz not null default now()
);
alter table cloud.lark_connects enable row level security;

-- The `app_ticket` the platform pushes on its own schedule. It is the APP's rather than any
-- account's — one per cloud — and every tenant token is minted from it.
create table cloud.lark_apps (
  cloud text primary key check (cloud in ('feishu', 'lark')),
  app_ticket text not null,
  updated_at timestamptz not null default now()
);
alter table cloud.lark_apps enable row level security;

-- The token a tenant's messages go out on, held here and renewed here. Two hours each, so a
-- busy account mints a handful a day rather than one per message.
create table cloud.lark_tenant_tokens (
  cloud text not null check (cloud in ('feishu', 'lark')),
  tenant_key text not null,
  token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (cloud, tenant_key)
);
alter table cloud.lark_tenant_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- What a connection looks like on the wire
-- ---------------------------------------------------------------------------
--
-- No token, ever: this is what the Configuration pane draws, and a token that never reaches
-- a client cannot leak from one.

create or replace function cloud.lark_json(p_connection cloud.lark_connections)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'connected', true,
    'cloud', p_connection.cloud,
    'cloudName', case p_connection.cloud when 'feishu' then '飞书' else 'Lark' end,
    'userName', p_connection.user_name,
    'destinationId', p_connection.destination_id,
    'destinationName', p_connection.destination_name,
    'direct', p_connection.direct,
    'revoked', p_connection.state = 'revoked',
    'lastError', coalesce(p_connection.last_error, '')
  );
$$;
revoke all on function cloud.lark_json(cloud.lark_connections) from public;

-- ---------------------------------------------------------------------------
-- Connecting, choosing a destination, disconnecting
-- ---------------------------------------------------------------------------

-- Start one. The nonce is this account's, for this cloud, for the next ten minutes.
create or replace function api.lark_begin_connect(
  p_subject uuid,
  p_state text,
  p_cloud text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from cloud.lark_connects where created_at < now() - interval '10 minutes';
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.lark_connects (state, owner_id, cloud) values (p_state, p_subject, p_cloud);
  return json_build_object('state', p_state);
end;
$$;
revoke all on function api.lark_begin_connect(uuid, text, text, integer) from public;
grant execute on function api.lark_begin_connect(uuid, text, text, integer) to service_role;

-- Finish one: the nonce back from Lark, spent, and the connection written under the account
-- that started it. A nonce we do not know is answered rather than raised — the Worker turns
-- it into a page a person is looking at, not a JSON refusal.
--
-- Connecting replaces whatever this account had, cloud and all: the account has one Lark
-- destination, and moving from 飞书 to Lark international is the same move as moving between
-- two chats.
create or replace function api.lark_finish_connect(
  p_state text,
  p_cloud text,
  p_tenant_key text,
  p_open_id text,
  p_union_id text,
  p_user_name text,
  p_destination_id text,
  p_destination_name text,
  p_direct boolean,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_taken uuid;
  v_connection cloud.lark_connections;
begin
  delete from cloud.lark_connects
   where state = p_state and cloud = p_cloud and created_at > now() - interval '10 minutes'
  returning owner_id into v_owner;
  if v_owner is null then
    return json_build_object('ok', false, 'reason', 'expired');
  end if;

  -- One Lark person is one AI4Kanban account. Connecting the same Lark user to a second
  -- account would leave a press with two accounts to be, and no way to pick.
  select owner_id into v_taken from cloud.lark_connections
   where cloud = p_cloud and tenant_key = p_tenant_key and open_id = p_open_id
     and owner_id <> v_owner;
  if v_taken is not null then
    return json_build_object('ok', false, 'reason', 'actor_taken');
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.lark_connections (
    owner_id, cloud, tenant_key, open_id, union_id, user_name,
    destination_id, destination_name, direct, state, last_error
  ) values (
    v_owner, p_cloud, p_tenant_key, p_open_id, coalesce(p_union_id, ''),
    coalesce(p_user_name, ''), coalesce(p_destination_id, ''),
    coalesce(p_destination_name, ''), coalesce(p_direct, true), 'active', null
  )
  on conflict (owner_id) do update
    set cloud = excluded.cloud,
        tenant_key = excluded.tenant_key,
        open_id = excluded.open_id,
        union_id = excluded.union_id,
        user_name = excluded.user_name,
        destination_id = excluded.destination_id,
        destination_name = excluded.destination_name,
        direct = excluded.direct,
        state = 'active',
        last_error = null,
        updated_at = now();

  select * into v_connection from cloud.lark_connections where owner_id = v_owner;
  return json_build_object('ok', true, 'connection', cloud.lark_json(v_connection));
end;
$$;
revoke all on function api.lark_finish_connect(text, text, text, text, text, text, text, text, boolean, integer) from public;
grant execute on function api.lark_finish_connect(text, text, text, text, text, text, text, text, boolean, integer) to service_role;

-- What the Configuration pane draws. Null when this account has connected nothing.
create or replace function api.read_lark_connection(p_subject uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.lark_connections;
begin
  select * into v_connection from cloud.lark_connections where owner_id = p_subject;
  if v_connection.owner_id is null then return null; end if;
  return cloud.lark_json(v_connection);
end;
$$;
revoke all on function api.read_lark_connection(uuid) from public;
grant execute on function api.read_lark_connection(uuid) to service_role;

-- Which cloud and tenant this account's reads are made against, and the person's own
-- `open_id` — which is also the direct message the destination picker always offers. Kept
-- apart from `read_lark_connection` because the pane needs none of it.
create or replace function api.lark_connection_for(p_subject uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.lark_connections;
begin
  select * into v_connection from cloud.lark_connections where owner_id = p_subject;
  if v_connection.owner_id is null then return null; end if;
  return json_build_object(
    'cloud', v_connection.cloud,
    'tenantKey', v_connection.tenant_key,
    'openId', v_connection.open_id
  );
end;
$$;
revoke all on function api.lark_connection_for(uuid) from public;
grant execute on function api.lark_connection_for(uuid) to service_role;

-- Where this account's messages go. Picking one again is what clears a refusal: the case
-- that reaches `revoked` is usually a chat the bot was removed from.
create or replace function api.set_lark_destination(
  p_subject uuid,
  p_destination_id text,
  p_destination_name text,
  p_direct boolean,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.lark_connections;
begin
  select * into v_connection from cloud.lark_connections where owner_id = p_subject;
  if v_connection.owner_id is null then return null; end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.lark_connections
     set destination_id = p_destination_id,
         destination_name = coalesce(p_destination_name, ''),
         direct = coalesce(p_direct, false),
         state = 'active',
         last_error = null,
         updated_at = now()
   where owner_id = p_subject
  returning * into v_connection;
  return cloud.lark_json(v_connection);
end;
$$;
revoke all on function api.set_lark_destination(uuid, text, text, boolean, integer) from public;
grant execute on function api.set_lark_destination(uuid, text, text, boolean, integer) to service_role;

-- Stop posting. Nothing is handed back to Lark: the tenant's token is the app's rather than
-- this account's, and an uninstall in Lark is what ends that. No board is touched, and a
-- Slack connection beside this one keeps posting.
create or replace function api.lark_disconnect(
  p_subject uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from cloud.lark_connections where owner_id = p_subject) then
    return json_build_object('disconnected', true);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  delete from cloud.lark_connections where owner_id = p_subject;
  return json_build_object('disconnected', true);
end;
$$;
revoke all on function api.lark_disconnect(uuid, integer) from public;
grant execute on function api.lark_disconnect(uuid, integer) to service_role;

-- Who a press in a chat is. The cloud, the tenant AND the user, because a Lark id means
-- nothing without both. Null is an actor we have no account for, which the Worker answers
-- with its own words rather than acting.
create or replace function api.lark_actor(
  p_cloud text,
  p_tenant_key text,
  p_open_id text
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection cloud.lark_connections;
begin
  select * into v_connection from cloud.lark_connections
   where cloud = p_cloud and tenant_key = p_tenant_key and open_id = p_open_id;
  if v_connection.owner_id is null then return null; end if;
  return json_build_object(
    'ownerId', v_connection.owner_id,
    'cloud', v_connection.cloud,
    'revoked', v_connection.state = 'revoked'
  );
end;
$$;
revoke all on function api.lark_actor(text, text, text) from public;
grant execute on function api.lark_actor(text, text, text) to service_role;

-- Lark refused us. Recorded where the connection was made, because a message failing into
-- silence reads to the user as no work waiting.
create or replace function api.lark_refused(
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
  update cloud.lark_connections
     set state = 'revoked', last_error = left(coalesce(p_error, ''), 300), updated_at = now()
   where owner_id = p_owner;
  return json_build_object('ok', true);
end;
$$;
revoke all on function api.lark_refused(uuid, text, integer) from public;
grant execute on function api.lark_refused(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The app's ticket, and the tenant's token
-- ---------------------------------------------------------------------------

-- The ticket the platform pushed. One per cloud, and the newest is the only one that mints.
create or replace function api.lark_app_ticket_pushed(
  p_cloud text,
  p_app_ticket text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.lark_apps (cloud, app_ticket) values (p_cloud, p_app_ticket)
  on conflict (cloud) do update
    set app_ticket = excluded.app_ticket, updated_at = now();
  -- A ticket that has just been pushed makes every held token mintable again, and the ones
  -- minted from the old ticket are the ones Lark stops answering.
  delete from cloud.lark_tenant_tokens where cloud = p_cloud;
  return json_build_object('ok', true);
end;
$$;
revoke all on function api.lark_app_ticket_pushed(text, text, integer) from public;
grant execute on function api.lark_app_ticket_pushed(text, text, integer) to service_role;

create or replace function api.lark_app_ticket(p_cloud text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket text;
begin
  select app_ticket into v_ticket from cloud.lark_apps where cloud = p_cloud;
  if v_ticket is null then return null; end if;
  return json_build_object('appTicket', v_ticket);
end;
$$;
revoke all on function api.lark_app_ticket(text) from public;
grant execute on function api.lark_app_ticket(text) to service_role;

-- The tenant's token, while it still has enough life left to make a call with. The skew is
-- the caller's, so a token that would expire mid-send is minted again rather than spent.
create or replace function api.lark_tenant_token(
  p_cloud text,
  p_tenant_key text,
  p_skew_seconds integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select token into v_token from cloud.lark_tenant_tokens
   where cloud = p_cloud and tenant_key = p_tenant_key
     and expires_at > now() + make_interval(secs => coalesce(p_skew_seconds, 0));
  if v_token is null then return null; end if;
  return json_build_object('token', v_token);
end;
$$;
revoke all on function api.lark_tenant_token(text, text, integer) from public;
grant execute on function api.lark_tenant_token(text, text, integer) to service_role;

create or replace function api.lark_tenant_token_minted(
  p_cloud text,
  p_tenant_key text,
  p_token text,
  p_expires_in integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.lark_tenant_tokens (cloud, tenant_key, token, expires_at)
  values (p_cloud, p_tenant_key, p_token, now() + make_interval(secs => p_expires_in))
  on conflict (cloud, tenant_key) do update
    set token = excluded.token, expires_at = excluded.expires_at, updated_at = now();
  return json_build_object('ok', true);
end;
$$;
revoke all on function api.lark_tenant_token_minted(text, text, text, integer, integer) from public;
grant execute on function api.lark_tenant_token_minted(text, text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- What a connector is owed
-- ---------------------------------------------------------------------------

-- Every event one named connector has a message to write or rewrite.
--
-- 0006's `api.slack_jobs` with the connector taken by name, and the connection's own half
-- answered as an opaque object the Worker's connector reads. The rest is unchanged, because
-- none of it was ever Slack's:
--
--   • one event keeps ONE message per connector however many attempts it takes — the delivery
--     row holds the id the chat answered with, and an event that has one is edited in place
--     rather than posted again;
--   • a delivery is due when the event has moved since the message was last written — against
--     `content_at`, the clock #182 gave the event, so a quiet refresh is followed too. That
--     comparison is the whole of the synchronisation, and it needs no flag anybody has to
--     remember to set. The version token goes back under BOTH names, carrying `content_at`
--     either way, for the same reason 0008 gave: a migration and a Worker deploy do not land
--     together, and a token echoed back as NULL leaves every message due forever;
--   • an event nobody has posted yet is due only while it is `actionable`: a task that stopped
--     needing a person before the chat ever heard about it is not news. Once a message exists
--     it follows the event to whatever it ends as.
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
           json_build_object('botToken', s.bot_token, 'channelId', s.channel_id) as posts
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

-- 0006's Slack-only query is replaced by the one above, and left where it is rather than
-- dropped. The schema goes first and a rollback returns the Worker but not the schema, so a
-- migration that took `api.slack_jobs` away would leave the Worker version before this one
-- unable to write a Slack message at all — through the whole migrate-then-deploy window, and
-- for good after a rollback. Nothing calls it once this deploy is live; taking it out belongs
-- to a later migration, once no Worker anybody would roll back to still asks for it.

-- ---------------------------------------------------------------------------
-- The sweep
-- ---------------------------------------------------------------------------
--
-- A delivery goes with the event it belongs to — `on delete cascade` — so #319's sweep is the
-- whole of the retention this card adds. A connection is the account's and is kept until the
-- account disconnects or is deleted; a tenant's token is replaced as it is renewed, and an
-- `app_ticket` is one row per cloud forever.
