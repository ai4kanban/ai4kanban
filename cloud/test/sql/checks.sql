-- What the schema does with a well-formed call (#329).
--
-- Every other check in cloud/test/ fakes PostgREST, so it can say what the Worker sends and
-- nothing about what the database does with it. These run against a database with the
-- migrations really applied: the account check every route ends at, the two RLS policies
-- that are the whole of a private Realtime topic's authorization, and the handful of rules
-- that are properties of the schema rather than of any caller — one live row per task, one
-- action per event, a lease that ran out, and a refusal that costs the day's budget nothing.
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

do $checks$
declare
  A constant uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  B constant uuid := 'bbbbbbbb-2222-4222-8222-222222222222';
  BOARD_A constant uuid := 'cccccccc-3333-4333-8333-333333333333';
  BOARD_B constant uuid := 'dddddddd-4444-4444-8444-444444444444';
  MACHINE_A constant uuid := 'eeeeeeee-5555-4555-8555-555555555555';
  MACHINE_A2 constant uuid := 'eeeeeeee-7777-4777-8777-777777777777';
  MACHINE_B constant uuid := 'ffffffff-6666-4666-8666-666666666666';
  BUDGET constant integer := 100000;
  v_event uuid;
  v_second uuid;
  v_server_a uuid;
  v_server_b uuid;
  v_request uuid;
  v_json json;
  v_text text;
  v_count integer;
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

  -- A card that moved refreshes the same row rather than raising another.
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', '0.8.0', 'r2',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f2', BUDGET);
  assert (v_json ->> 'id')::uuid = v_event, 'a revised card raised a second row';
  assert (v_json ->> 'revision') = 'r2', 'a revised card did not refresh the row';

  -- -------------------------------------------------------------------------
  -- One action per event, against the revision it was granted on
  -- -------------------------------------------------------------------------

  perform pg_temp.refuses(
    format('select api.record_event_action(%L, %L, %L, %L, %L, %L, %L, %s)',
           A, 'op-stale', v_event, 'implement', 'r1', '[]', 'waiting_for_server', BUDGET),
    'AKB03', 'an action against a revision that has moved');

  v_json := api.record_event_action(A, 'op-1', v_event, 'implement', 'r2', '[]'::jsonb,
                                    'waiting_for_server', BUDGET);
  assert (v_json ->> 'state') = 'waiting_for_server', 'the action did not leave the event waiting';
  assert (v_json ->> 'acted')::boolean, 'the action was not recorded against the event';

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

  v_json := api.record_event_outcome(A, 'out-1', v_event, 'completed', '', 900, BUDGET);
  assert (v_json ->> 'state') = 'completed', 'the outcome did not reach the event';
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

  raise notice 'sql checks: every check passed';
end
$checks$;

rollback;
