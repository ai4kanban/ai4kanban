-- What the schema does with a well-formed call (#329).
--
-- Every other check in cloud/test/ fakes PostgREST, so it can say what the Worker sends and
-- nothing about what the database does with it. These run against a database with the
-- migrations really applied: the account check every route ends at, approving an invite
-- request (#350), the two RLS policies that are the whole of a private Realtime topic's
-- authorization, and the handful of rules that are properties of the schema rather than of
-- any caller — one live row per task, one action per event, a lease that ran out, and a
-- refusal that costs the day's budget nothing.
--
-- Run with `npm run test:sql`. Everything happens inside one transaction that is rolled
-- back, so a project it is pointed at keeps exactly the rows it had.

\set ON_ERROR_STOP on

begin;

/** Run something that must be refused with one particular SQLSTATE. */
create function pg_temp.refuses(p_sql text, p_code text, p_what text) returns void
language plpgsql as $fn$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_code then return; end if;
    raise exception '% — expected %, got % (%)', p_what, p_code, sqlstate, sqlerrm;
  end;
  raise exception '% — expected % and nothing was refused', p_what, p_code;
end;
$fn$;

/** What a socket signed in as this account sees on this topic. Raises when the policy
 *  itself cannot be evaluated, which is how a policy reaching a table the signed-in role
 *  may not read shows up. */
create function pg_temp.receives(p_account uuid, p_topic text) returns bigint
language plpgsql as $fn$
declare
  v_seen bigint;
begin
  perform set_config('request.jwt.claim.sub', p_account::text, true);
  perform set_config('realtime.topic', p_topic, true);
  set local role authenticated;
  select count(*) into v_seen from realtime.messages where topic = p_topic;
  reset role;
  return v_seen;
exception when others then
  reset role;
  raise;
end;
$fn$;

/** Run something that must be refused with AKB06, and hand back the revision the resource
 *  holds now — the DETAIL a conflict carries, which is what a client re-reads on. */
create function pg_temp.conflict_current(p_sql text, p_what text) returns text
language plpgsql as $fn$
declare
  v_current text;
begin
  execute p_sql;
  raise exception '% — expected a conflict and nothing was refused', p_what;
exception when sqlstate 'AKB06' then
  get stacked diagnostics v_current = pg_exception_detail;
  return v_current;
end;
$fn$;

do $checks$
declare
  A constant uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  B constant uuid := 'bbbbbbbb-2222-4222-8222-222222222222';
  BOARD_A constant uuid := 'cccccccc-3333-4333-8333-333333333333';
  BOARD_B constant uuid := 'dddddddd-4444-4444-8444-444444444444';
  MACHINE_A constant uuid := 'eeeeeeee-5555-4555-8555-555555555555';
  MACHINE_A2 constant uuid := 'eeeeeeee-7777-4777-8777-777777777777';
  MACHINE_B constant uuid := 'ffffffff-6666-4666-8666-666666666666';
  -- The three the approval checks use. They sign in, so unlike A and B they need an
  -- `auth.identities` row: admission is decided on what the provider attested, never on a
  -- `cloud.accounts` row we wrote ourselves.
  ASKER constant uuid := '11111111-8888-4888-8888-888888888888';
  RENAMER constant uuid := '22222222-9999-4999-8999-999999999999';
  SQUATTER constant uuid := '33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  BUDGET constant integer := 100000;
  v_event uuid;
  v_second uuid;
  v_retired uuid;
  v_server_a uuid;
  v_server_b uuid;
  v_request uuid;
  v_json json;
  v_text text;
  v_count integer;
  v_changed timestamptz;
  v_content timestamptz;
begin
  -- Two accounts, each with a board, a server and one actionable event.
  insert into cloud.accounts (id, handle) values (A, 'account-a'), (B, 'account-b');
  perform api.register_board(A, BOARD_A, 'a-board', BUDGET);
  perform api.register_board(B, BOARD_B, 'b-board', BUDGET);

  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', '0.8.0', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f1', BUDGET);
  v_event := (v_json ->> 'id')::uuid;
  v_json := api.attach_server(A, BOARD_A, MACHINE_A, 'a-machine', false, '[]'::jsonb, BUDGET);
  v_server_a := (v_json ->> 'id')::uuid;
  v_json := api.attach_server(B, BOARD_B, MACHINE_B, 'b-machine', false, '[]'::jsonb, BUDGET);
  v_server_b := (v_json ->> 'id')::uuid;

  -- -------------------------------------------------------------------------
  -- A second account reaches nothing of the first, over every route
  -- -------------------------------------------------------------------------

  perform pg_temp.refuses(
    format('select api.read_event(%L, %L)', B, v_event), 'AKB02', 'read_event');
  perform pg_temp.refuses(
    format('select api.retire_event(%L, %L, %s)', B, v_event, BUDGET), 'AKB02', 'retire_event');
  perform pg_temp.refuses(
    format('select api.record_event_action(%L, %L, %L, %L, %L, %L, %L, %s)',
           B, 'op-b', v_event, 'implement', 'r1', '[]', 'accepted', BUDGET),
    'AKB02', 'record_event_action');
  perform pg_temp.refuses(
    format('select api.record_event_outcome(%L, %L, %L, %L, %L, 900, %s)',
           B, 'op-b2', v_event, 'completed', '', BUDGET),
    'AKB02', 'record_event_outcome');
  perform pg_temp.refuses(
    format('select api.record_event_delivery(%L, %L, %L, %L, %L, %L, now(), %s)',
           B, v_event, 'slack', 'sent', 'ts', '', BUDGET),
    'AKB02', 'record_event_delivery');
  perform pg_temp.refuses(
    format('select api.register_board(%L, %L, %L, %s)', B, BOARD_A, 'stolen', BUDGET),
    'AKB02', 'register_board');
  perform pg_temp.refuses(
    format('select api.publish_event(%L, %L, 1, %L, %L, %L, %L, %L, %L, %L, %L, %L, %s)',
           B, BOARD_A, 't', '', 'r9', 'ready_for_review', 'implement', '[]', '', '', 'f9', BUDGET),
    'AKB02', 'publish_event');
  perform pg_temp.refuses(
    format('select api.attach_server(%L, %L, %L, %L, false, %L, %s)',
           B, BOARD_A, MACHINE_B, 'b-machine', '[]', BUDGET),
    'AKB02', 'attach_server');
  perform pg_temp.refuses(
    format('select api.detach_server(%L, %L, %L, %s)', B, BOARD_A, MACHINE_A, BUDGET),
    'AKB02', 'detach_server');
  perform pg_temp.refuses(
    format('select api.list_requests(%L, %L)', B, v_server_a), 'AKB02', 'list_requests');
  perform pg_temp.refuses(
    format('select api.claim_request(%L, %L, %L, 900, %s)', B, v_server_a, gen_random_uuid(), BUDGET),
    'AKB02', 'claim_request');
  perform pg_temp.refuses(
    format('select api.renew_claim(%L, %L, %L, 900, %s)', B, v_server_a, gen_random_uuid(), BUDGET),
    'AKB02', 'renew_claim');

  -- The two reads answer with the caller's own rows rather than refusing.
  assert json_array_length(api.list_events(B)) = 0, 'list_events showed another account’s event';
  assert json_array_length(api.list_events(A)) = 1, 'list_events lost the account’s own event';
  select count(*) into v_count
    from json_array_elements(api.list_servers(B)) s where (s ->> 'boardId')::uuid = BOARD_A;
  assert v_count = 0, 'list_servers showed another account’s server';
  assert api.read_slack_connection(B) is null, 'read_slack_connection answered for another account';
  assert api.read_lark_connection(B) is null, 'read_lark_connection answered for another account';

  -- -------------------------------------------------------------------------
  -- One Lark person is one AI4Kanban account (#351)
  -- -------------------------------------------------------------------------
  -- Connecting the same Lark user to a second account would leave a press with two accounts
  -- to be, and no way to pick. The check happens before the write, and the unique index is
  -- what holds if two connections ever race.

  perform api.lark_begin_connect(A, 'state-a', 'feishu', BUDGET);
  assert (api.lark_finish_connect('state-a', 'feishu', 'T1', 'ou_1', 'on_1', 'Wu',
                                  'ou_1', 'Direct message', true, BUDGET) ->> 'ok')::boolean,
    'lark_finish_connect refused the first connection';
  perform api.lark_begin_connect(B, 'state-b', 'feishu', BUDGET);
  assert api.lark_finish_connect('state-b', 'feishu', 'T1', 'ou_1', 'on_1', 'Wu',
                                 'ou_1', 'Direct message', true, BUDGET) ->> 'reason' = 'actor_taken',
    'one Lark person reached two AI4Kanban accounts';
  -- A nonce minted for one cloud cannot be spent on the other.
  perform api.lark_begin_connect(B, 'state-c', 'feishu', BUDGET);
  assert api.lark_finish_connect('state-c', 'lark', 'T2', 'ou_2', '', '',
                                 'ou_2', 'Direct message', true, BUDGET) ->> 'reason' = 'expired',
    'a nonce minted for 飞书 was spent on Lark';
  -- The press is matched on the cloud, the tenant and the user together.
  assert api.lark_actor('feishu', 'T1', 'ou_1') ->> 'ownerId' = A::text, 'lark_actor lost the account';
  assert api.lark_actor('lark', 'T1', 'ou_1') is null, 'lark_actor crossed the two clouds';

  -- Every connector is owed the same message by the same comparison (#351): the account's
  -- one actionable event, once, and nothing for a connector this account has not connected.
  assert json_array_length(api.connector_jobs('lark', null, 10, 5)) = 1,
    'connector_jobs lost the one message Lark is owed';
  assert json_array_length(api.connector_jobs('slack', null, 10, 5)) = 0,
    'connector_jobs answered Slack for a Lark connection';
  -- A message that got through is not owed again until the event moves past what it shows.
  perform api.record_event_delivery(A, v_event, 'lark', 'sent', 'om_1', '',
                                    (api.read_event(A, v_event) ->> 'changedAt')::timestamptz, BUDGET);
  assert json_array_length(api.connector_jobs('lark', null, 10, 5)) = 0,
    'connector_jobs owed a message the chat already shows';
  perform api.lark_disconnect(A, BUDGET);
  assert api.read_lark_connection(A) is null, 'lark_disconnect left the connection behind';
  assert json_array_length(api.connector_jobs('lark', null, 10, 5)) = 0,
    'connector_jobs kept posting after the connection ended';

  -- -------------------------------------------------------------------------
  -- The private Realtime topics
  -- -------------------------------------------------------------------------
  -- The policies on `realtime.messages` are the whole of a private topic's authorization,
  -- and they are evaluated as the signed-in role — so a policy reaching anything that role
  -- may not read refuses the join outright, and takes every other policy on the table with
  -- it. Both topics are read here as both accounts for exactly that reason.

  perform cloud.hint(A, v_event);
  perform realtime.send('{"requestId":"r"}'::jsonb, 'request',
                        'server:' || A::text || ':' || v_server_a::text, true);

  assert pg_temp.receives(A, 'account:' || A::text) > 0, 'an account cannot receive on its own topic';
  assert pg_temp.receives(B, 'account:' || A::text) = 0, 'an account received on another’s topic';
  assert pg_temp.receives(A, 'server:' || A::text || ':' || v_server_a::text) > 0,
    'a server cannot receive on its own topic';
  assert pg_temp.receives(B, 'server:' || A::text || ':' || v_server_a::text) = 0,
    'a server topic was joined by another account';
  -- The topic 0005 named carries no account, so no policy admits it and nothing is sent to
  -- it: a client that predates 0007 falls back to its catch-up read.
  assert pg_temp.receives(A, 'server:' || v_server_a::text) = 0,
    'the topic no policy admits was joined anyway';

  -- -------------------------------------------------------------------------
  -- One task, one live row
  -- -------------------------------------------------------------------------

  -- The same snapshot again writes nothing and raises nothing.
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', '0.8.0', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f1', BUDGET);
  assert (v_json ->> 'id')::uuid = v_event, 'an unchanged snapshot raised a second row';

  -- An edit the event cannot see — a `release:` reset, a typo in a section it never carries
  -- — moves the revision and nothing else (#182). Cloud takes it, because an action binds
  -- the revision, and says nothing: `changed_at` stays put so the row stays as read as it
  -- was, and `content_at` moves so Slack's message is rewritten to match.
  --
  -- Aged first: every check here runs in ONE transaction, so every `now()` in it answers the
  -- same instant and a clock that moved could not be told from one that did not.
  update cloud.events set changed_at = now() - interval '1 hour',
                          content_at = now() - interval '1 hour'
   where id = v_event;
  select changed_at, content_at into v_changed, v_content from cloud.events where id = v_event;
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', '', 'r2',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f1', BUDGET);
  assert (v_json ->> 'id')::uuid = v_event, 'a quiet refresh raised a second row';
  assert (v_json ->> 'revision') = 'r2', 'a quiet refresh did not write the revision through';
  assert (v_json ->> 'release') = '', 'a quiet refresh did not write the release through';
  assert (v_json ->> 'changedAt')::timestamptz = v_changed,
    'an edit the event cannot see marked the row unread again';
  assert (select content_at from cloud.events where id = v_event) > v_content,
    'a quiet refresh left the message showing what the card no longer says';

  -- What the person is asked to decide moving IS news: the same row, refreshed, and
  -- `changed_at` with it.
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', '', 'r2',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why moved', 'notes', 'f2', BUDGET);
  assert (v_json ->> 'id')::uuid = v_event, 'a revised card raised a second row';
  assert (v_json ->> 'changedAt')::timestamptz > v_changed, 'a card that moved did not refresh the row';

  -- The version token a connector's job carries, under both names. A migration and a Worker
  -- deploy do not land together, and the Worker echoes this value straight back as
  -- `rendered_at`: one that read a key the other did not send would record NULL, and a
  -- delivery with no `rendered_at` is due forever — every message in the chat rewritten on
  -- every pass.
  insert into cloud.slack_connections (owner_id, team_id, bot_token, channel_id, slack_user_id)
  values (A, 'T1', 'xoxb', 'C1', 'U1');
  v_json := (api.connector_jobs('slack', v_event, 10, 5) -> 0);
  assert v_json is not null, 'an actionable event owed a message was not due';
  assert (v_json ->> 'contentAt') = (v_json ->> 'changedAt'),
    'the two names for one version token disagree';
  assert (v_json ->> 'contentAt')::timestamptz
       = (select content_at from cloud.events where id = v_event),
    'a connector job carries a version its message could not be checked against';

  -- A card that stops needing a person is content moving too. A retirement that left
  -- `content_at` alone would owe the chat nothing, and the ask would sit there with an
  -- Implement on it that `record_event_action` then refuses.
  v_json := api.publish_event(A, BOARD_A, 330, 'A card nobody gets to', '', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', '', 'f1', BUDGET);
  v_retired := (v_json ->> 'id')::uuid;
  update cloud.events set content_at = now() - interval '1 hour' where id = v_retired;
  select content_at into v_content from cloud.events where id = v_retired;
  v_json := api.retire_event(A, v_retired, BUDGET);
  assert (v_json ->> 'state') = 'stale', 'a retirement did not leave the event stale';
  assert (select content_at from cloud.events where id = v_retired) > v_content,
    'a retired card left the chat offering a decision nobody can take';
  perform api.record_event_delivery(A, v_retired, 'slack', 'sent', 'ts-retired', '',
                                    v_content, BUDGET);
  assert (api.connector_jobs('slack', v_retired, 10, 5) -> 0) is not null,
    'a retired card owed a rewrite was not due';

  delete from cloud.slack_connections where owner_id = A;

  -- -------------------------------------------------------------------------
  -- One action per event, against the revision it was granted on
  -- -------------------------------------------------------------------------

  perform pg_temp.refuses(
    format('select api.record_event_action(%L, %L, %L, %L, %L, %L, %L, %s)',
           A, 'op-stale', v_event, 'implement', 'r1', '[]', 'waiting_for_server', BUDGET),
    'AKB03', 'an action against a revision that has moved');

  -- Aged, so the clock a message's rewrite is owed against can be seen to move: a decision
  -- is content moving as well as news, and a message left on "Ready for review" would offer
  -- a decision somebody already took.
  update cloud.events set changed_at = now() - interval '1 hour',
                          content_at = now() - interval '1 hour'
   where id = v_event;
  select content_at into v_content from cloud.events where id = v_event;

  v_json := api.record_event_action(A, 'op-1', v_event, 'implement', 'r2', '[]'::jsonb,
                                    'waiting_for_server', BUDGET);
  assert (v_json ->> 'state') = 'waiting_for_server', 'the action did not leave the event waiting';
  assert (v_json ->> 'acted')::boolean, 'the action was not recorded against the event';
  assert (select content_at from cloud.events where id = v_event) > v_content,
    'a decision left the message still offering one';

  -- The same attempt again is that attempt's retry, not a second action.
  v_json := api.record_event_action(A, 'op-1', v_event, 'implement', 'r2', '[]'::jsonb,
                                    'waiting_for_server', BUDGET);
  assert (v_json ->> 'id')::uuid = v_event, 'a retried attempt was not recognised';
  select count(*) into v_count from cloud.event_actions where event_id = v_event;
  assert v_count = 1, 'a retried attempt recorded a second action';

  perform pg_temp.refuses(
    format('select api.record_event_action(%L, %L, %L, %L, %L, %L, %L, %s)',
           A, 'op-2', v_event, 'implement', 'r2', '[]', 'waiting_for_server', BUDGET),
    'AKB04', 'a second action on one event');

  -- -------------------------------------------------------------------------
  -- The request that action left, and the lease that holds it
  -- -------------------------------------------------------------------------

  select id into v_request from cloud.event_requests where event_id = v_event;
  assert v_request is not null, 'an action taken elsewhere left no request';
  select count(*) into v_count from cloud.event_requests where event_id = v_event;
  assert v_count = 1, 'one action left more than one request';

  -- Another account's own server is still another account's.
  perform pg_temp.refuses(
    format('select api.claim_request(%L, %L, %L, 900, %s)', B, v_server_b, v_request, BUDGET),
    'AKB02', 'another account’s server claiming this request');

  v_json := api.claim_request(A, v_server_a, v_request, 900, BUDGET);
  assert (v_json ->> 'claimed')::boolean, 'the board’s own server could not claim its request';

  -- Claimed and alive: nobody starts it a second time, this machine included.
  v_json := api.claim_request(A, v_server_a, v_request, 900, BUDGET);
  assert not (v_json ->> 'claimed')::boolean, 'a live claim was handed out twice';
  assert (v_json ->> 'reason') like '%already running%', 'a live claim was refused for the wrong reason';

  -- The lease runs out, which is the whole of how a killed server is noticed. Nothing
  -- sweeps and nothing is stored: it is derived wherever it is read.
  update cloud.event_requests set lease_expires_at = now() - interval '1 minute' where id = v_request;
  assert (api.read_event(A, v_event) ->> 'state') = 'interrupted',
    'a lease that ran out does not read as interrupted';
  select r ->> 'state' into v_text from json_array_elements(api.list_requests(A, v_server_a)) r
   where (r ->> 'id')::uuid = v_request;
  assert v_text = 'interrupted', 'the request itself does not read as interrupted';

  -- The machine that claimed it may take it up again; nobody else may.
  v_json := api.attach_server(A, BOARD_A, MACHINE_A2, 'a-second-machine', true, '[]'::jsonb, BUDGET);
  v_json := api.claim_request(A, (v_json ->> 'id')::uuid, v_request, 900, BUDGET);
  assert not (v_json ->> 'claimed')::boolean, 'a second machine took up a request it did not claim';
  assert (v_json ->> 'reason') like '%another machine%', 'the refusal did not name the binding';

  -- -------------------------------------------------------------------------
  -- The outcome ends the request in the same transaction
  -- -------------------------------------------------------------------------

  -- Why it ended is the EVENT's, because that is the row every surface renders — and because
  -- a decision taken on the board's own machine raises no request for it to live on.
  update cloud.events set content_at = now() - interval '1 hour' where id = v_event;
  select content_at into v_content from cloud.events where id = v_event;
  v_json := api.record_event_outcome(A, 'out-refused', v_event, 'failed',
                                     'you have uncommitted changes in cli/src/lib/help.ts', 900, BUDGET);
  assert (v_json ->> 'reason') like '%uncommitted changes%', 'a refusal reached the event without its words';
  assert (select content_at from cloud.events where id = v_event) > v_content,
    'an outcome left the message showing a delivery that had ended';

  -- And an ending with nothing to explain says nothing: a retry must not still show why the
  -- attempt before it was refused.
  v_json := api.record_event_outcome(A, 'out-1', v_event, 'completed', '', 900, BUDGET);
  assert (v_json ->> 'state') = 'completed', 'the outcome did not reach the event';
  assert (v_json ->> 'reason') = '', 'a delivery that finished still showed the last refusal';
  select state into v_text from cloud.event_requests where id = v_request;
  assert v_text = 'finished', 'a finished delivery left its request open';

  -- A task that needs a person again is new work, and the finished row stays as history.
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', '0.8.0', 'r3',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f3', BUDGET);
  v_second := (v_json ->> 'id')::uuid;
  assert v_second <> v_event, 'a finished event was reused rather than kept as history';
  select count(*) into v_count from cloud.events where board_id = BOARD_A and task_id = 329;
  assert v_count = 2, 'the finished row did not stay behind the new one';

  -- -------------------------------------------------------------------------
  -- Approving an invite request is the whole of getting in (#350)
  -- -------------------------------------------------------------------------

  insert into auth.identities (user_id, provider, identity_data)
  values (ASKER, 'github', '{"user_name":"asker","email":"asker@example.com"}'::jsonb),
         (RENAMER, 'github', '{"user_name":"before","email":"renamer@example.com"}'::jsonb),
         (SQUATTER, 'github', '{"user_name":"nobody","email":"squatter@example.com"}'::jsonb);

  perform api.request_invite(ASKER, BUDGET);
  assert not (api.account_for_session(ASKER, BUDGET) ->> 'admitted')::boolean,
    'asking for an invite admitted the account by itself';

  -- The notice is queued while the request is open, and the approval is not yet.
  select count(*) into v_count
    from json_array_elements(api.pending_mail(50, 5)) m
   where m ->> 'email' = 'asker@example.com';
  assert v_count = 1, 'an open request queued something other than its one notice';
  select m ->> 'kind' into v_text from json_array_elements(api.pending_mail(50, 5)) m
   where m ->> 'email' = 'asker@example.com';
  assert v_text = 'request', 'the open request queued the wrong message';

  -- That notice goes out, and approving must not disturb it.
  select (m ->> 'ref')::uuid into v_request from json_array_elements(api.pending_mail(50, 5)) m
   where m ->> 'email' = 'asker@example.com';
  perform api.mark_mail_sent('request', v_request::text);

  v_json := cloud.approve_invite_request('ASKER');
  assert (v_json ->> 'handle') = 'asker', 'approving did not answer with the handle it admitted';
  assert (v_json ->> 'email') = 'asker@example.com', 'approving lost the attested address';
  assert (api.account_for_session(ASKER, BUDGET) ->> 'admitted')::boolean,
    'approving a request did not admit the requester';

  select count(*) into v_count from cloud.invite_requests r
   where r.subject = ASKER and r.closed_at is not null and r.approved_at is not null;
  assert v_count = 1, 'approving did not close the request it answered';

  -- The approval queues a message of its own, and the notice already sent stays sent.
  select m ->> 'kind' into v_text from json_array_elements(api.pending_mail(50, 5)) m
   where m ->> 'email' = 'asker@example.com';
  assert v_text = 'approval', 'the approval queued no message of its own';
  select count(*) into v_count
    from json_array_elements(api.pending_mail(50, 5)) m
   where m ->> 'email' = 'asker@example.com';
  assert v_count = 1, 'the approval queued the notice a second time';

  perform api.mark_mail_sent('approval', v_request::text);
  select count(*) into v_count
    from json_array_elements(api.pending_mail(50, 5)) m
   where m ->> 'email' = 'asker@example.com';
  assert v_count = 0, 'a message marked sent was picked up again';

  -- A request already answered is refused a second approval.
  perform pg_temp.refuses(
    'select cloud.approve_invite_request(''asker'')', 'P0001', 'approving an answered request');

  -- A rename cannot un-admit somebody we let in, and cannot hand the admission to whoever
  -- takes the old handle: the admission was written for the subject, not for the name.
  perform api.request_invite(RENAMER, BUDGET);
  perform cloud.approve_invite_request('before');
  update auth.identities set identity_data = '{"user_name":"after","email":"renamer@example.com"}'::jsonb
   where user_id = RENAMER;
  assert (api.account_for_session(RENAMER, BUDGET) ->> 'admitted')::boolean,
    'a GitHub rename un-admitted an account an approval let in';
  update auth.identities set identity_data = '{"user_name":"before","email":"squatter@example.com"}'::jsonb
   where user_id = SQUATTER;
  assert not (api.account_for_session(SQUATTER, BUDGET) ->> 'admitted')::boolean,
    'the handle an admission was asked under admitted somebody else';

  -- The list holds one row per handle, so approving the second person to hold one is
  -- refused rather than admitting nobody and mailing them that they are in.
  perform api.request_invite(SQUATTER, BUDGET);
  perform pg_temp.refuses(
    'select cloud.approve_invite_request(''before'')', 'P0001',
    'approving a handle another account is admitted under');
  assert not (api.account_for_session(SQUATTER, BUDGET) ->> 'admitted')::boolean,
    'a refused approval admitted the requester anyway';
  select count(*) into v_count from cloud.invite_requests r
   where r.subject = SQUATTER and r.closed_at is null and r.approved_at is null;
  assert v_count = 1, 'a refused approval closed the request or queued its message';

  -- `remove_account` reaches the admission by either name: the subject of the account row
  -- the handle names now, for somebody who renamed after we let them in...
  perform cloud.remove_account('after');
  assert not (api.account_for_session(RENAMER, BUDGET) ->> 'admitted')::boolean,
    'remove_account left a renamed account admitted';

  -- ...and the handle it was asked under, for somebody with no account row to find at all.
  delete from cloud.accounts where id = ASKER;
  perform cloud.remove_account('asker');
  assert not (api.account_for_session(ASKER, BUDGET) ->> 'admitted')::boolean,
    'remove_account left an approved account admitted';
  select count(*) into v_count from cloud.invite_requests where subject = ASKER;
  assert v_count = 0, 'remove_account left the request behind the admission';

  -- -------------------------------------------------------------------------
  -- The thread a card's messages go in (#352)
  -- -------------------------------------------------------------------------
  -- The root is the earliest message still RECORDED for the task, whichever event it belongs
  -- to, so a card that needs a person again replies under the message it already has instead
  -- of scrolling past the channel a second time. Nothing per-card is stored for it: this is
  -- the delivery rows read back, per connector.

  insert into cloud.slack_connections (owner_id, team_id, bot_token, channel_id, slack_user_id)
  values (A, 'T1', 'xoxb', 'C1', 'U1');
  perform api.record_event_delivery(A, v_event, 'slack', 'sent', 'ts-first', '',
                                    now() - interval '2 hours', BUDGET);
  perform api.record_event_delivery(A, v_second, 'slack', 'sent', 'ts-second', '',
                                    now() - interval '1 hour', BUDGET);
  -- Aged, because every now() in this transaction answers the same instant and the earliest
  -- message is the one the order is taken from.
  update cloud.event_deliveries set created_at = now() - interval '2 hours'
   where event_id = v_event;

  v_json := (api.connector_jobs('slack', v_second, 10, 5) -> 0);
  assert v_json is not null, 'a card''s second event was not owed a message';
  assert (v_json ->> 'threadRef') = 'ts-first',
    'a later event was not given the earliest message the card still has';
  assert (v_json ->> 'messageRef') = 'ts-second', 'an event lost the message it already had';
  -- A reply pings nobody, so one still asking for a decision has an account to name.
  assert (v_json -> 'posts' ->> 'actorId') = 'U1',
    'a reply has no account a press is accepted from';

  -- The card's first message is the top of that thread rather than in it, which is the root
  -- pointing at the event's own message.
  v_json := (api.connector_jobs('slack', v_event, 10, 5) -> 0);
  assert (v_json ->> 'threadRef') = (v_json ->> 'messageRef'),
    'the card''s first message was told to reply to itself';

  -- -------------------------------------------------------------------------
  -- The 话题 a card's Lark messages go in (#353)
  -- -------------------------------------------------------------------------
  -- Lark's reply endpoint takes no destination — a reply lands in whichever chat the message
  -- it answers is in — so the chat travels in the delivery's own reference and only a
  -- reference from the chat this connection posts to NOW can be a root. The account a reply
  -- names rides on the Lark half of `posts`, beside Slack's `actorId`.

  perform api.lark_begin_connect(A, 'state-topic', 'feishu', BUDGET);
  perform api.lark_finish_connect('state-topic', 'feishu', 'T1', 'ou_1', 'on_1', 'Wu',
                                  'oc_1', 'Team chat', false, BUDGET);
  perform api.record_event_delivery(A, v_second, 'lark', 'sent', 'oc_1:om-second', '',
                                    now() - interval '1 hour', BUDGET);
  -- Aged, because every now() in this transaction answers the same instant and the earliest
  -- message is the one the order is taken from.
  update cloud.event_deliveries set created_at = now() - interval '2 hours'
   where event_id = v_event and connector = 'lark';

  -- v_event still holds the bare `om_1` this file recorded before the chat was written beside
  -- it. It names no chat, so it is never replied under: the card's next message is the top of
  -- a fresh topic instead.
  v_json := (api.connector_jobs('lark', v_second, 10, 5) -> 0);
  assert v_json is not null, 'a card''s second Lark message was not owed';
  assert (v_json ->> 'threadRef') = (v_json ->> 'messageRef'),
    'a reference written before the chat was recorded was taken as a root';

  -- Once the earliest message names this chat, the later event replies inside it.
  update cloud.event_deliveries
     set external_ref = 'oc_1:om-first', created_at = now() - interval '2 hours'
   where event_id = v_event and connector = 'lark';
  v_json := (api.connector_jobs('lark', v_second, 10, 5) -> 0);
  assert (v_json ->> 'threadRef') = 'oc_1:om-first',
    'a later Lark event was not given the earliest message the card still has in this chat';
  -- A topic reply subscribes nobody, so one still asking for a decision has an account to name.
  assert (v_json -> 'posts' ->> 'openId') = 'ou_1',
    'a Lark reply has no account a press is accepted from';

  -- The destination moves. Both of the card's messages are in the chat the account has left,
  -- so it has none to reply to here and its next event opens a topic in the new chat.
  perform api.set_lark_destination(A, 'oc_2', 'Another chat', false, BUDGET);
  v_json := (api.connector_jobs('lark', v_second, 10, 5) -> 0);
  assert v_json ->> 'threadRef' is null,
    'a root left in the chat the connection moved away from was still offered as one';
  -- Slack records no chat and posts wherever `channelId` says, so its root is untouched.
  assert ((api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'threadRef') = 'ts-first',
    'scoping Lark''s root to a chat narrowed Slack''s';

  -- -------------------------------------------------------------------------
  -- The card's own message, and the log under it (#359)
  -- -------------------------------------------------------------------------
  -- The message belongs to the card rather than to one of its events, so it is stored per
  -- board, task and connector — and looked up under the same destination filter #353 gave
  -- the root, which is how #360 reads exactly this record for Lark.

  -- What the message is drawn from is the card's NEWEST event, whichever event's delivery is
  -- due. Aged first: every now() in this transaction answers the same instant, so without it
  -- the newest could not be told from the oldest.
  update cloud.events set content_at = now() - interval '1 hour' where id = v_event;
  v_json := (api.connector_jobs('slack', v_event, 10, 5) -> 0);
  assert v_json is not null, 'a card''s first event was not owed a redraw';
  assert (v_json -> 'card' ->> 'id')::uuid = v_second,
    'a job aimed at one event drew the card from that event rather than from the newest';
  assert v_json ->> 'cardRef' is null, 'a card with no message recorded was handed one';

  -- One record per card and connector, rewritten in place, and the account's own.
  perform api.record_card_message(A, BOARD_A, 329, 'slack', 'ts-card', BUDGET);
  perform api.record_card_message(A, BOARD_A, 329, 'slack', 'ts-card-2', BUDGET);
  select count(*) into v_count from cloud.card_messages
   where board_id = BOARD_A and task_id = 329 and connector = 'slack';
  assert v_count = 1, 'a card kept two messages for one connector';
  assert ((api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'cardRef') = 'ts-card-2',
    'the card''s message was not handed to the job that has to rewrite it';
  perform pg_temp.refuses(
    format('select api.record_card_message(%L, %L, 329, %L, %L, %s)', B, BOARD_A, 'slack', 'ts', BUDGET),
    'AKB02', 'record_card_message');

  -- Lark keeps a record of its own, scoped to the chat this connection posts to now — the
  -- account moved to `oc_2` above, so one left behind in `oc_1` is never offered.
  perform api.record_card_message(A, BOARD_A, 329, 'lark', 'oc_1:om-card', BUDGET);
  assert (api.connector_jobs('lark', v_second, 10, 5) -> 0) ->> 'cardRef' is null,
    'a card message left in the chat the connection moved away from was still offered';
  perform api.record_card_message(A, BOARD_A, 329, 'lark', 'oc_2:om-card', BUDGET);
  assert ((api.connector_jobs('lark', v_second, 10, 5) -> 0) ->> 'cardRef') = 'oc_2:om-card',
    'a card message in the chat this connection posts to was not offered';

  -- A card in flight when 0013 shipped adopts the earliest message it already has, so it
  -- keeps its thread rather than opening a second one beside it. This runs the migration's
  -- own one-time step against the rows above, so nothing here can drift from what it does.
  delete from cloud.card_messages where board_id = BOARD_A and task_id = 329;
  perform cloud.adopt_card_messages();
  assert (select external_ref from cloud.card_messages
           where board_id = BOARD_A and task_id = 329 and connector = 'slack') = 'ts-first',
    'a card in flight did not adopt the earliest Slack message it already had';
  assert (select external_ref from cloud.card_messages
           where board_id = BOARD_A and task_id = 329 and connector = 'lark') = 'oc_1:om-first',
    'a card in flight did not adopt the earliest Lark message it already had';

  -- -------------------------------------------------------------------------
  -- How a delivery ended (#359)
  -- -------------------------------------------------------------------------
  -- The top message shows where the card stands now, so it stops saying a delivery was
  -- refused the moment the card is raised again. The reason gets a reply of its own, and the
  -- reference to it is what keeps a pass an hour later from posting a second.

  assert (api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'endingRef' is null,
    'a delivery with no ending logged was not offered one to log';
  perform api.record_delivery_ending(A, v_second, 'slack', 'ts-ended', BUDGET);
  assert ((api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'endingRef') = 'ts-ended',
    'an ending already logged was not handed back to the job that must not log it again';

  -- Written once: a row that already names an ending keeps the one it has.
  perform api.record_delivery_ending(A, v_second, 'slack', 'ts-ended-2', BUDGET);
  assert ((api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'endingRef') = 'ts-ended',
    'an ending was rewritten by a later pass';

  -- Each connector keeps its own, on that connector's own delivery row.
  assert (api.connector_jobs('lark', v_second, 10, 5) -> 0) ->> 'endingRef' is null,
    'one connector''s ending was offered to another';

  perform pg_temp.refuses(
    format('select api.record_delivery_ending(%L, %L, %L, %L, %s)', B, v_second, 'slack', 'ts', BUDGET),
    'AKB02', 'record_delivery_ending');

  -- -------------------------------------------------------------------------
  -- The day's write budget
  -- -------------------------------------------------------------------------
  -- A refused write rolls its own increment back, so writes stop at exactly the budget and
  -- a refusal costs nothing.

  delete from cloud.daily_writes;
  perform cloud.count_write(2);
  perform cloud.count_write(2);
  perform pg_temp.refuses('select cloud.count_write(2)', 'AKB01', 'a write past the day’s budget');
  select writes into v_count from cloud.daily_writes where day = (now() at time zone 'utc')::date;
  assert v_count = 2, format('a refused write was counted anyway (%s)', v_count);

  -- -------------------------------------------------------------------------
  -- The sweep
  -- -------------------------------------------------------------------------
  -- Thirty days after an event ends it goes, and its action, outcome, delivery and request
  -- go with it. Live work is kept however old it is.

  update cloud.events set finished_at = now() - interval '31 days' where id = v_event;
  perform api.sweep_events();
  select count(*) into v_count from cloud.events where id = v_event;
  assert v_count = 0, 'the sweep kept an event past its retention';
  select count(*) into v_count from cloud.event_actions where event_id = v_event;
  assert v_count = 0, 'the sweep left an action behind its event';
  select count(*) into v_count from cloud.event_requests where event_id = v_event;
  assert v_count = 0, 'the sweep left a request behind its event';
  select count(*) into v_count from cloud.events where id = v_second;
  assert v_count = 1, 'the sweep took live work with it';

  -- The sweep took the card's first message with the event it belonged to, so the card keeps
  -- replying under whichever message it has left — here, its own.
  v_json := (api.connector_jobs('slack', v_second, 10, 5) -> 0);
  assert (v_json ->> 'threadRef') = 'ts-second',
    'a card whose earliest message was swept did not fall back to the one it has left';

  -- And with none left there is nothing to reply to: the next message opens a thread.
  delete from cloud.event_deliveries where event_id = v_second;
  v_json := (api.connector_jobs('slack', v_second, 10, 5) -> 0);
  assert v_json is not null, 'an event with no message at all was not owed one';
  assert v_json ->> 'threadRef' is null,
    'a card with no recorded message left was still told to reply to one';

  -- The card's message is nobody's foreign key, so the sweep is what takes it — and only
  -- once the card has no event left. A card that comes back after that opens a fresh
  -- message, exactly as one whose thread was swept does (#359).
  select count(*) into v_count from cloud.card_messages where board_id = BOARD_A and task_id = 329;
  assert v_count = 2, 'the sweep took a card''s message while the card still had an event';
  update cloud.events set finished_at = now() - interval '31 days' where id = v_second;
  perform api.sweep_events();
  select count(*) into v_count from cloud.card_messages where board_id = BOARD_A and task_id = 329;
  assert v_count = 0, 'the sweep left a card''s message behind its last event';

  raise notice 'sql checks: every check passed';
end
$checks$;

-- ---------------------------------------------------------------------------
-- The control plane a workspace runs on (#314)
-- ---------------------------------------------------------------------------
--
-- A block of its own: what a workspace does with two writers, a retried attempt and its own
-- deletion is not a variation on the event flow above, and reading them together helps
-- nobody. The accounts are the two the block above already made.

do $workspaces$
declare
  A constant uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  B constant uuid := 'bbbbbbbb-2222-4222-8222-222222222222';
  MACHINE constant uuid := '99999999-1111-4111-8111-aaaaaaaaaaaa';
  MACHINE_2 constant uuid := '99999999-2222-4222-8222-bbbbbbbbbbbb';
  BUDGET constant integer := 100000;
  v_ws uuid;
  v_other uuid;
  v_node uuid;
  v_delivery uuid;
  v_json json;
  v_text text;
  v_count integer;
  v_revision text;
  v_card_revision text;
begin
  -- -------------------------------------------------------------------------
  -- A workspace belongs to the account that created it
  -- -------------------------------------------------------------------------
  -- Any admitted account may make one, and there is no cap: two in a row for one account,
  -- and B's is B's.

  v_json := api.create_workspace(A, 'op-create-1', 'A board', BUDGET);
  v_ws := (v_json ->> 'id')::uuid;
  assert (v_json ->> 'ownerId')::uuid = A, 'a workspace was not owned by the account that made it';
  assert (v_json ->> 'revision') = '1', 'a new workspace did not start at its first revision';
  assert (v_json ->> 'nextCardId')::integer = 1, 'a new workspace did not start numbering at 1';
  assert json_array_length(api.list_workspaces(A)) = 1, 'the account could not see its own workspace';

  v_json := api.create_workspace(B, 'op-create-b', 'B board', BUDGET);
  v_other := (v_json ->> 'id')::uuid;
  assert json_array_length(api.list_workspaces(A)) = 1, 'one account saw another''s workspace';

  -- The one mutation the ledger cannot cover deduplicates on the workspace row itself, so a
  -- create whose reply was lost finds the same workspace rather than leaving a second.
  assert (api.create_workspace(A, 'op-create-1', 'A board', BUDGET) ->> 'id')::uuid = v_ws,
    'a retried create made a second workspace';
  assert (select count(*) from cloud.workspaces where owner_id = A) = 1,
    'a retried create left a second workspace behind';

  -- Every endpoint answers the owner and nobody else. One check does it —
  -- `cloud.workspace_for` — which is the one place #376 changes.
  perform pg_temp.refuses(format('select api.read_workspace(%L, %L)', B, v_ws), 'AKB02', 'read_workspace');
  perform pg_temp.refuses(format('select api.read_cards(%L, %L)', B, v_ws), 'AKB02', 'read_cards');
  perform pg_temp.refuses(format('select api.read_audit(%L, %L, 10)', B, v_ws), 'AKB02', 'read_audit');
  perform pg_temp.refuses(format('select api.list_nodes(%L, %L)', B, v_ws), 'AKB02', 'list_nodes');
  perform pg_temp.refuses(
    format('select api.rename_workspace(%L, %L, %L, null, %L, %L, %s)', B, v_ws, 'op-b', '1', 'stolen', BUDGET),
    'AKB02', 'rename_workspace');
  perform pg_temp.refuses(
    format('select api.write_cards(%L, %L, %L, null, %L, %s)', B, v_ws, 'op-b2', '[{"expect":""}]', BUDGET),
    'AKB02', 'write_cards');
  perform pg_temp.refuses(
    format('select api.register_node(%L, %L, %L, %L, %L, %s)', B, v_ws, MACHINE, 'm', '[]', BUDGET),
    'AKB02', 'register_node');
  perform pg_temp.refuses(
    format('select api.open_delivery(%L, %L, %L, null, 1, %s)', B, v_ws, 'op-b3', BUDGET),
    'AKB02', 'open_delivery');
  perform pg_temp.refuses(format('select api.delete_workspace(%L, %L)', B, v_ws), 'AKB02', 'delete_workspace');

  -- -------------------------------------------------------------------------
  -- The ids the control plane allocates
  -- -------------------------------------------------------------------------
  -- Card ids stay the board's own small integers: a write naming none is given the next
  -- number free, and one naming 42 keeps 42 and moves the counter past it.

  v_json := api.write_cards(A, v_ws, 'op-w1', null,
                            '[{"expect":"","data":{"title":"first"}},{"expect":"","data":{"title":"second"}}]'::jsonb,
                            BUDGET);
  assert ((v_json -> 'cards' -> 0) ->> 'id')::integer = 1, 'the first card was not numbered 1';
  assert ((v_json -> 'cards' -> 1) ->> 'id')::integer = 2, 'the second card was not numbered 2';
  assert (v_json ->> 'revision') = '2', 'a write did not advance the workspace''s revision';

  v_json := api.write_cards(A, v_ws, 'op-w2', null,
                            '[{"id":42,"expect":"","data":{"title":"imported"}}]'::jsonb, BUDGET);
  assert ((v_json -> 'cards' -> 0) ->> 'id')::integer = 42, 'an imported card lost its own number';
  v_json := api.write_cards(A, v_ws, 'op-w3', null, '[{"expect":"","data":{}}]'::jsonb, BUDGET);
  assert ((v_json -> 'cards' -> 0) ->> 'id')::integer = 43,
    'the next card was numbered over one an import had already taken';

  -- -------------------------------------------------------------------------
  -- Revisions, the ledger, and the trail
  -- -------------------------------------------------------------------------

  select (c ->> 'revision') into v_card_revision
  from json_array_elements(api.read_cards(A, v_ws) -> 'cards') c
  where (c ->> 'id')::integer = 1;
  assert v_card_revision = '1', 'a card did not start at its first revision';

  v_json := api.write_cards(A, v_ws, 'op-w4', null,
                            format('[{"id":1,"expect":"%s","data":{"title":"again"}}]', v_card_revision)::jsonb,
                            BUDGET);
  assert ((v_json -> 'cards' -> 0) ->> 'revision') = '2', 'a card''s revision did not advance';

  -- An audit event per change, attributed, and appended inside the same transaction.
  select count(*) into v_count from cloud.workspace_audit
   where workspace_id = v_ws and action = 'card.written';
  assert v_count = 5, format('the trail did not record every card written (%s)', v_count);
  assert (select actor_handle from cloud.workspace_audit
           where workspace_id = v_ws and action = 'workspace.created') = 'account-a',
    'the trail did not say who made the workspace';

  -- -------------------------------------------------------------------------
  -- A retried attempt answers once
  -- -------------------------------------------------------------------------

  v_json := api.write_cards(A, v_ws, 'op-w4', null,
                            format('[{"id":1,"expect":"%s","data":{"title":"again"}}]', v_card_revision)::jsonb,
                            BUDGET);
  assert ((v_json -> 'cards' -> 0) ->> 'revision') = '2',
    'a retried attempt was not answered with the first result';
  select count(*) into v_count from cloud.workspace_audit
   where workspace_id = v_ws and action = 'card.written';
  assert v_count = 5, 'a retried attempt did the work a second time';

  -- The same id carrying different words is refused rather than answered with somebody
  -- else's outcome.
  perform pg_temp.refuses(
    format('select api.write_cards(%L, %L, %L, null, %L, %s)', A, v_ws, 'op-w4',
           '[{"id":1,"expect":"2","data":{"title":"different"}}]', BUDGET),
    'AKB07', 'an operation id reused for a different change');

  -- -------------------------------------------------------------------------
  -- A conflict is its own refusal, and carries the revision held now
  -- -------------------------------------------------------------------------

  v_text := pg_temp.conflict_current(
    format('select api.write_cards(%L, %L, %L, null, %L, %s)', A, v_ws, 'op-stale',
           '[{"id":1,"expect":"1","data":{"title":"stale"}}]', BUDGET),
    'a write against a revision that had moved');
  assert v_text = '2', format('a conflict did not carry the revision held now (%s)', v_text);

  -- A create that finds the card already there is the same conflict, and says so with the
  -- revision rather than a sentence.
  v_text := pg_temp.conflict_current(
    format('select api.write_cards(%L, %L, %L, null, %L, %s)', A, v_ws, 'op-stale-2',
           '[{"id":1,"expect":"","data":{}}]', BUDGET),
    'a create over a card that already exists');
  assert v_text = '2', 'a create over an existing card did not carry its revision';

  -- Nothing was written, and nothing was recorded: a conflict is not an attempt to answer
  -- again with, so retrying it re-computes the same refusal.
  assert (select count(*) from cloud.workspace_operations
           where workspace_id = v_ws and op_id like 'op-stale%') = 0,
    'a conflict left a row in the operation ledger';

  -- The board itself is a resource with a revision of its own, and a rename against one
  -- that has moved is the same refusal carrying the same kind of answer.
  v_revision := api.read_workspace(A, v_ws) ->> 'revision';
  assert (api.rename_workspace(A, v_ws, 'op-name', null, v_revision, 'The board', BUDGET) ->> 'name')
         = 'The board',
    'a rename against the revision the board held did not land';
  v_text := pg_temp.conflict_current(
    format('select api.rename_workspace(%L, %L, %L, null, %L, %L, %s)', A, v_ws, 'op-name-2',
           v_revision, 'Again', BUDGET),
    'a rename against a revision that had moved');
  assert v_text = (api.read_workspace(A, v_ws) ->> 'revision'),
    'a board-level conflict did not carry the revision the board holds now';

  -- -------------------------------------------------------------------------
  -- A multi-card operation commits whole or changes nothing
  -- -------------------------------------------------------------------------

  perform pg_temp.refuses(
    format('select api.write_cards(%L, %L, %L, null, %L, %s)', A, v_ws, 'op-batch',
           '[{"id":2,"expect":"1","data":{"title":"ok"}},{"id":1,"expect":"1","data":{"title":"stale"}}]',
           BUDGET),
    'AKB06', 'a batch whose last card had moved');
  assert (select data ->> 'title' from cloud.workspace_cards
           where workspace_id = v_ws and card_id = 2) = 'second',
    'a batch that could not commit whole changed a card anyway';

  -- -------------------------------------------------------------------------
  -- Execution nodes come under the workspace
  -- -------------------------------------------------------------------------

  v_json := api.register_node(A, v_ws, MACHINE, 'studio', '[{"name":"fast","harness":"claude-code"}]'::jsonb, BUDGET);
  v_node := (v_json ->> 'id')::uuid;
  assert (v_json ->> 'name') = 'studio', 'a node did not take the machine''s name to start with';
  assert json_array_length(v_json -> 'runtimes') = 1, 'a node lost what it runs the board''s runtimes as';
  assert json_array_length(api.list_nodes(A, v_ws)) = 1, 'the workspace did not list its node';

  -- Registering again from the same machine is the same node, and free when nothing moved.
  assert (api.register_node(A, v_ws, MACHINE, 'studio', '[{"name":"fast","harness":"claude-code"}]'::jsonb, BUDGET)
          ->> 'id')::uuid = v_node,
    'a machine opening the workspace again became a second node';

  -- A workspace has as many nodes as the owner registers machines — unlike a board, which
  -- attaches exactly one server (#318).
  perform api.register_node(A, v_ws, MACHINE_2, 'laptop', '[]'::jsonb, BUDGET);
  assert json_array_length(api.list_nodes(A, v_ws)) = 2, 'a workspace refused a second machine';

  -- Naming it is the owner's, and registering again never takes that name back.
  perform api.rename_node(A, v_ws, 'op-rename', v_node, 'The studio', BUDGET);
  assert (api.register_node(A, v_ws, MACHINE, 'studio', '[]'::jsonb, BUDGET) ->> 'name') = 'The studio',
    'registering again took back the name the owner gave a node';

  -- Registering again with something about the machine changed is a change like any other:
  -- the revision advances and the trail records it. Registering again with nothing changed
  -- is free, and moves neither.
  v_revision := api.read_workspace(A, v_ws) ->> 'revision';
  select count(*) into v_count from cloud.workspace_audit
   where workspace_id = v_ws and action = 'node.registered';
  perform api.register_node(A, v_ws, MACHINE, 'studio-2', '[]'::jsonb, BUDGET);
  assert (api.read_workspace(A, v_ws) ->> 'revision') <> v_revision,
    'a machine re-describing itself did not advance the workspace''s revision';
  assert (select count(*) from cloud.workspace_audit
           where workspace_id = v_ws and action = 'node.registered') = v_count + 1,
    'a machine re-describing itself left no line of trail';

  v_revision := api.read_workspace(A, v_ws) ->> 'revision';
  perform api.register_node(A, v_ws, MACHINE, 'studio-2', '[]'::jsonb, BUDGET);
  assert (api.read_workspace(A, v_ws) ->> 'revision') = v_revision,
    'registering again with nothing changed moved the board anyway';

  -- A node saying it is still there, and what a workspace read makes of that.
  assert (api.renew_node(A, v_ws, v_node, 900, BUDGET) ->> 'live')::boolean,
    'a node that had just renewed did not read as live';

  -- A delivery attempt gets its id from here, and the machine that ran it confirms it.
  v_json := api.open_delivery(A, v_ws, 'op-deliver', v_node, 1, BUDGET);
  v_delivery := (v_json ->> 'id')::uuid;
  assert (v_json ->> 'state') = 'open', 'a delivery attempt did not start open';
  assert (v_json ->> 'nodeId')::uuid = v_node, 'a delivery attempt was not attributed to its node';
  assert (api.confirm_delivery(A, v_ws, 'op-confirm', v_node, v_delivery, 'completed', '{}'::jsonb, BUDGET)
          ->> 'state') = 'completed',
    'a delivery attempt did not take the outcome its node reported';

  -- What the attempt says happened is part of the attempt: one id carrying a different
  -- account of the same delivery is refused rather than answered with the first one's.
  perform pg_temp.refuses(
    format('select api.confirm_delivery(%L, %L, %L, %L, %L, %L, %L, %s)', A, v_ws, 'op-confirm',
           v_node, v_delivery, 'completed', '{"summary":"something else"}', BUDGET),
    'AKB07', 'one operation id carrying two accounts of a delivery');

  -- Removed: its next renewal, its next write and its next delivery confirmation all meet
  -- the one refusal `cloud.require_node` raises.
  perform api.remove_node(A, v_ws, 'op-remove', v_node, BUDGET);
  assert json_array_length(api.list_nodes(A, v_ws)) = 1, 'a removed node was still listed';
  perform pg_temp.refuses(
    format('select api.renew_node(%L, %L, %L, 900, %s)', A, v_ws, v_node, BUDGET),
    'AKB08', 'a removed node renewing');
  perform pg_temp.refuses(
    format('select api.write_cards(%L, %L, %L, %L, %L, %s)', A, v_ws, 'op-gone', v_node,
           '[{"expect":"","data":{}}]', BUDGET),
    'AKB08', 'a removed node writing');
  v_json := api.open_delivery(A, v_ws, 'op-deliver-2', null, 1, BUDGET);
  perform pg_temp.refuses(
    format('select api.confirm_delivery(%L, %L, %L, %L, %L, %L, %L, %s)', A, v_ws, 'op-confirm-2',
           v_node, (v_json ->> 'id')::uuid, 'completed', '{}', BUDGET),
    'AKB08', 'a removed node confirming a delivery');

  -- The removal sticks to the NODE, not to the machine: opening the workspace from the same
  -- computer registers a new one, and the id the owner took off stays refused for good.
  v_json := api.register_node(A, v_ws, MACHINE, 'studio', '[]'::jsonb, BUDGET);
  assert (v_json ->> 'id')::uuid <> v_node, 'a removed node was revived by the machine registering again';
  assert (v_json ->> 'name') = 'studio', 'a node registered afresh did not take the machine''s own name';
  perform pg_temp.refuses(
    format('select api.renew_node(%L, %L, %L, 900, %s)', A, v_ws, v_node, BUDGET),
    'AKB08', 'a removed node renewing after the machine registered afresh');

  -- And a node of another workspace is refused by the same check, so a machine cannot carry
  -- one workspace's registration into another.
  perform pg_temp.refuses(
    format('select api.renew_node(%L, %L, %L, 900, %s)', B, v_other,
           (api.list_nodes(A, v_ws) -> 0 ->> 'id')::uuid, BUDGET),
    'AKB08', 'a node borrowed from another workspace');

  -- A change made from a machine is attributed to it, not only to the account.
  v_json := api.list_nodes(A, v_ws);
  perform api.write_cards(A, v_ws, 'op-from-node', (v_json -> 0 ->> 'id')::uuid,
                          '[{"expect":"","data":{}}]'::jsonb, BUDGET);
  assert (select node_id from cloud.workspace_audit
           where workspace_id = v_ws order by id desc limit 1)
         = (v_json -> 0 ->> 'id')::uuid,
    'a change made from a machine was not attributed to it';

  -- And the trail reads back, newest first.
  v_json := api.read_audit(A, v_ws, 5);
  assert json_array_length(v_json) = 5, 'the trail did not answer with the run of events asked for';
  assert (v_json -> 0 ->> 'handle') = 'account-a', 'the trail did not say who made a change';

  -- -------------------------------------------------------------------------
  -- The trail is immutable
  -- -------------------------------------------------------------------------

  perform pg_temp.refuses(
    format('update cloud.workspace_audit set action = %L where workspace_id = %L', 'nothing', v_ws),
    'AKB09', 'rewriting an audit event');
  perform pg_temp.refuses(
    format('delete from cloud.workspace_audit where workspace_id = %L', v_ws),
    'AKB09', 'dropping an audit event on its own');

  -- -------------------------------------------------------------------------
  -- The operation ledger stays bounded, and the trail is not swept
  -- -------------------------------------------------------------------------

  select count(*) into v_count from cloud.workspace_audit where workspace_id = v_ws;
  update cloud.workspace_operations set at = now() - interval '8 days' where workspace_id = v_ws;
  perform api.prune_operations();
  assert (select count(*) from cloud.workspace_operations where workspace_id = v_ws) = 0,
    'the prune kept operation records past their retention';
  assert (select count(*) from cloud.workspace_audit where workspace_id = v_ws) = v_count,
    'the prune took audit events with it';

  -- -------------------------------------------------------------------------
  -- Deleting a workspace takes everything in it, inside the call
  -- -------------------------------------------------------------------------

  perform api.write_cards(A, v_ws, 'op-last', null, '[{"expect":"","data":{}}]'::jsonb, BUDGET);
  assert (api.delete_workspace(A, v_ws) ->> 'deleted')::boolean, 'the delete did not report itself done';

  assert (select count(*) from cloud.workspaces where id = v_ws) = 0, 'the workspace outlived its delete';
  assert (select count(*) from cloud.workspace_cards where workspace_id = v_ws) = 0, 'a card outlived its workspace';
  assert (select count(*) from cloud.board_servers where workspace_id = v_ws) = 0, 'a node outlived its workspace';
  assert (select count(*) from cloud.workspace_deliveries where workspace_id = v_ws) = 0,
    'a delivery attempt outlived its workspace';
  assert (select count(*) from cloud.workspace_operations where workspace_id = v_ws) = 0,
    'the operation ledger outlived its workspace';
  assert (select count(*) from cloud.workspace_audit where workspace_id = v_ws) = 0,
    'the trail outlived its workspace — the one operation that may remove one';

  -- A deleted workspace answers like one the caller never had, on every path: nobody has to
  -- tell "gone" from "not yours", and nothing leaks whether it ever existed.
  perform pg_temp.refuses(
    format('select api.write_cards(%L, %L, %L, null, %L, %s)', A, v_ws, 'op-after',
           '[{"expect":"","data":{}}]', BUDGET),
    'AKB02', 'a write naming a deleted workspace');
  perform pg_temp.refuses(
    format('select api.renew_node(%L, %L, %L, 900, %s)', A, v_ws, v_node, BUDGET),
    'AKB02', 'a renewal naming a deleted workspace');
  perform pg_temp.refuses(
    format('select api.confirm_delivery(%L, %L, %L, null, %L, %L, %L, %s)', A, v_ws, 'op-after-2',
           v_delivery, 'completed', '{}', BUDGET),
    'AKB02', 'a delivery confirmation naming a deleted workspace');
  perform pg_temp.refuses(
    format('select api.delete_workspace(%L, %L)', A, v_ws), 'AKB02', 'the delete retried');
  perform pg_temp.refuses(
    format('select api.read_workspace(%L, %L)', A, v_ws), 'AKB02', 'a read naming a deleted workspace');

  -- What a deletion does not take: the owner's account and its admission, which are service
  -- data rather than workspace content. Nor anybody else's workspace.
  assert (select count(*) from cloud.accounts where id = A) = 1, 'the delete took the owner''s account';
  assert (select count(*) from cloud.workspaces where id = v_other) = 1,
    'the delete reached another account''s workspace';

  raise notice 'sql checks: #314 workspace checks passed';
end
$workspaces$;

rollback;
