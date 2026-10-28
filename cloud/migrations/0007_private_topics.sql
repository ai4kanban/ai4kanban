-- The private Realtime topics, made joinable (#329).
--
-- 0005's policy on `realtime.messages` decides whether a socket may join `server:<id>` by
-- reading `cloud.board_servers`. A policy is evaluated with the privileges of the role
-- running the query, and that role is `authenticated` — which 0001 deliberately gives no
-- access to the `cloud` schema at all. So the policy does not answer false; it RAISES
-- `permission denied for table board_servers`.
--
-- One error there refuses the whole read, so it took the account topic down with it: a
-- desktop that opened either topic had its `phx_join` refused, and the bell it fills was
-- left empty until the connection was replaced by a catch-up read. Everything still worked,
-- just minutes later and with nothing arriving on its own — which is exactly the kind of
-- break a fake PostgREST cannot see.
--
-- The fix is to ask the policy a question it can answer on its own. The server's topic now
-- carries the account that owns it —
--
--   server:<owner>:<server id>
--
-- so `auth.uid()` alone decides it, the way the account topic has always been decided. The
-- server id is still what routes the hint; it is no longer what authorizes it. Nothing is
-- disclosed by the extra segment: a topic name is only ever known to the account whose
-- machine was told its own server id.
--
-- Forward only, and it leaves the Worker version before it working: the Worker never names
-- a topic. A client that predates this listens on `server:<id>`, which no policy admits and
-- no hint is sent to any more — the same catch-up read it already falls back on is what
-- carries its requests, exactly as it did while the topic was refusing everybody.

-- ---------------------------------------------------------------------------
-- The policy
-- ---------------------------------------------------------------------------

drop policy if exists "a server receives its own broadcasts" on realtime.messages;

create policy "a server receives its own broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.messages.extension) = 'broadcast'
    and realtime.topic() like 'server:' || (select auth.uid())::text || ':%'
  );

-- ---------------------------------------------------------------------------
-- The hint
-- ---------------------------------------------------------------------------

-- Say a request moved, to the server it belongs to, on that server's own topic. Called
-- inside the same transaction as the write it reports, and swallowing its own failure like
-- `cloud.hint`: the catch-up read on every start and reconnect is what makes the durable
-- write enough on its own.
create or replace function cloud.hint_server(p_owner uuid, p_server uuid, p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_server is null or p_owner is null then return; end if;
  perform realtime.send(
    json_build_object('requestId', p_request::text)::jsonb,
    'request',
    'server:' || p_owner::text || ':' || p_server::text,
    true
  );
exception when others then
  null;
end;
$$;
revoke all on function cloud.hint_server(uuid, uuid, uuid) from public;

-- 0005's raise, naming the account on the hint. Everything else about it is unchanged: one
-- action leaves one request or none, inside that action's own transaction.
create or replace function cloud.raise_request(
  p_owner uuid,
  p_board uuid,
  p_event uuid
) returns cloud.event_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server uuid;
  v_request cloud.event_requests;
begin
  select id into v_server from cloud.board_servers where board_id = p_board and enabled;
  insert into cloud.event_requests (owner_id, board_id, event_id, server_id)
  values (p_owner, p_board, p_event, v_server)
  on conflict (event_id) do nothing
  returning * into v_request;
  if v_request.id is null then
    select * into v_request from cloud.event_requests where event_id = p_event;
  end if;
  perform cloud.hint_server(p_owner, v_server, v_request.id);
  return v_request;
end;
$$;
revoke all on function cloud.raise_request(uuid, uuid, uuid) from public;

-- 0005's two-argument hint is replaced by the one above. Dropped rather than left beside it,
-- so nothing can call the version that sends to a topic no policy admits.
drop function if exists cloud.hint_server(uuid, uuid);
