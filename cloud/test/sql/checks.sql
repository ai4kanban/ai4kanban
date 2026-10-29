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

-- A made-up official workflow the checks start tasks on, installed in every workspace they make (#2030).
insert into cloud.workflow_listings (workflow_id) values ('wf_builtin_x');

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

/** A card that makes that many approvals (#2154), for checks about reviews that are not about
 *  how a card comes by them. */
create function pg_temp.stages(p_task text, p_stages integer) returns void
language sql as $fn$
  update cloud.tasks set card_metadata = card_metadata || jsonb_build_object('stages', p_stages) where id = p_task;
$fn$;

/** A task's review moved by hand, for checks about what follows a review, not how it moves. */
create function pg_temp.review(p_task text, p_status text, p_phase integer default 1) returns void
language sql as $fn$
  update cloud.tasks set review_status = p_status, review_phase = p_phase, review_at = now() where id = p_task;
$fn$;

/** The board files the Worker keeps in each project's `Board` (#2081), for checks that write a card. */
create temp table board_files (project text, path text, content text, primary key (project, path));

/** A card written as the Worker writes one: the file on its read version, then the index. */
create function pg_temp.save_card(p_account uuid, p_task text, p_fields jsonb, p_base integer, p_budget integer)
returns jsonb language plpgsql as $fn$
declare
  v_place jsonb := api.v1_card_place(p_account, p_task, p_fields -> 'assets', p_budget);
  v_seq integer;
begin
  v_seq := (select coalesce(max(card_version), 0) + 1 from cloud.tasks where project_id = v_place ->> 'project');
  if coalesce((v_place ->> 'version')::integer, 0) <> p_base then
    raise exception 'The card moved on.' using errcode = 'AKB27';
  end if;
  insert into board_files values (v_place ->> 'project', v_place ->> 'path', p_fields ->> 'body')
  on conflict (project, path) do update set content = excluded.content;
  perform api.v1_index_cards(p_account, v_place ->> 'project', jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object('task', p_task, 'path', v_place ->> 'path', 'seq', v_seq,
      'metadata', coalesce(p_fields -> 'metadata', '{}'), 'assets', p_fields -> 'assets'))), p_budget);
  return pg_temp.card(p_account, p_task);
end;
$fn$;

/** A card as `GET /v1/tasks/{id}/card` answers: the index and the file. */
create function pg_temp.card(p_account uuid, p_task text) returns jsonb language plpgsql as $fn$
declare
  v jsonb := api.v1_card(p_account, p_task);
begin
  return v || jsonb_build_object('body', pg_temp.body_of(v));
end;
$fn$;

/** A card's file body, from where the index says it is. */
create function pg_temp.body_of(p_card jsonb) returns text language sql as $fn$
  select content from board_files where project = p_card ->> 'project' and path = p_card ->> 'path';
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
  v_delivering uuid;
  v_asking uuid;
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

  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f1', false, BUDGET);
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
    format('select api.record_event_delivery(%L, %L, %L, %L, %L, %L, %L, now(), %s)',
           B, v_event, 'slack', '', 'sent', 'ts', '', BUDGET),
    'AKB02', 'record_event_delivery');
  perform pg_temp.refuses(
    format('select api.register_board(%L, %L, %L, %s)', B, BOARD_A, 'stolen', BUDGET),
    'AKB02', 'register_board');
  perform pg_temp.refuses(
    format('select api.publish_event(%L, %L, 1, %L, %L, %L, %L, %L, %L, %L, %L, false, %s)',
           B, BOARD_A, 't', 'r9', 'ready_for_review', 'implement', '[]', '', '', 'f9', BUDGET),
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
  assert json_array_length(api.list_events(B) -> 'events') = 0, 'list_events showed another account’s event';
  assert json_array_length(api.list_events(A) -> 'events') = 1, 'list_events lost the account’s own event';
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
  perform api.record_event_delivery(A, v_event, 'lark', '', 'sent', 'om_1', '',
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
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f1', false, BUDGET);
  assert (v_json ->> 'id')::uuid = v_event, 'an unchanged snapshot raised a second row';

  -- An edit the event cannot see — a typo in a section it never carries
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
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', 'r2',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f1', false, BUDGET);
  assert (v_json ->> 'id')::uuid = v_event, 'a quiet refresh raised a second row';
  assert (v_json ->> 'revision') = 'r2', 'a quiet refresh did not write the revision through';
  assert (v_json ->> 'changedAt')::timestamptz = v_changed,
    'an edit the event cannot see marked the row unread again';
  assert (select content_at from cloud.events where id = v_event) > v_content,
    'a quiet refresh left the message showing what the card no longer says';

  -- What the person is asked to decide moving IS news: the same row, refreshed, and
  -- `changed_at` with it.
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', 'r2',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why moved', 'notes', 'f2', false, BUDGET);
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
  v_json := api.publish_event(A, BOARD_A, 330, 'A card nobody gets to', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', '', 'f1', false, BUDGET);
  v_retired := (v_json ->> 'id')::uuid;
  update cloud.events set content_at = now() - interval '1 hour' where id = v_retired;
  select content_at into v_content from cloud.events where id = v_retired;
  v_json := api.retire_event(A, v_retired, BUDGET);
  assert (v_json ->> 'state') = 'stale', 'a retirement did not leave the event stale';
  assert (select content_at from cloud.events where id = v_retired) > v_content,
    'a retired card left the chat offering a decision nobody can take';
  perform api.record_event_delivery(A, v_retired, 'slack', '', 'sent', 'ts-retired', '',
                                    v_content, BUDGET);
  assert (api.connector_jobs('slack', v_retired, 10, 5) -> 0) is not null,
    'a retired card owed a rewrite was not due';

  delete from cloud.slack_connections where owner_id = A;

  -- -------------------------------------------------------------------------
  -- A card asks again while its delivery waits for the answer (#647)
  -- -------------------------------------------------------------------------
  --
  -- One task keeps one live row, so a delivery that stops for an answer would find its own
  -- running event and raise nothing. A publication may name the event it stands BESIDE, and
  -- that one is left out of the look-up — but only the machine carrying the delivery names
  -- it, so a second machine publishing the same stop still raises nothing.

  v_json := api.publish_event(A, BOARD_A, 647, 'Notify again when a delivery stops',
                              'r1', 'ready_for_review', 'implement', '[]'::jsonb, 'why', '', 'f1',
                              false, BUDGET);
  v_delivering := (v_json ->> 'id')::uuid;
  perform api.record_event_action(A, 'op-647', v_delivering, 'implement', 'r1', '[]'::jsonb,
                                  'accepted', BUDGET);
  perform api.record_event_outcome(A, 'op-647-running', v_delivering, 'running', '', 900, BUDGET);

  -- Review sends the work back with a question. A machine that is not carrying this delivery
  -- names nothing, finds the running row, and leaves it exactly as it is.
  v_json := api.publish_event(A, BOARD_A, 647, 'Notify again when a delivery stops',
                              'r2', 'question', 'answer', '[{"text":"Which shade?"}]'::jsonb, 'why',
                              '', 'f2', false, BUDGET);
  assert (v_json ->> 'id')::uuid = v_delivering, 'a publication naming nothing moved the delivery''s row';
  assert (v_json ->> 'state') = 'running', 'a publication naming nothing refreshed a running row';

  -- The machine carrying it names it, and the card asks on a row of its own.
  v_json := api.publish_event(A, BOARD_A, 647, 'Notify again when a delivery stops',
                              'r2', 'question', 'answer', '[{"text":"Which shade?"}]'::jsonb, 'why',
                              '', 'f2', false, BUDGET, v_delivering);
  v_asking := (v_json ->> 'id')::uuid;
  assert v_asking <> v_delivering, 'the question was asked on the row the delivery is reporting against';
  assert (v_json ->> 'state') = 'actionable', 'the question raised nothing to answer';
  assert (v_json ->> 'kind') = 'question', 'the question was raised as something else';
  assert (select state from cloud.events where id = v_delivering) = 'running',
    'raising the question moved the delivery''s own row';

  -- The two report apart for the rest of their lives: the answer ends the question's row, and
  -- the delivery's own row is what says it landed.
  v_json := api.retire_event(A, v_asking, BUDGET);
  assert (v_json ->> 'state') = 'stale', 'an answered question left its row asking';
  v_json := api.record_event_outcome(A, 'op-647-landed', v_delivering, 'completed', '', 900, BUDGET);
  assert (v_json ->> 'state') = 'completed', 'the delivery that landed left no notification';
  assert (v_json ->> 'acted')::boolean, 'the landing lost the Implement it was granted';

  -- And a second stop revives the row the first one left, rather than adding a third.
  perform api.record_event_outcome(A, 'op-647-again', v_delivering, 'running', '', 900, BUDGET);
  v_json := api.publish_event(A, BOARD_A, 647, 'Notify again when a delivery stops',
                              'r3', 'question', 'answer', '[{"text":"And the other one?"}]'::jsonb,
                              'why', '', 'f3', false, BUDGET, v_delivering);
  assert (v_json ->> 'id')::uuid = v_asking, 'a second stop asked on a third row';
  assert (v_json ->> 'state') = 'actionable', 'a second stop did not revive the row';
  assert (select count(*) from cloud.events where task_id = 647) = 2,
    'one card and one delivery left more than the two rows they own';

  -- -------------------------------------------------------------------------
  -- A retirement that raced a click does not lose the click (#640)
  -- -------------------------------------------------------------------------
  --
  -- Starting a run is itself a board write, so a retirement can reach Cloud between the
  -- press and the action it records. `v_retired` is exactly that row: stale, and nobody
  -- acted on it. It revives for the action on the same terms `publish_event` revives one —
  -- stale and unacted is still this card's row — so the delivery has something to land on.

  -- What the user approved is still what gets built: a revision that has moved is refused
  -- here as anywhere else.
  perform pg_temp.refuses(
    format('select api.record_event_action(%L, %L, %L, %L, %L, %L, %L, %s)',
           A, 'op-640-moved', v_retired, 'implement', 'r9', '[]', 'accepted', BUDGET),
    'AKB03', 'an action on a retired event against a revision that has moved');

  v_json := api.record_event_action(A, 'op-640', v_retired, 'implement', 'r1', '[]'::jsonb,
                                    'accepted', BUDGET);
  assert (v_json ->> 'state') = 'accepted', 'an unacted retirement did not revive for the action';
  assert (select finished_at from cloud.events where id = v_retired) is null,
    'a revived event stayed finished, so the 30-day sweep would take a live delivery with it';

  -- And the landing the retirement raced now has an action to land on, which is the whole
  -- point: before this it returned unwritten and the user was told nothing.
  v_json := api.record_event_outcome(A, 'op-640-landed', v_retired, 'completed', '', 900, BUDGET);
  assert (v_json ->> 'state') = 'completed', 'a delivery that landed left no notification';

  -- One action per event all the same: reviving is about a row nobody acted on, and one
  -- that carries an action is still refused.
  perform pg_temp.refuses(
    format('select api.record_event_action(%L, %L, %L, %L, %L, %L, %L, %s)',
           A, 'op-640-again', v_retired, 'implement', 'r1', '[]', 'accepted', BUDGET),
    'AKB04', 'a second action on a revived event');

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
  v_json := api.publish_event(A, BOARD_A, 329, 'Harden the Cloud event flow', 'r3',
                              'ready_for_review', 'implement', '[]'::jsonb, 'why', 'notes', 'f3', false, BUDGET);
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
  perform api.record_event_delivery(A, v_event, 'slack', '', 'sent', 'ts-first', '',
                                    now() - interval '2 hours', BUDGET);
  perform api.record_event_delivery(A, v_second, 'slack', '', 'sent', 'ts-second', '',
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
  perform api.record_event_delivery(A, v_second, 'lark', '', 'sent', 'oc_1:om-second', '',
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
  perform api.record_card_message(A, BOARD_A, 329, 'slack', '', 'ts-card', BUDGET);
  perform api.record_card_message(A, BOARD_A, 329, 'slack', '', 'ts-card-2', BUDGET);
  select count(*) into v_count from cloud.card_messages
   where board_id = BOARD_A and task_id = 329 and connector = 'slack';
  assert v_count = 1, 'a card kept two messages for one connector';
  assert ((api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'cardRef') = 'ts-card-2',
    'the card''s message was not handed to the job that has to rewrite it';
  perform pg_temp.refuses(
    format('select api.record_card_message(%L, %L, 329, %L, %L, %L, %s)', B, BOARD_A, 'slack', '', 'ts', BUDGET),
    'AKB02', 'record_card_message');

  -- Lark keeps a record of its own, scoped to the chat this connection posts to now — the
  -- account moved to `oc_2` above, so one left behind in `oc_1` is never offered.
  perform api.record_card_message(A, BOARD_A, 329, 'lark', '', 'oc_1:om-card', BUDGET);
  assert (api.connector_jobs('lark', v_second, 10, 5) -> 0) ->> 'cardRef' is null,
    'a card message left in the chat the connection moved away from was still offered';
  perform api.record_card_message(A, BOARD_A, 329, 'lark', '', 'oc_2:om-card', BUDGET);
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
  perform api.record_delivery_ending(A, v_second, 'slack', '', 'ts-ended', BUDGET);
  assert ((api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'endingRef') = 'ts-ended',
    'an ending already logged was not handed back to the job that must not log it again';

  -- Written once: a row that already names an ending keeps the one it has.
  perform api.record_delivery_ending(A, v_second, 'slack', '', 'ts-ended-2', BUDGET);
  assert ((api.connector_jobs('slack', v_second, 10, 5) -> 0) ->> 'endingRef') = 'ts-ended',
    'an ending was rewritten by a later pass';

  -- Each connector keeps its own, on that connector's own delivery row.
  assert (api.connector_jobs('lark', v_second, 10, 5) -> 0) ->> 'endingRef' is null,
    'one connector''s ending was offered to another';

  perform pg_temp.refuses(
    format('select api.record_delivery_ending(%L, %L, %L, %L, %L, %s)', B, v_second, 'slack', '', 'ts', BUDGET),
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
-- Changing the watched scope raises nothing that was already waiting (#451)
-- ---------------------------------------------------------------------------
--
-- A block of its own, on a board of its own: what a scope change does is read against the
-- mark it leaves on a publication, and mixing it into the flow above would make every
-- assertion there depend on which switch had last been moved. The account is the one the
-- block above already made.

do $watching$
declare
  A constant uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  B constant uuid := 'bbbbbbbb-2222-4222-8222-222222222222';
  BOARD constant uuid := '77777777-4444-4444-8444-cccccccccccc';
  BUDGET constant integer := 100000;
  v_json json;
  v_quiet uuid;
  v_news uuid;
  v_round uuid;
  v_ended uuid;
begin
  delete from cloud.slack_connections where owner_id in (A, B);
  delete from cloud.lark_connections where owner_id in (A, B);
  perform api.register_board(A, BOARD, 'watch-board', BUDGET);

  -- The publisher's mark reaches storage, and ordinary news does not carry it.
  v_json := api.publish_event(A, BOARD, 601, 'Already waiting', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, '', '', 'w1', true, BUDGET);
  v_quiet := (v_json ->> 'id')::uuid;
  assert (v_json ->> 'broughtIn')::boolean, 'a scope change did not mark what it brought in';

  v_json := api.publish_event(A, BOARD, 602, 'Started waiting afterwards', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, '', '', 'n1', false, BUDGET);
  v_news := (v_json ->> 'id')::uuid;
  assert not (v_json ->> 'broughtIn')::boolean, 'ordinary news was marked as brought in';

  -- A chat already connected when the switch landed is owed nothing for what it brought in,
  -- and everything for a card that started waiting afterwards.
  insert into cloud.slack_connections (owner_id, team_id, bot_token, channel_id, slack_user_id, created_at)
  values (A, 'T9', 'xoxb', 'C9', 'U9', now() - interval '1 day');
  assert (api.connector_jobs('slack', v_quiet, 10, 5) -> 0) is null,
    'a scope change owed a message to a chat that was already connected';
  assert (api.connector_jobs('slack', v_news, 10, 5) -> 0) is not null,
    'a card that started waiting after the switch was owed no message';

  -- A chat connected AFTERWARDS is asking for the board, so a mark that silences one switch
  -- must not leave it permanently empty.
  update cloud.slack_connections set created_at = now() + interval '1 minute' where owner_id = A;
  assert (api.connector_jobs('slack', v_quiet, 10, 5) -> 0) is not null,
    'a chat connected after the switch was left permanently empty';
  update cloud.slack_connections set created_at = now() - interval '1 day' where owner_id = A;

  -- A message that already exists goes on following its card. An edit costs no message and
  -- pings nobody, and a chat showing "No longer waiting" over a card that is waiting is
  -- 0015's defect the other way round.
  perform api.record_event_delivery(A, v_quiet, 'slack', '', 'sent', 'ts-quiet', '',
                                    now() - interval '1 hour', BUDGET);
  assert (api.connector_jobs('slack', v_quiet, 10, 5) -> 0) is not null,
    'a message the card already has stopped following it';
  delete from cloud.event_deliveries where event_id = v_quiet;

  -- A quiet refresh is not the card moving, so it leaves the mark where it is: writing the
  -- revision through must not turn a quiet fill into an interruption.
  v_json := api.publish_event(A, BOARD, 601, 'Already waiting', 'r2',
                              'ready_for_review', 'implement', '[]'::jsonb, '', '', 'w1', false, BUDGET);
  assert (v_json ->> 'broughtIn')::boolean, 'a quiet refresh raised what a scope change had quietened';

  -- What the person is asked to decide moving IS news, and the mark goes with it.
  v_json := api.publish_event(A, BOARD, 601, 'Already waiting', 'r3',
                              'ready_for_review', 'implement', '[]'::jsonb, 'moved', '', 'w2', false, BUDGET);
  assert not (v_json ->> 'broughtIn')::boolean, 'a card that moved after the switch stayed quiet';
  assert (api.connector_jobs('slack', v_quiet, 10, 5) -> 0) is not null,
    'a card that became news after the switch was still owed no message';

  -- The mark says how the publication ARRIVED, so it is read only while the row is still
  -- asking. A delivery taken on such a card ends as news like any other — an outcome nobody
  -- is told about is a delivery that finished in silence.
  v_json := api.publish_event(A, BOARD, 604, 'Implemented after the switch', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, '', '', 'y1', true, BUDGET);
  v_ended := (v_json ->> 'id')::uuid;
  assert (v_json ->> 'broughtIn')::boolean, 'a scope change did not mark what it brought in';
  perform api.record_event_action(A, 'act-451', v_ended, 'implement', 'r1', '[]'::jsonb,
                                  'waiting_for_server', BUDGET);
  v_json := api.record_event_outcome(A, 'out-451', v_ended, 'completed', '', 900, BUDGET);
  assert (v_json ->> 'state') = 'completed', 'the outcome did not reach the event';
  assert not (v_json ->> 'broughtIn')::boolean,
    'a delivery on a card the switch brought in finished without telling anybody';

  -- The round trip: narrowing retires the row, widening revives that same one, and the
  -- revival carries the mark. `0.9 → all → 0.9 → all` costs no row and no interruption.
  v_json := api.publish_event(A, BOARD, 603, 'In and out of scope', 'r1',
                              'question', 'answer', '[]'::jsonb, '', '', 'x1', true, BUDGET);
  v_round := (v_json ->> 'id')::uuid;
  assert (api.retire_event(A, v_round, BUDGET) ->> 'state') = 'stale',
    'narrowing did not retire what left the scope';
  v_json := api.publish_event(A, BOARD, 603, 'In and out of scope', 'r1',
                              'question', 'answer', '[]'::jsonb, '', '', 'x1', true, BUDGET);
  assert (v_json ->> 'id')::uuid = v_round, 'a round trip left a second row behind';
  assert (v_json ->> 'broughtIn')::boolean, 'widening again raised the bell for the same card';

  -- -------------------------------------------------------------------------
  -- The switch's own summary
  -- -------------------------------------------------------------------------

  v_json := api.record_watch_summary(A, 'sum-1', BOARD, 12, BUDGET);
  assert (v_json ->> 'posted')::boolean, 'the switch''s summary was not written down';
  assert (v_json ->> 'cards')::integer = 12, 'the summary lost the count it brought in';
  -- A retry of an attempt that already landed posts nothing.
  v_json := api.record_watch_summary(A, 'sum-1', BOARD, 12, BUDGET);
  assert not (v_json ->> 'posted')::boolean, 'a retried summary would have posted a second message';
  assert (select count(*) from cloud.watch_summaries where op_id = 'sum-1') = 1,
    'a retried summary left a second row';

  -- It is another account's board, so it is not theirs to say anything about.
  perform pg_temp.refuses(
    format('select api.record_watch_summary(%L, %L, %L, 3, %s)', B, 'sum-b', BOARD, BUDGET),
    'AKB02', 'record_watch_summary');

  -- It is addressed to the switching account and nobody else.
  assert json_array_length(api.watch_summary_targets(A)) = 1,
    'the summary was not addressed to the account that moved the switch';
  assert json_array_length(api.watch_summary_targets(B)) = 0,
    'the summary reached another account''s chats';
  assert (api.watch_summary_targets(A) -> 0 -> 'posts' ->> 'channelId') = 'C9',
    'the summary lost the destination it goes to';

  -- The 30-day sweep frees it: the row exists to stop a retry posting twice, and nothing
  -- retries after an afternoon.
  update cloud.watch_summaries set created_at = now() - interval '31 days' where op_id = 'sum-1';
  assert (api.sweep_events() ->> 'watchSummaries')::integer = 1, 'the sweep left a summary behind';

  delete from cloud.slack_connections where owner_id = A;
  raise notice 'sql checks: #451 watch-scope checks passed';
end
$watching$;

-- ---------------------------------------------------------------------------
-- A rendered event reports the decision that was ACTED on (#642)
-- ---------------------------------------------------------------------------
--
-- A card holding a question raises a `question` event, and pressing **Implement** on it
-- anyway records an `implement` action. Everything downstream that asks what this event's
-- decision was — whether the landing is worth a notification, above all — has to be told
-- what was done, not what was asked.

do $acted$
declare
  OWNER constant uuid := 'aa000000-6420-4420-8420-000000000001';
  BOARD constant uuid := 'bb000000-6420-4420-8420-000000000002';
  BUDGET constant integer := 100000;
  ASKED constant jsonb := '[{"text": "Which option?"}]'::jsonb;
  v_asking uuid;
  v_answering uuid;
  v_untouched uuid;
  v_json json;
begin
  insert into cloud.accounts (id, handle) values (OWNER, 'a-owner');
  perform api.register_board(OWNER, BOARD, 'an-acted-board', BUDGET);

  -- -------------------------------------------------------------------------
  -- Implement pressed on a card that is still asking
  -- -------------------------------------------------------------------------

  v_json := api.publish_event(OWNER, BOARD, 6421, 'Asking, and built anyway', 'r1',
                              'question', 'answer', ASKED, '', '', 'f1', false, BUDGET);
  v_asking := (v_json ->> 'id')::uuid;
  assert (v_json ->> 'decision') = 'answer',
    'an unacted question did not report the decision it asked for';

  perform api.record_event_action(OWNER, 'a-op-1', v_asking, 'implement', 'r1',
                                  '[]'::jsonb, 'accepted', BUDGET);
  v_json := api.record_event_outcome(OWNER, 'a-op-2', v_asking, 'completed', '', 900, BUDGET);
  assert (v_json ->> 'decision') = 'implement',
    'a landing reported the decision the card asked for rather than the one pressed';
  assert (v_json ->> 'kind') = 'question',
    'reading the action rewrote what the card was asking';
  assert (v_json ->> 'acted')::boolean, 'a landing did not carry its action';

  -- -------------------------------------------------------------------------
  -- An approved answer still reads as an answer
  -- -------------------------------------------------------------------------

  v_json := api.publish_event(OWNER, BOARD, 6422, 'Asking, and answered', 'r1',
                              'question', 'answer', ASKED, '', '', 'f2', false, BUDGET);
  v_answering := (v_json ->> 'id')::uuid;
  perform api.record_event_action(OWNER, 'a-op-3', v_answering, 'answer', 'r1',
                                  '[{"text": "the first"}]'::jsonb, 'accepted', BUDGET);
  v_json := api.record_event_outcome(OWNER, 'a-op-4', v_answering, 'completed', '', 900, BUDGET);
  assert (v_json ->> 'decision') = 'answer',
    'an answer that ran reported itself as an implement';

  -- -------------------------------------------------------------------------
  -- An event nobody has acted on reports what it is asking
  -- -------------------------------------------------------------------------

  v_json := api.publish_event(OWNER, BOARD, 6423, 'Still waiting', 'r1',
                              'ready_for_review', 'implement', '[]'::jsonb, '', '', 'f3', false, BUDGET);
  v_untouched := (v_json ->> 'id')::uuid;
  assert (v_json ->> 'decision') = 'implement',
    'an unacted review did not report the decision it asked for';
  assert (select cloud.event_json(e) ->> 'decision' from cloud.events e where e.id = v_untouched)
         = 'implement',
    'another event''s action reached a row of its own';

  raise notice 'sql checks: #642 acted-decision checks passed';
end
$acted$;

-- ---------------------------------------------------------------------------
-- A training hour is held by one booking and nobody else (#683)
-- ---------------------------------------------------------------------------
--
-- The page's whole promise is that two visitors filling the form at once come away with one
-- appointment between them. That is the partial unique index, reached through `book_training`
-- — plus the three rules hanging off it: a retried submit is the same booking, a manage token
-- is the only way in, and cancelling gives the hour back.

do $training$
declare
  BUDGET constant integer := 100000;
  WINDOW_SECONDS constant integer := 900;
  LIMIT_HIGH constant integer := 1000;
  SLOT constant timestamptz := now() + interval '3 days';
  OTHER constant timestamptz := now() + interval '4 days';
  TOKEN constant text := 'a-token-hash';
  ELSE_TOKEN constant text := 'another-token-hash';
  v_first json;
  v_again json;
  v_read json;
  v_reference text;
begin
  -- -------------------------------------------------------------------------
  -- Two submits, one hour
  -- -------------------------------------------------------------------------

  v_first := api.book_training('op-1', SLOT, 'single', 9900, 'First Asker', 'first@example.com',
                               'America/New_York', 'a project', TOKEN, 'fp-1',
                               WINDOW_SECONDS, LIMIT_HIGH, BUDGET);
  v_reference := v_first ->> 'reference';
  assert v_reference like 'TR-%', 'a booking came back with no reference to quote';
  assert (v_first ->> 'state') = 'booked', 'a fresh booking was not booked';

  perform pg_temp.refuses(
    $sql$select api.book_training('op-2', (select slot_at from cloud.training_bookings limit 1),
                                  'single', 9900, 'Second Asker', 'second@example.com',
                                  'Europe/Berlin', '', 'a-third-token', 'fp-2', 900, 1000, 100000)$sql$,
    'AKB17', 'a second booking took an hour that was already held');

  -- -------------------------------------------------------------------------
  -- A retry of one submit is that booking, not a second one
  -- -------------------------------------------------------------------------

  v_again := api.book_training('op-1', SLOT, 'single', 9900, 'First Asker', 'first@example.com',
                               'America/New_York', 'a project', TOKEN, 'fp-1',
                               WINDOW_SECONDS, LIMIT_HIGH, BUDGET);
  assert (v_again ->> 'reference') = v_reference, 'a retried submit made a second booking';
  assert (select count(*) from cloud.training_bookings) = 1,
    'a retried submit left two rows behind';

  perform pg_temp.refuses(
    $sql$select api.book_training('op-1', now() + interval '4 days', 'single', 9900, 'First Asker',
                                  'first@example.com', 'America/New_York', '', 'a-token-hash',
                                  'fp-1', 900, 1000, 100000)$sql$,
    'AKB07', 'one submission id was allowed to book two different hours');

  -- -------------------------------------------------------------------------
  -- The availability read says which hours are taken and nothing else
  -- -------------------------------------------------------------------------

  assert json_array_length(api.training_booked_slots(now(), now() + interval '7 days')) = 1,
    'the availability read did not report the hour that is taken';
  assert (api.training_booked_slots(now(), now() + interval '7 days') ->> 0) is not null,
    'the availability read answered with something other than an instant';
  assert (api.training_booked_slots(now(), now() + interval '7 days'))::text not like '%first@example.com%',
    'the public availability read carried a visitor address';
  assert (api.training_booked_slots(now(), now() + interval '7 days'))::text not like '%First Asker%',
    'the public availability read carried a visitor name';

  -- -------------------------------------------------------------------------
  -- An hour that has passed is never taken
  -- -------------------------------------------------------------------------

  perform pg_temp.refuses(
    $sql$select api.book_training('op-past', now() - interval '1 hour', 'single', 9900, 'Late',
                                  'late@example.com', 'Europe/Berlin', '', 'past-token', 'fp-3',
                                  900, 1000, 100000)$sql$,
    'AKB17', 'an hour in the past was bookable');

  -- -------------------------------------------------------------------------
  -- The token is the whole of the authorization
  -- -------------------------------------------------------------------------

  assert api.read_training_booking(v_reference, ELSE_TOKEN) is null,
    'a wrong token read somebody else''s booking';
  assert api.read_training_booking('TR-NOSUCH', TOKEN) is null,
    'a reference nobody holds answered with a booking';
  v_read := api.read_training_booking(v_reference, TOKEN);
  assert (v_read ->> 'email') = 'first@example.com', 'the token holder could not read their own booking';

  assert api.cancel_training_booking(v_reference, ELSE_TOKEN, BUDGET) is null,
    'a wrong token cancelled somebody else''s booking';
  assert (select state from cloud.training_bookings where reference = v_reference) = 'booked',
    'a refused cancellation still moved the row';

  -- -------------------------------------------------------------------------
  -- Cancelling gives the hour back, and twice is the same as once
  -- -------------------------------------------------------------------------

  assert (api.cancel_training_booking(v_reference, TOKEN, BUDGET) ->> 'state') = 'cancelled',
    'cancelling did not cancel';
  assert json_array_length(api.training_booked_slots(now(), now() + interval '7 days')) = 0,
    'a cancelled hour was still reported as taken';
  assert (api.cancel_training_booking(v_reference, TOKEN, BUDGET) ->> 'state') = 'cancelled',
    'cancelling twice answered with something other than the cancelled booking';
  assert (select count(*) from cloud.training_notices
           where booking_id = (select id from cloud.training_bookings where reference = v_reference)
             and kind = 'cancelled') = 1,
    'cancelling twice queued the message twice';

  -- The freed hour is bookable again, by somebody else.
  assert (api.book_training('op-3', SLOT, 'monthly', 34900, 'Third Asker', 'third@example.com',
                            'Asia/Shanghai', '', 'third-token', 'fp-4',
                            WINDOW_SECONDS, LIMIT_HIGH, BUDGET) ->> 'state') = 'booked',
    'an hour freed by a cancellation was not offered again';

  -- -------------------------------------------------------------------------
  -- Every booking queues its two messages, and a failure keeps them queued
  -- -------------------------------------------------------------------------

  assert json_array_length(api.pending_training_mail(20, 5)) =
         (select count(*) from cloud.training_notices where sent_at is null),
    'the outbox did not offer every message still owed';

  perform api.mark_training_mail_failed(
    (select id from cloud.training_bookings where op_id = 'op-3'), 'visitor', 'resend said no');
  assert (select attempts from cloud.training_notices
           where booking_id = (select id from cloud.training_bookings where op_id = 'op-3')
             and kind = 'visitor') = 1,
    'a failed send was not counted';
  assert (select state from cloud.training_bookings where op_id = 'op-3') = 'booked',
    'a message the provider refused took the booking down with it';

  perform api.mark_training_mail_sent(
    (select id from cloud.training_bookings where op_id = 'op-3'), 'visitor');
  assert (select sent_at from cloud.training_notices
           where booking_id = (select id from cloud.training_bookings where op_id = 'op-3')
             and kind = 'visitor') is not null,
    'a sent message was not marked';

  -- -------------------------------------------------------------------------
  -- The rate limit stops at the limit rather than climbing
  -- -------------------------------------------------------------------------

  perform cloud.count_training_attempt('fp-limited', WINDOW_SECONDS, 2);
  perform cloud.count_training_attempt('fp-limited', WINDOW_SECONDS, 2);
  perform pg_temp.refuses(
    $sql$select cloud.count_training_attempt('fp-limited', 900, 2)$sql$,
    'AKB18', 'a caller past the booking limit was not refused');
  assert (select attempts from cloud.training_attempts where fingerprint = 'fp-limited') = 2,
    'a refused attempt was still counted against the caller';

  -- A window that has run out starts the count again.
  update cloud.training_attempts set window_start = now() - interval '1 hour'
   where fingerprint = 'fp-limited';
  perform cloud.count_training_attempt('fp-limited', WINDOW_SECONDS, 2);
  assert (select attempts from cloud.training_attempts where fingerprint = 'fp-limited') = 1,
    'a new window did not start the count again';

  raise notice 'sql checks: #683 training booking checks passed';
end
$training$;


-- ---------------------------------------------------------------------------
-- A contact message is kept once and limited by two keys (#784)
-- ---------------------------------------------------------------------------

do $contact$
declare
  BUDGET constant integer := 100000;
  v_first json;
  v_again json;
begin
  v_first := api.submit_contact('c-op-1', 'support', 'lin@example.com', 'hello', '', '',
                                'contact:ip-1', 'contact:mail-1', 3600, 2, BUDGET);
  v_again := api.submit_contact('c-op-1', 'support', 'lin@example.com', 'hello', '', '',
                                'contact:ip-1', 'contact:mail-1', 3600, 2, BUDGET);
  assert (v_first ->> 'id') = (v_again ->> 'id'), 'a retried submit made a second message';
  assert (select count(*) from cloud.contact_messages) = 1, 'a retried submit made a second row';
  assert (select attempts from cloud.training_attempts where fingerprint = 'contact:ip-1') = 1,
    'a retried submit was counted again';

  -- The address is past its limit; a fresh email does not get it through.
  perform api.submit_contact('c-op-2', 'support', 'other@example.com', 'hi', '', '',
                             'contact:ip-1', 'contact:mail-2', 3600, 2, BUDGET);
  perform pg_temp.refuses(
    $sql$select api.submit_contact('c-op-3', 'support', 'third@example.com', 'hi', '', '',
                                   'contact:ip-1', 'contact:mail-3', 3600, 2, 100000)$sql$,
    'AKB18', 'an address past its limit was not refused');
  assert (select attempts from cloud.training_attempts where fingerprint = 'contact:mail-3') is null,
    'a refused submit still counted its email';

  -- The email is past its limit; a fresh address does not get it through.
  perform api.submit_contact('c-op-4', 'support', 'lin@example.com', 'hi', '', '',
                             'contact:ip-2', 'contact:mail-1', 3600, 2, BUDGET);
  perform pg_temp.refuses(
    $sql$select api.submit_contact('c-op-5', 'support', 'lin@example.com', 'hi', '', '',
                                   'contact:ip-3', 'contact:mail-1', 3600, 2, 100000)$sql$,
    'AKB18', 'an email past its limit was not refused');

  -- No address: the email alone is counted.
  perform api.submit_contact('c-op-6', 'customize', 'new@example.com', 'hi', 'a workflow', '',
                             '', 'contact:mail-4', 3600, 2, BUDGET);
  assert (select count(*) from cloud.training_attempts where fingerprint = '') = 0,
    'an empty address was counted';
  assert (select count(*) from cloud.contact_messages) = 4, 'a refused submit was kept';
  assert (select workflow from cloud.contact_messages where op_id = 'c-op-6') = 'a workflow',
    'the workflow was not kept';

  perform pg_temp.refuses(
    $sql$select api.submit_contact('c-op-7', 'sales', 'x@example.com', 'hi', '', '',
                                   '', 'contact:mail-5', 3600, 2, 100000)$sql$,
    '23514', 'a reason the form does not offer was stored');

  -- The outbox offers every row, and a failure keeps it offered.
  assert json_array_length(api.pending_contact_mail(20, 5)) = 4,
    'the outbox did not offer every message';
  perform api.mark_contact_mail_failed((v_first ->> 'id')::uuid, 'resend said no');
  assert (select attempts from cloud.contact_messages where id = (v_first ->> 'id')::uuid) = 1,
    'a failed send was not counted';
  assert json_array_length(api.pending_contact_mail(20, 5)) = 4,
    'a failed send left the outbox';
  perform api.mark_contact_mail_sent((v_first ->> 'id')::uuid);
  assert json_array_length(api.pending_contact_mail(20, 5)) = 3,
    'a sent message was offered again';

  raise notice 'sql checks: #784 contact checks passed';
end
$contact$;

-- ---------------------------------------------------------------------------
-- A seed partner applies through the contact form and is granted once (#1039)
-- ---------------------------------------------------------------------------

do $seed$
declare
  PARTNER constant uuid := '00000000-0000-4000-8000-00000000d001';
  STRANGER constant uuid := '00000000-0000-4000-8000-00000000d002';
  v_grant json;
begin
  perform api.submit_contact('s-op-1', 'seed', 'seed@example.com', 'Daily, for a CLI.', '', 'Seedling',
                             '', 'contact:mail-seed', 3600, 2, 100000);
  assert (select github from cloud.contact_messages where op_id = 's-op-1') = 'Seedling',
    'the GitHub username was not kept';
  assert (select m ->> 'github' from json_array_elements(api.pending_contact_mail(50, 5)) m
          where m ->> 'email' = 'seed@example.com') = 'Seedling',
    'the outbox did not carry the GitHub username';

  -- Granted before they ever signed in; matched on the handle GitHub attests, in any case.
  v_grant := cloud.grant_seed('@seedling');
  assert (v_grant ->> 'handle') = 'seedling', 'the @ was kept on the handle';
  assert (select ends_at = starts_at + interval '6 months' from cloud.seed_grants where handle = 'seedling'),
    'the grant is not six months';
  insert into auth.identities (user_id, provider, identity_data)
  values (PARTNER, 'github', '{"user_name":"SeedLing"}'::jsonb),
         (STRANGER, 'github', '{"user_name":"someone"}'::jsonb);
  assert api.seed_grant_for(PARTNER) ->> 'ends_at' like '____-__-__T__:__:__.___Z',
    'the partner did not get their grant back';
  assert api.seed_grant_for(STRANGER) is null, 'somebody else got the grant';

  -- One grant per handle, ever — lapsed ones too.
  perform pg_temp.refuses($sql$select cloud.grant_seed('SEEDLING')$sql$, 'P0001', 'a second grant was written');
  update cloud.seed_grants set starts_at = now() - interval '1 year', ends_at = now() - interval '6 months';
  perform pg_temp.refuses($sql$select cloud.grant_seed('seedling')$sql$, 'P0001', 'a lapsed handle was granted again');
  assert api.seed_grant_for(PARTNER) is not null, 'a lapsed grant was not read back for the Worker to judge';
  perform pg_temp.refuses($sql$select cloud.grant_seed('not a handle')$sql$, 'P0001', 'a non-handle was granted');

  raise notice 'sql checks: #1039 seed partner checks passed';
end
$seed$;

-- ---------------------------------------------------------------------------
-- A subscription is Creem's row, written whole and read unjudged (#1037)
-- ---------------------------------------------------------------------------

do $billing$
declare
  BUDGET constant integer := 100000;
  BUYER constant uuid := '00000000-0000-4000-8000-00000000b001';
  OTHER constant uuid := '00000000-0000-4000-8000-00000000b002';
  END_AT constant timestamptz := '2027-10-03 09:51:47.123+00';
  v_writes bigint;
  v_rows json;
begin
  perform api.record_subscription('sub_1', BUYER, 'cust_1', 'yearly', 'active', END_AT, BUDGET);
  select writes into v_writes from cloud.daily_writes where day = (now() at time zone 'utc')::date;

  -- A replayed notification: same row, no second write, no budget spent.
  perform api.record_subscription('sub_1', BUYER, 'cust_1', 'yearly', 'active', END_AT, BUDGET);
  assert (select count(*) from cloud.subscriptions) = 1, 'a replay made a second row';
  assert (select writes from cloud.daily_writes where day = (now() at time zone 'utc')::date) = v_writes,
    'a replay that changed nothing spent the budget';

  -- Whatever Creem says last is the row, whichever state came before it.
  perform api.record_subscription('sub_1', BUYER, 'cust_1', 'yearly', 'expired', END_AT, BUDGET);
  perform api.record_subscription('sub_1', BUYER, 'cust_1', 'yearly', 'active', END_AT + interval '1 year', BUDGET);
  assert (select status from cloud.subscriptions where id = 'sub_1') = 'active',
    'the later write did not replace the row';

  -- No user on the call keeps the row's own; no user anywhere writes nothing.
  perform api.record_subscription('sub_1', null, 'cust_1', 'yearly', 'scheduled_cancel', END_AT, BUDGET);
  assert (select user_id from cloud.subscriptions where id = 'sub_1') = BUYER,
    'a write with no user dropped the owner';
  assert api.record_subscription('sub_x', null, 'cust_x', 'monthly', 'active', END_AT, BUDGET) is null,
    'a subscription with no user was written';
  assert (select count(*) from cloud.subscriptions where id = 'sub_x') = 0, 'an ownerless row was kept';

  perform pg_temp.refuses(
    $sql$select api.record_subscription('sub_y', '00000000-0000-4000-8000-00000000b001', 'c', 'weekly', 'active', null, 100000)$sql$,
    '23514', 'a period Pro does not sell was stored');

  -- A lapsed row is still read back, with its end to the millisecond: the Worker judges it.
  perform api.record_subscription('sub_2', BUYER, 'cust_1', 'monthly', 'canceled', END_AT - interval '1 year', BUDGET);
  perform api.record_subscription('sub_3', OTHER, 'cust_3', 'monthly', 'active', END_AT, BUDGET);
  v_rows := api.subscriptions_for(BUYER);
  assert json_array_length(v_rows) = 2, 'a user was not given exactly their own subscriptions';
  assert (select count(*) from json_array_elements(v_rows) r where r ->> 'id' = 'sub_2') = 1,
    'a lapsed subscription was filtered out before it was judged';
  assert (select r ->> 'current_period_end' from json_array_elements(v_rows) r where r ->> 'id' = 'sub_1')
    = '2027-10-03T09:51:47.123Z', 'the period end did not come back to the millisecond';
  assert json_array_length(api.subscriptions_for('00000000-0000-4000-8000-00000000b003')) = 0,
    'a user with none was given some';

  raise notice 'sql checks: #1037 subscription checks passed';
end
$billing$;

-- ---------------------------------------------------------------------------
-- A refund only ever moves forward, and survives Creem's next write (#1188)
-- ---------------------------------------------------------------------------

do $refund$
declare
  BUDGET constant integer := 100000;
  BUYER constant uuid := '00000000-0000-4000-8000-00000000b101';
  END_AT constant timestamptz := '2026-10-27 09:51:47.123+00';
  CANCELED_AT constant timestamptz := '2026-09-28 10:00:00+00';
  v_writes bigint;
  v_row json;
begin
  assert api.record_refund('sub_r0', END_AT, CANCELED_AT, BUDGET) is null, 'a refund made a row of its own';

  perform api.record_subscription('sub_r1', BUYER, 'cust_r', 'monthly', 'canceled', END_AT, BUDGET);
  perform api.record_refund('sub_r1', END_AT, CANCELED_AT, BUDGET);
  select writes into v_writes from cloud.daily_writes where day = (now() at time zone 'utc')::date;

  -- A replay, and an older period's refund arriving late, change nothing.
  perform api.record_refund('sub_r1', END_AT, now(), BUDGET);
  perform api.record_refund('sub_r1', END_AT - interval '1 month', now(), BUDGET);
  assert (select writes from cloud.daily_writes where day = (now() at time zone 'utc')::date) = v_writes,
    'a refund that changed nothing spent the budget';
  assert (select refunded_through from cloud.subscriptions where id = 'sub_r1') = END_AT, 'a refund moved back';
  assert (select revoked_at from cloud.subscriptions where id = 'sub_r1') = CANCELED_AT, 'a replay moved the revoke time';

  -- Creem's next write of the row keeps the refund.
  perform api.record_subscription('sub_r1', BUYER, 'cust_r', 'monthly', 'active', END_AT + interval '1 month', BUDGET);
  v_row := api.subscriptions_for(BUYER) -> 0;
  assert v_row ->> 'refunded_through' = '2026-10-27T09:51:47.123Z', 'the refund did not come back to the millisecond';
  assert v_row ->> 'revoked_at' = '2026-09-28T10:00:00.000Z', 'the revoke time did not come back';

  -- A later refund moves both; with no cancel time the revoke is now.
  perform api.record_refund('sub_r1', END_AT + interval '1 month', null, BUDGET);
  assert (select refunded_through from cloud.subscriptions where id = 'sub_r1') = END_AT + interval '1 month',
    'a later refund did not move forward';
  assert (select revoked_at from cloud.subscriptions where id = 'sub_r1') <> CANCELED_AT, 'a later refund kept the old revoke time';

  perform api.record_subscription('sub_r2', BUYER, 'cust_r', 'monthly', 'active', END_AT, BUDGET);
  assert (select refunded_through is null and revoked_at is null from cloud.subscriptions where id = 'sub_r2'),
    'a subscription with no refund read as refunded';

  raise notice 'sql checks: #1188 refund checks passed';
end
$refund$;

-- ---------------------------------------------------------------------------
-- AI credits are spent per user and UTC month (#1113)
-- ---------------------------------------------------------------------------

do $credits$
declare
  SPEAKER constant uuid := '00000000-0000-4000-8000-00000000c001';
  OTHER constant uuid := '00000000-0000-4000-8000-00000000c002';
begin
  assert (api.credits_used(SPEAKER))::text::numeric = 0, 'a new user started with credits spent';
  perform api.spend_credits(SPEAKER, 'speech', 12.5);
  assert (api.spend_credits(SPEAKER, 'speech', 30))::text::numeric = 42.5, 'a second spend did not add up';
  assert (api.credits_used(SPEAKER))::text::numeric = 42.5, 'the month did not read back';
  assert (api.credits_used(OTHER))::text::numeric = 0, 'one user spent another''s credits';
  assert (select count(*) from cloud.credit_spends where user_id = SPEAKER and use = 'speech') = 2, 'a spend was not its own row';
  assert (api.spend_credits(SPEAKER, 'image', 320))::text::numeric = 362.5, 'a generated cover was not spent (#1114)';
  assert (api.spend_credits(SPEAKER, 'music', 320))::text::numeric = 682.5, 'a music track was not spent (#1822)';
  perform pg_temp.refuses($sql$select api.spend_credits('00000000-0000-4000-8000-00000000c001', 'movie', 1)$sql$,
    '23514', 'a spend on no known capability was stored');

  update cloud.credit_spends set month = (month - interval '1 month')::date where user_id = SPEAKER;
  assert (api.credits_used(SPEAKER))::text::numeric = 0, 'last month counted against this one';

  raise notice 'sql checks: #1113 credits checks passed';
end
$credits$;

-- ---------------------------------------------------------------------------
-- The trial is had once, and its credits are what it spent while it ran (#1932)
-- ---------------------------------------------------------------------------

do $trials$
declare
  TRIER constant uuid := '00000000-0000-4000-8000-00000000c201';
  OTHER constant uuid := '00000000-0000-4000-8000-00000000c202';
  BUDGET constant integer := 1000000;
  v_first json;
begin
  assert api.trial_for(TRIER) is null, 'a new user started with a trial';
  v_first := api.start_trial(TRIER, BUDGET);
  assert v_first ->> 'ends_at' like '____-__-__T__:__:__.___Z', 'the trial''s end is not an ISO date';
  assert (select ends_at - starts_at from cloud.pro_trials where user_id = TRIER) = interval '7 days',
    'the trial is not seven days';
  assert api.start_trial(TRIER, BUDGET)::text = v_first::text, 'a second start moved the trial';
  assert (select count(*) from cloud.pro_trials where user_id = TRIER) = 1, 'a user got two trials';
  assert api.trial_for(OTHER) is null, 'somebody else got the trial';

  perform api.spend_credits(TRIER, 'speech', 40);
  insert into cloud.credit_spends (user_id, month, use, credits, at)
  values (TRIER, date_trunc('month', now())::date, 'speech', 500, now() - interval '1 day');
  assert (api.trial_credits_used(TRIER))::text::numeric = 40, 'a spend before the trial counted against it';
  assert (api.trial_credits_used(OTHER))::text::numeric = 0, 'a user with no trial spent trial credits';

  raise notice 'sql checks: #1932 trial checks passed';
end
$trials$;

-- ---------------------------------------------------------------------------
-- Every hosted AI call is recorded with what it cost (#1355)
-- ---------------------------------------------------------------------------

do $ai_calls$
declare
  CALLER constant uuid := '00000000-0000-4000-8000-00000000c101';
  v_seen bigint;
begin
  perform api.record_ai_call(CALLER, 'judge', true, 3000, 0.0002, 'gen-1');
  perform api.record_ai_call(CALLER, 'speech', false, 4, 0.01, null);
  assert (select count(*) from cloud.ai_calls where user_id = CALLER) = 2, 'a call was not its own row';
  assert (select usage = 3000 and cost_usd = 0.0002 and generation_id = 'gen-1'
            and month = date_trunc('month', now() at time zone 'utc')::date
          from cloud.ai_calls where user_id = CALLER and ok), 'a call did not read back as recorded';
  assert (select usage is null and cost_usd is null from cloud.ai_calls where user_id = CALLER and not ok),
    'a failed call kept usage or cost';
  perform api.record_ai_call(CALLER, 'speech', true, 2.5, null, 'gen-2');
  perform api.record_ai_call(CALLER, 'music', true, 30, 0.08, 'gen-3');
  assert (select cost_usd is null and usage = 2.5 from cloud.ai_calls where generation_id = 'gen-2'),
    'a call whose cost is unknown was not stored with none';
  perform pg_temp.refuses(
    $sql$select api.record_ai_call('00000000-0000-4000-8000-00000000c101', 'movie', true, 1, 0, null)$sql$,
    '23514', 'a call of no known capability was stored');

  set local role authenticated;
  begin
    select count(*) into v_seen from cloud.ai_calls;
  exception when insufficient_privilege then
    v_seen := 0;
  end;
  reset role;
  assert v_seen = 0, 'a signed-in user read the call records';
  set local role authenticated;
  perform pg_temp.refuses(
    $sql$select api.record_ai_call('00000000-0000-4000-8000-00000000c101', 'judge', true, 1, 0, null)$sql$,
    '42501', 'a signed-in user recorded a call');
  reset role;

  raise notice 'sql checks: #1355 AI call checks passed';
end
$ai_calls$;

-- ---------------------------------------------------------------------------
-- The events read is paged (#1245)
-- ---------------------------------------------------------------------------

do $paged$
declare
  OWNER constant uuid := '00000000-0000-4000-8000-000000001245';
  OTHER constant uuid := '00000000-0000-4000-8000-000000002245';
  BOARD constant uuid := '12451245-0000-4000-8000-000000000001';
  SECOND constant uuid := '12451245-0000-4000-8000-000000000002';
  BUDGET constant integer := 100000;
  v_page json;
  v_seen text[] := '{}';
  v_next text;
  v_failed uuid;
  v_taken uuid;
  v_pages integer := 0;
begin
  insert into cloud.accounts (id, handle) values
    (OWNER, 'p-owner'), (OTHER, 'p-other');
  perform api.register_board(OWNER, BOARD, 'paged', BUDGET);
  perform api.register_board(OWNER, SECOND, 'paged-2', BUDGET);
  perform api.register_board(OTHER, '12451245-0000-4000-8000-000000000003', 'theirs', BUDGET);

  -- 70 landed deliveries on one board, a minute apart, and five more on the second.
  insert into cloud.events (owner_id, board_id, task_id, task_title, revision, kind, decision,
                            fingerprint, state, changed_at, finished_at)
  select OWNER, case when n > 70 then SECOND else BOARD end, n, 'Landed ' || n, 'r1',
         'ready_for_review', 'implement', 'f' || n, 'completed',
         now() - make_interval(mins => n), now() - make_interval(mins => n)
    from generate_series(1, 75) n;
  -- Open work: a card asking, one running, and one that failed.
  insert into cloud.events (owner_id, board_id, task_id, task_title, revision, kind, decision,
                            fingerprint, state, changed_at)
  values (OWNER, BOARD, 200, 'Asking', 'r1', 'question', 'answer', 'q', 'actionable', now()),
         (OWNER, BOARD, 201, 'Going', 'r1', 'ready_for_review', 'implement', 'g', 'running', now()),
         (OWNER, BOARD, 202, 'Broke', 'r1', 'ready_for_review', 'implement', 'b', 'failed', now() - interval '2 hours');
  select id into v_failed from cloud.events where board_id = BOARD and task_id = 202;
  -- An ending a later Implement took over, and history the open read never carries.
  insert into cloud.events (owner_id, board_id, task_id, task_title, revision, kind, decision,
                            fingerprint, state, changed_at)
  values (OWNER, BOARD, 203, 'Broke once', 'r1', 'ready_for_review', 'implement', 'o', 'failed', now() - interval '3 hours'),
         (OWNER, BOARD, 203, 'Broke once', 'r2', 'ready_for_review', 'implement', 'o2', 'completed', now() - interval '1 hour'),
         (OWNER, BOARD, 204, 'Gone', 'r1', 'ready_for_review', 'implement', 's', 'stale', now()),
         (OWNER, BOARD, 205, 'Stopped', 'r1', 'ready_for_review', 'implement', 'c', 'cancelled', now());
  select id into v_taken from cloud.events where board_id = BOARD and task_id = 203 and state = 'failed';
  insert into cloud.event_actions (event_id, owner_id, decision, revision, op_id)
  select id, OWNER, 'implement', revision, 'paged-' || id from cloud.events
   where board_id = BOARD and task_id in (202, 203);

  -- No filter is the newest 30, with a cursor to the rest.
  v_page := api.list_events(OWNER);
  assert json_array_length(v_page -> 'events') = 30,
    format('an unfiltered read handed back %s events', json_array_length(v_page -> 'events'));
  assert v_page ->> 'next' is not null, 'a read with more to come carried no cursor';
  assert json_array_length(api.list_events(OTHER) -> 'events') = 0, 'a page carried another account''s events';

  -- The landed tab walks the board's history a page at a time, missing nothing and repeating
  -- nothing, and never strays onto the second board.
  v_next := null;
  loop
    v_pages := v_pages + 1;
    v_page := api.list_events(OWNER, 'landed', BOARD, null,
                              split_part(v_next, '|', 1)::timestamptz, nullif(split_part(v_next, '|', 2), '')::uuid, 30);
    select v_seen || array_agg(e ->> 'taskId') into v_seen from json_array_elements(v_page -> 'events') e;
    v_next := v_page ->> 'next';
    exit when v_next is null or v_pages = 5;
  end loop;
  assert array_length(v_seen, 1) = 71, format('the landed pages held %s rows', array_length(v_seen, 1));
  assert (select count(distinct x) from unnest(v_seen) x) = 71, 'a landed row came back twice';
  assert '203' = any(v_seen) and not ('71' = any(v_seen)), 'the landed pages strayed off the board';
  assert v_pages = 3, format('71 landed rows took %s pages', v_pages);

  -- Open work, account-wide: what is not over, and the failure nobody has taken over.
  v_page := api.list_events(OWNER, 'open', null, null, null, null, 100);
  assert (select array_agg((e ->> 'taskId')::int order by (e ->> 'taskId')::int)
            from json_array_elements(v_page -> 'events') e) = array[200, 201, 202],
    format('the open read held %s', v_page -> 'events');
  assert v_page ->> 'next' is null, 'a read that fit on one page carried a cursor';
  -- A page too small for it still reaches all of it.
  v_page := api.list_events(OWNER, 'open', null, null, null, null, 2);
  assert json_array_length(v_page -> 'events') = 2 and v_page ->> 'next' is not null,
    'an open read larger than its page did not say there was more';

  -- One card's events, newest first.
  v_page := api.list_events(OWNER, null, BOARD, 203, null, null, 1);
  assert (v_page -> 'events' -> 0 ->> 'state') = 'completed', 'a card''s first page was not its newest event';
  assert v_page ->> 'next' is not null, 'a card''s older event was not one page away';

  raise notice 'sql checks: #1245 paged events checks passed';
end
$paged$;

-- ---------------------------------------------------------------------------
-- A started checkout waits to be asked about, a minute apart, for a day (#1251)
-- ---------------------------------------------------------------------------

do $pending$
declare
  BUDGET constant integer := 100000;
  BUYER constant uuid := '00000000-0000-4000-8000-000000001251';
  OTHER constant uuid := '00000000-0000-4000-8000-000000002251';
  v_writes bigint;
  v_ids json;
begin
  -- Nothing waiting: nothing handed out, nothing dropped, no budget spent.
  select coalesce(max(writes), 0) into v_writes from cloud.daily_writes where day = (now() at time zone 'utc')::date;
  assert json_array_length(api.claim_pending_checkouts(BUYER, false, BUDGET)) = 0, 'a user with no checkout was handed one';
  perform api.drop_pending_checkout('ch_none', BUYER, BUDGET);
  assert (select coalesce(max(writes), 0) from cloud.daily_writes where day = (now() at time zone 'utc')::date) = v_writes,
    'a claim or a drop that changed nothing spent the budget';

  perform api.record_pending_checkout('ch_1', BUYER, BUDGET);
  select writes into v_writes from cloud.daily_writes where day = (now() at time zone 'utc')::date;
  perform api.record_pending_checkout('ch_1', BUYER, BUDGET);
  assert (select count(*) from cloud.pending_checkouts where user_id = BUYER) = 1, 'a replay made a second row';
  assert (select writes from cloud.daily_writes where day = (now() at time zone 'utc')::date) = v_writes,
    'a replay that changed nothing spent the budget';

  -- Handed out once, then not again for a minute — unless forced.
  perform api.record_pending_checkout('ch_o', OTHER, BUDGET);
  assert api.claim_pending_checkouts(BUYER, false, BUDGET)::text = '["ch_1"]', 'a new checkout was not handed out';
  assert (select writes from cloud.daily_writes where day = (now() at time zone 'utc')::date) = v_writes + 2,
    'a claim that stamped a row was not counted once';
  assert json_array_length(api.claim_pending_checkouts(BUYER, false, BUDGET)) = 0, 'a checkout was handed out twice in a minute';
  assert api.claim_pending_checkouts(BUYER, true, BUDGET)::text = '["ch_1"]', 'a forced claim waited out the minute';
  update cloud.pending_checkouts set checked_at = now() - interval '61 seconds' where id = 'ch_1';
  assert api.claim_pending_checkouts(BUYER, false, BUDGET)::text = '["ch_1"]', 'a checkout was not handed out a minute later';
  assert (select checked_at is null from cloud.pending_checkouts where id = 'ch_o'), 'a claim stamped another user''s checkout';

  -- The newest five, and the rest on the next call.
  insert into cloud.pending_checkouts (id, user_id, created_at)
  select 'ch_m' || n, BUYER, now() - make_interval(mins => n) from generate_series(1, 6) n;
  update cloud.pending_checkouts set checked_at = null where user_id = BUYER;
  assert api.claim_pending_checkouts(BUYER, false, BUDGET)::text = '["ch_1","ch_m1","ch_m2","ch_m3","ch_m4"]',
    'a claim was not the newest five';
  assert api.claim_pending_checkouts(BUYER, false, BUDGET)::text = '["ch_m5","ch_m6"]', 'the rest did not follow';

  -- Only the owner drops one.
  perform api.drop_pending_checkout('ch_m6', OTHER, BUDGET);
  assert (select count(*) from cloud.pending_checkouts where id = 'ch_m6') = 1, 'another user dropped a checkout';
  perform api.drop_pending_checkout('ch_m6', BUYER, BUDGET);
  assert (select count(*) from cloud.pending_checkouts where id = 'ch_m6') = 0, 'a settled checkout was kept';

  -- Past its day: never handed out, and gone when its user next starts one.
  update cloud.pending_checkouts set created_at = now() - interval '25 hours', checked_at = null where id in ('ch_m5', 'ch_o');
  assert json_array_length(api.claim_pending_checkouts(BUYER, true, BUDGET)) = 5, 'a checkout past its day was handed out';
  perform api.record_pending_checkout('ch_2', BUYER, BUDGET);
  assert (select count(*) from cloud.pending_checkouts where id = 'ch_m5') = 0, 'a checkout past its day was kept';
  assert (select count(*) from cloud.pending_checkouts where id = 'ch_o') = 1, 'one user''s checkout cleared another''s';

  raise notice 'sql checks: #1251 pending checkout checks passed';
end
$pending$;

-- The shared template catalog (#1708): a taken name is refused unless replaced, search is
-- bounded and ranked by topic words, and tags are counted per category.
do $templates$
declare
  BUDGET constant integer := 100000;
  SRC constant jsonb := '{"original": true}';
  FILES constant jsonb := '[{"path": "template.md", "size": 1, "sha256": "x"}]';
  v_json json;
begin
  perform api.publish_template('neverchanje', 'hero-a', 'ui', array['hero', 'dark'], 'A', 'Dark hero.', 'Tilted screen.',
    SRC, 'free', FILES, '[]', '[]', 'r1', false, BUDGET);
  perform api.publish_template('neverchanje', 'hero-b', 'ui', array['hero'], 'B', 'Light hero.', 'Pricing table.',
    SRC, 'pro', FILES, '[]', '[]', 'r2', false, BUDGET);
  perform api.publish_template('neverchanje', 'intro-a', 'video', array['hero'], 'C', 'Intro.', 'Video.',
    SRC, 'free', FILES, '[]', '[]', 'r3', false, BUDGET);

  perform pg_temp.refuses(
    format('select api.publish_template(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, false, %s)',
      'neverchanje', 'hero-a', 'video', '{hero}', 'A2', 's', 'd', SRC, 'free', FILES, '[]', '[]', 'r4', BUDGET),
    'AKB19', 'publishing over a taken name');
  assert (select category from cloud.templates where name = 'hero-a') = 'ui', 'a refused publish changed the row';

  v_json := api.publish_template('neverchanje', 'hero-a', 'ui', array['hero', 'dark'], 'A2', 'Dark hero.', 'Tilted screen.',
    SRC, 'free', FILES, '[]', '[]', 'r5', true, BUDGET);
  assert v_json ->> 'replaced' = 'r1', 'a replacement did not name the revision it superseded';
  assert (select count(*) from cloud.templates where name = 'hero-a') = 1, 'a replacement made a second row';

  v_json := api.search_templates('ui', array['hero'], array['pricing'], 5);
  assert json_array_length(v_json) = 2, 'search left the category or missed a template';
  assert v_json -> 0 ->> 'name' = 'hero-b', 'a topic word did not rank its match first';
  assert v_json -> 0 -> 'hits' is null, 'search answered its ranking column';
  assert json_array_length(api.search_templates('ui', array['hero'], null, 1)) = 1, 'search ignored its limit';
  assert json_array_length(api.search_templates('ui', array['hero'], null, 50)) = 2, 'search lost rows over the cap';
  assert json_array_length(api.search_templates('ui', array['nothing'], null, 5)) = 0, 'search widened past its tags';

  v_json := api.template_tags('ui');
  assert v_json -> 0 ->> 'tag' = 'hero' and (v_json -> 0 ->> 'count')::int = 2, 'tags were not counted per category';

  assert api.delete_template('hero-b', BUDGET) ->> 'revision' = 'r2', 'a delete did not answer its revision';
  assert api.delete_template('hero-b', BUDGET) is null, 'deleting a missing template answered a revision';

  -- #1711: the public catalog lists every template, and a showcase survives a replacement.
  assert api.set_template_showcase('nothing', '{"id": "s0"}', BUDGET) is null, 'a showcase landed on no template';
  v_json := api.set_template_showcase('hero-a', '{"id": "s1", "files": []}', BUDGET);
  assert (v_json -> 'replaced')::jsonb = '{}'::jsonb, 'a first showcase did not answer the empty one';
  perform api.publish_template('neverchanje', 'hero-a', 'ui', array['hero'], 'A3', 'Dark hero.', 'Tilted screen.',
    SRC, 'free', FILES, '[]', '[]', 'r6', true, BUDGET);
  v_json := api.template_catalog();
  assert json_array_length(v_json) = 2, 'the catalog missed a template';
  assert (select count(*) from json_array_elements(v_json) e where e -> 'files' is not null or e -> 'source' is not null
    or e -> 'published_by' is not null) = 0, 'the catalog answered private columns';
  assert (select e -> 'showcase' ->> 'id' from json_array_elements(v_json) e where e ->> 'name' = 'hero-a') = 's1',
    'a replacement lost the showcase';

  raise notice 'sql checks: #1708 template catalog checks passed';
end
$templates$;

-- The public API (#2000): the account boundary, a task's review, decisions, immutable
-- versions, the event feed and API keys.
do $public_api$
declare
  BUDGET constant integer := 100000;
  A constant uuid := 'a0a0a0a0-1111-4111-8111-111111111111';
  B constant uuid := 'b0b0b0b0-2222-4222-8222-222222222222';
  ACTOR constant jsonb := '{"kind": "user", "handle": "api-a"}';
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "Two steps"}';
  v_prj text;
  v_task text;
  v_art1 text;
  v_json jsonb;
  v_seq bigint;
  v_key jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'api-a'), (B, 'api-b');
  insert into cloud.admitted_accounts (handle) values ('api-a'), ('api-b');

  v_prj := api.v1_create_project(A, '{"name": "Site", "path": "/work/site"}', BUDGET) ->> 'id';
  assert v_prj like 'prj\_%', 'a project id carried no prefix';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Landing', 'project', v_prj), WF, BUDGET) ->> 'id';
  v_json := api.v1_task(A, v_task) -> 'review';
  assert v_json ->> 'status' is null and v_json ->> 'phase' is null and (v_json ->> 'revision')::int = 0,
    'a new task had a review';

  -- Another account reads and writes nothing.
  perform pg_temp.refuses(format('select api.v1_task(%L, %L)', B, v_task), 'AKB20', 'B read A''s task');
  perform pg_temp.refuses(format('select api.v1_update_project(%L, %L, %L, %s)', B, v_prj, '{"name": "x"}', BUDGET),
    'AKB20', 'B renamed A''s project');
  perform pg_temp.refuses(format('select api.v1_create_artifact(%L, %L, %L, %s)', B, v_task, '{"type": "web-page"}', BUDGET),
    'AKB20', 'B added to A''s task');
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', B,
    jsonb_build_object('title', 't', 'project', v_prj), WF, BUDGET), 'AKB20', 'B filed a task under A''s project');
  assert jsonb_array_length(api.v1_list_tasks(B, null, null, null, null, 20) -> 'data') = 0, 'B listed A''s tasks';

  -- Nothing is decided before a draft is submitted.
  v_art1 := api.v1_create_artifact(A, v_task, '{"type": "web-page"}', BUDGET) ->> 'id';
  assert (select phase from cloud.artifacts where id = v_art1) = 1, 'an artifact missed the card''s phase';
  perform api.v1_create_artifact_version(A, v_art1, '{"html": "a0"}', null, BUDGET);
  assert (select review_status from cloud.tasks where id = v_task) is null, 'a version submitted a task for review';
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', A, v_task, '{"decision": "approve"}', ACTOR, BUDGET),
    'AKB21', 'a decision was taken with nothing submitted');
  perform pg_temp.refuses(format('select api.v1_update_review(%L, %L, %L, %s)', A, v_task, '{"question": "Ok?"}', BUDGET),
    'AKB21', 'a question was put with nothing submitted');

  -- The latest decision sets the review's status.
  perform cloud.v1_submit_draft(v_task);
  assert (select review_status || '/' || review_phase from cloud.tasks where id = v_task) = 'ready/1', 'a submitted task was not ready';
  perform pg_temp.refuses(format('select api.v1_update_task(%L, %L, %L, %s)', A, v_task, '{"status": "done"}', BUDGET),
    'AKB21', 'a task was done with its review open');
  v_json := api.v1_create_decision(A, v_task, '{"decision": "request_changes", "comment": "Bigger"}', ACTOR, BUDGET);
  assert v_json ->> 'task' = v_task and (v_json ->> 'phase')::int = 1, 'a decision missed its task or phase';
  assert (select review_status from cloud.tasks where id = v_task) = 'changes_requested', 'request_changes did not stick';
  v_json := api.v1_create_artifact_version(A, v_art1, '{"html": "a1"}', null, BUDGET);
  assert (v_json ->> 'version')::int = 2, 'a second version was not 2';
  assert (select review_status from cloud.tasks where id = v_task) = 'ready', 'a new version did not return to ready';
  v_json := api.v1_create_decision(A, v_task, '{"decision": "approve"}', ACTOR, BUDGET);
  assert (v_json ->> 'artifact_version')::int = 2, 'a decision did not default to the latest version';
  assert (select review_status from cloud.tasks where id = v_task) = 'approved', 'approve did not stick';
  perform api.v1_create_artifact_version(A, v_art1, '{"html": "a3"}', null, BUDGET);
  assert (select review_status || '/' || review_revision from cloud.tasks where id = v_task) = 'approved/2',
    'a version after approval reopened the review';
  perform pg_temp.refuses(format('select api.v1_update_review(%L, %L, %L, %s)', A, v_task, '{"question": "Ok?"}', BUDGET),
    'AKB21', 'an approved review was asked again');
  assert jsonb_array_length(api.v1_list_decisions(A, v_task, null, 20) -> 'data') = 2, 'the task''s decisions were not listed';
  perform pg_temp.refuses(format('select api.v1_list_decisions(%L, %L, null, 20)', B, v_task), 'AKB20', 'B listed A''s decisions');
  assert api.v1_update_task(A, v_task, '{"status": "done"}', BUDGET) ->> 'status' = 'done', 'an approved task could not be done';
  perform pg_temp.refuses(format('select api.v1_cancel_task(%L, %L, %s)', A, v_task, BUDGET), 'AKB21', 'a finished task was cancelled');

  -- A version and a decision are never rewritten.
  perform pg_temp.refuses(format('update cloud.artifact_versions set content = %L where artifact_id = %L', '{}', v_art1),
    'AKB21', 'an artifact version was rewritten');
  perform pg_temp.refuses(format('update cloud.decisions set comment = %L where task_id = %L', 'x', v_task),
    'AKB21', 'a decision was rewritten');

  -- Deleting a project deletes its tasks.
  perform api.v1_delete_project(A, v_prj, BUDGET);
  assert not exists (select 1 from cloud.tasks where id = v_task), 'a deleted project left its task';
  assert exists (select 1 from cloud.api_events where type = 'task.deleted' and data ->> 'id' = v_task), 'a task went with no event';

  -- Every write is an event, in order.
  assert (select count(*) from cloud.api_events where workspace_id = cloud.v1_personal(A) and type = 'review.ready') = 2,
    'a review becoming ready wrote no event';
  assert exists (select 1 from cloud.api_events where workspace_id = cloud.v1_personal(A) and type = 'project.deleted'),
    'a project went with no event';
  assert (select bool_and(seq > lag) from (
    select seq, lag(seq, 1, 0::bigint) over (order by seq) lag from cloud.api_events where workspace_id = cloud.v1_personal(A)) x),
    'events were not in order';
  select max(seq) into v_seq from cloud.api_events where workspace_id = cloud.v1_personal(A);
  v_json := api.v1_list_events(A, v_seq - 3, 2);
  assert jsonb_array_length(v_json -> 'data') = 2 and v_json ->> 'next' = 'evt_' || (v_seq - 1), 'events did not page';
  assert jsonb_array_length(api.v1_list_events(B, 0, 100) -> 'data') = 0, 'B read A''s events';

  -- A revoked key stops at once.
  v_key := api.v1_create_api_key(A, 'CI', 'wck_abcd', 'hash-1', BUDGET);
  assert api.v1_account_for_key('hash-1') ->> 'account_id' = A::text, 'a live key did not resolve';
  perform pg_temp.refuses(format('select api.v1_revoke_api_key(%L, %L, %s)', B, v_key ->> 'id', BUDGET), 'AKB20', 'B revoked A''s key');
  perform api.v1_revoke_api_key(A, v_key ->> 'id', BUDGET);
  assert api.v1_account_for_key('hash-1') is null, 'a revoked key still resolved';

  -- A replayed key answers once; a claim in flight is not taken.
  assert (api.v1_claim_idempotency(A, 'k1', 'h') ->> 'claimed')::boolean, 'a first claim failed';
  assert not (api.v1_claim_idempotency(A, 'k1', 'h') ->> 'claimed')::boolean, 'a claim in flight was taken';
  perform api.v1_finish_idempotency(A, 'k1', 200, '{"ok": true}');
  assert api.v1_claim_idempotency(A, 'k1', 'h') -> 'response' = '{"ok": true}', 'a finished claim did not replay';

  raise notice 'sql checks: #2000 public API checks passed';
end
$public_api$;

-- #2001: the account's one Runner, and a job that runs exactly once.
do $runners$
declare
  A constant uuid := 'aaaaaaaa-2001-4001-8001-000000000001';
  B constant uuid := 'bbbbbbbb-2001-4001-8001-000000000002';
  HOME constant uuid := 'cccccccc-2001-4001-8001-000000000003';
  LAPTOP constant uuid := 'dddddddd-2001-4001-8001-000000000004';
  BUDGET constant integer := 100000;
  v_json json;
  v_job uuid;
  v_other uuid;
begin
  insert into cloud.accounts (id, handle) values (A, 'runner-a'), (B, 'runner-b');

  v_json := api.register_runner(A, HOME, 'home-mac', 1, '0.1.0', '[{"name":"codex","installed":true}]', false, 900, BUDGET);
  assert (v_json ->> 'connected')::boolean, 'a registered Runner did not read as connected';
  perform api.register_runner(A, HOME, 'home-mac', 1, '0.1.0', '[]', false, 900, BUDGET);

  -- A second computer is refused while the first is connected, and told which one it is.
  begin
    perform api.register_runner(A, LAPTOP, 'laptop', 1, '0.1.0', '[]', false, 900, BUDGET);
    raise exception 'a second computer registered while the first was connected';
  exception when sqlstate 'AKB22' then
    assert sqlerrm like '%home-mac%', 'the refusal did not name the connected computer';
  end;

  v_job := (api.dispatch_runner_job(A, 'codex', null, 'Build it', '[]', BUDGET) ->> 'id')::uuid;
  perform cloud.hint_runner(A, v_job);
  assert pg_temp.receives(A, 'runner:' || A::text) > 0, 'a Runner cannot receive on its own topic';
  assert pg_temp.receives(B, 'runner:' || A::text) = 0, 'a Runner topic was joined by another account';

  perform pg_temp.refuses(format('select api.read_runner_job(%L, %L)', B, v_job), 'AKB02', 'read_runner_job');
  assert json_array_length(api.list_runner_jobs(A, LAPTOP)) = 0, 'a computer that is not the Runner saw jobs';
  assert json_array_length(api.list_runner_jobs(A, HOME)) = 1, 'the Runner did not see its waiting job';
  assert not (api.claim_runner_job(A, LAPTOP, v_job, 900, BUDGET) ->> 'claimed')::boolean,
    'a computer that is not the Runner claimed a job';

  -- One claim per job: a second claim, even by the same Runner, is refused.
  assert (api.claim_runner_job(A, HOME, v_job, 900, BUDGET) ->> 'claimed')::boolean, 'the Runner could not claim';
  assert not (api.claim_runner_job(A, HOME, v_job, 900, BUDGET) ->> 'claimed')::boolean, 'a job was claimed twice';

  -- The log stream (#2085) is the holder's alone.
  assert api.runner_job_held(A, HOME, v_job), 'the holder did not hold its job';
  assert not api.runner_job_held(A, LAPTOP, v_job), 'another computer held the job';
  perform pg_temp.refuses(format('select api.runner_job_held(%L, %L, %L)', B, HOME, v_job), 'AKB02', 'runner_job_held');
  assert (api.renew_runner_job(A, HOME, v_job, 900, BUDGET) ->> 'renewed')::boolean, 'the holder could not renew';

  v_json := api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET,
    '{"reply":"Built.","usage":{"input":1,"cacheCreation":2,"cacheRead":3,"output":4},"costUsd":0.5}');
  assert v_json -> 'job' ->> 'outcome' = 'done', 'the job did not finish done';
  v_json := api.read_runner_job(A, v_job) -> 'job';
  assert v_json ->> 'reply' = 'Built.' and (v_json -> 'usage' ->> 'cacheRead')::int = 3
    and (v_json ->> 'costUsd')::numeric = 0.5, 'a finished job did not read back what it said and spent';
  assert not (api.finish_runner_job(A, HOME, v_job, 'failed', 'x', BUDGET) ->> 'finished')::boolean,
    'a finished job was finished again';
  assert not api.runner_job_held(A, HOME, v_job), 'a finished job was still held';
  -- A finished job past the keep is named for its log to leave R2.
  assert not api.v1_expired(A, 7, 100) -> 'jobs' ? v_job::text, 'a fresh job was named as expired';
  update cloud.runner_jobs set finished_at = now() - interval '8 days' where id = v_job;
  assert api.v1_expired(A, 7, 100) -> 'jobs' ? v_job::text, 'an expired job was not named';
  update cloud.runner_jobs set finished_at = now() where id = v_job;

  -- A lapsed lease is an interrupted job: never renewed, never listed, never claimed again.
  v_other := (api.dispatch_runner_job(A, 'claude-code', null, 'Go', '[]', BUDGET) ->> 'id')::uuid;
  perform api.claim_runner_job(A, HOME, v_other, 900, BUDGET);
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 second' where id = v_other;
  assert api.read_runner_job(A, v_other) -> 'job' ->> 'state' = 'interrupted', 'a lapsed lease did not read interrupted';
  assert not (api.renew_runner_job(A, HOME, v_other, 900, BUDGET) ->> 'renewed')::boolean, 'a lapsed lease was renewed';
  assert not (api.claim_runner_job(A, HOME, v_other, 900, BUDGET) ->> 'claimed')::boolean, 'an interrupted job was claimed';
  assert json_array_length(api.list_runner_jobs(A, HOME)) = 0, 'an interrupted job was listed';

  -- A released Runner frees the account for another computer at once.
  assert (api.release_runner(A, HOME, BUDGET) ->> 'released')::boolean, 'the Runner could not release';
  v_json := api.register_runner(A, LAPTOP, 'laptop', 1, '0.1.0', '[]', false, 900, BUDGET);
  assert v_json ->> 'machineName' = 'laptop', 'another computer could not take over a released Runner';
  -- The old computer's presence ending late leaves the new one online (#2163).
  assert not (api.release_runner(A, HOME, BUDGET) ->> 'released')::boolean, 'a replaced computer released the Runner';
  assert (select live_until > now() from cloud.runners where owner_id = A), 'a replaced computer ended the new one''s lease';

  -- The release: the stable version, and a candidate for a share of machines.
  assert api.runner_version(HOME) ->> 'version' is null, 'a version came back before any was set';
  perform cloud.set_runner_release('1.0.0', '1.1.0', 0);
  assert api.runner_version(HOME) ->> 'version' = '1.0.0', 'a 0% candidate reached a machine';
  perform cloud.set_runner_release('1.0.0', '1.1.0', 100);
  assert api.runner_version(HOME) ->> 'version' = '1.1.0', 'a 100% candidate missed a machine';

  raise notice 'sql checks: #2001 runner checks passed';
end
$runners$;

-- #2005: a project's folder on one computer, and an alert raised once.
do $desktop$
declare
  A constant uuid := 'aaaaaaaa-2005-4005-8005-000000000001';
  B constant uuid := 'bbbbbbbb-2005-4005-8005-000000000002';
  HOME constant uuid := 'cccccccc-2005-4005-8005-000000000003';
  LAPTOP constant uuid := 'dddddddd-2005-4005-8005-000000000004';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  v_json json;
  v_site text;
  v_quiet text;
  v_task text;
  v_loose text;
  v_job json;
  v_alert text;
begin
  insert into cloud.accounts (id, handle) values (A, 'desktop-a'), (B, 'desktop-b');
  perform api.register_runner(A, HOME, 'home-mac', 1, '0.2.0', '[]', true, 900, BUDGET);

  -- A folder becomes a project on this computer; the same folder again is the same project.
  v_site := api.add_project_folder(A, HOME, 'site', '/Users/a/site', BUDGET) ->> 'project';
  assert v_site like 'prj\_%', 'adding a folder made no project';
  assert api.add_project_folder(A, HOME, 'site', '/Users/a/site', BUDGET) ->> 'project' = v_site,
    'the same folder made a second project';
  v_quiet := api.add_project_folder(A, HOME, 'quiet', '/Users/a/quiet', BUDGET) ->> 'project';
  assert json_array_length(api.list_project_folders(A, HOME)) = 2, 'this computer did not list its projects';
  assert json_array_length(api.list_project_folders(A, LAPTOP)) = 0, 'another computer listed this one''s projects';
  perform pg_temp.refuses(format('select api.add_project_folder(%L, %L, %L, %L, %s)', A, LAPTOP, 'x', '/x', BUDGET),
    'AKB21', 'a computer that is not the Runner added a folder');

  -- A project's job goes to its folder on its computer, and nowhere else.
  v_job := api.dispatch_runner_job(A, 'codex', v_site, 'Build it', '[]', BUDGET);
  assert v_job ->> 'projectDir' = '/Users/a/site', 'a project''s job did not carry its folder';
  assert json_array_length(api.list_runner_jobs(A, HOME)) = 1, 'the folder''s computer did not see its job';
  perform api.release_runner(A, HOME, BUDGET);
  perform api.register_runner(A, LAPTOP, 'laptop', 1, '0.2.0', '[]', false, 900, BUDGET);
  assert json_array_length(api.list_runner_jobs(A, LAPTOP)) = 0, 'another computer saw a project''s job';
  assert not (api.claim_runner_job(A, LAPTOP, (v_job ->> 'id')::uuid, 900, BUDGET) ->> 'claimed')::boolean,
    'another computer claimed a project''s job';
  assert api.dispatch_runner_job(A, 'codex', null, 'Go', '[]', BUDGET) ->> 'projectDir' is null,
    'a job with no project named a folder';
  perform pg_temp.refuses(format('select api.dispatch_runner_job(%L, %L, %L, %L, %L, %s)', B, 'codex', v_site, 'x', '[]', BUDGET),
    'AKB20', 'a job was sent to another account''s project');
  perform api.release_runner(A, LAPTOP, BUDGET);
  perform api.register_runner(A, HOME, 'home-mac', 1, '0.2.0', '[]', true, 900, BUDGET);

  -- A review ready raises one alert, on the desktop that shows notifications.
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing page', 'project', v_site), WF, BUDGET) ->> 'id';
  perform pg_temp.stages(v_task, 2);
  update cloud.tasks set status = 'running', card_metadata = card_metadata || '{"phase": 2}' where id = v_task;
  assert json_array_length(api.runner_inbox(A) -> 'running') = 1, 'a running task was not in the inbox';
  assert (api.runner_inbox(A) -> 'running' -> 0 ->> 'phase')::int = 2, 'a running task did not name its stage';
  perform pg_temp.review(v_task, 'ready', 2);
  select id into v_alert from cloud.alerts where task_id = v_task and kind = 'review';
  assert (select count(*) from cloud.alerts where task_id = v_task) = 1, 'a ready review raised more than one alert';
  assert (select phase from cloud.alerts where id = v_alert) = 2, 'the alert missed its phase';
  assert (api.runner_inbox(A) -> 'review' -> 0 ->> 'phase')::int = 2, 'the inbox did not name the round';
  assert (select channel from cloud.alerts where id = v_alert) = 'desktop', 'a desktop that notifies was passed over';
  assert pg_temp.receives(A, 'runner:' || A::text) > 0, 'the desktop was not hinted';
  assert json_array_length(api.list_desktop_alerts(A, HOME)) = 1, 'the desktop did not see its alert';
  assert api.runner_inbox(A) -> 'review' -> 0 ->> 'alert' = v_alert, 'the inbox did not mark the review unread';
  assert (api.show_desktop_alert(A, HOME, v_alert, BUDGET) ->> 'shown')::boolean, 'the desktop could not mark it shown';
  assert json_array_length(api.list_desktop_alerts(A, HOME)) = 0, 'a shown alert was shown again';
  assert jsonb_array_length(api.v1_list_alerts(A, null, null, 20) -> 'data') = 1, 'the web did not list the unread alert';

  -- Deciding it reads it everywhere.
  perform pg_temp.review(v_task, 'approved', 2);
  assert (select read_at from cloud.alerts where id = v_alert) is not null, 'a decided review stayed unread';
  assert json_array_length(api.runner_inbox(A) -> 'review') = 0, 'a decided review stayed in the inbox';

  -- A project whose bell is off here, or a Runner that shows nothing, alerts on the web.
  perform api.set_project_folder_notify(A, HOME, v_quiet, false, BUDGET);
  v_loose := api.v1_create_task(A, jsonb_build_object('title', 'Quiet one', 'project', v_quiet), WF, BUDGET) ->> 'id';
  update cloud.tasks set status = 'failed' where id = v_loose;
  assert (select channel from cloud.alerts where task_id = v_loose) = 'web', 'a muted project notified the desktop';
  v_alert := api.v1_list_alerts(A, 'web', null, 20) -> 'data' -> 0 ->> 'id';
  assert api.v1_read_alert(A, v_alert, BUDGET) ->> 'read' = 'true', 'reading an alert did not stick';
  perform pg_temp.refuses(format('select api.v1_read_alert(%L, %L, %s)', B, v_alert, BUDGET), 'AKB20', 'v1_read_alert');
  perform api.register_runner(A, HOME, 'home-mac', 1, '0.2.0', '[]', false, 900, BUDGET);
  update cloud.tasks set status = 'done' where id = v_task;
  assert (select channel from cloud.alerts where task_id = v_task and kind = 'done') = 'web',
    'a Runner that shows no notifications was sent one';

  -- Taking a project off this computer leaves the project.
  assert (api.remove_project_folder(A, HOME, v_site, BUDGET) ->> 'removed')::boolean, 'a folder could not be removed';
  assert exists (select 1 from cloud.projects where id = v_site), 'removing a folder deleted its project';
  assert json_array_length(api.list_project_folders(A, HOME)) = 1, 'a removed folder was still listed';

  raise notice 'sql checks: #2005 desktop checks passed';
end
$desktop$;


-- Plans (#2017): tasks at once, storage, expiry, storage packs; Studio is gone (#2118).
do $plans$
declare
  BUDGET constant integer := 100000;
  A constant uuid := 'a0a0a0a0-5555-4555-8555-555555555555';
  B constant uuid := 'b0b0b0b0-6666-4666-8666-666666666666';
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  v_t1 text;
  v_t2 text;
  v_art text;
  v_up text;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'plan-a'), (B, 'plan-b');
  insert into cloud.admitted_accounts (handle) values ('plan-a'), ('plan-b');

  -- Tasks at once: open ones count, finished ones free a place, another account's never.
  v_t1 := api.v1_create_task(A, '{"title": "One", "run": true}', WF, BUDGET, 2) ->> 'id';
  v_t2 := api.v1_create_task(A, '{"title": "Two", "run": true}', WF, BUDGET, 2) ->> 'id';
  perform api.v1_create_task(B, '{"title": "Theirs", "run": true}', WF, BUDGET, 2);
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s, 2)', A, '{"title": "Three", "run": true}', WF, BUDGET),
    'AKB23', 'a third task past a limit of two');
  -- #2063: a task that does not run is made at a full quota and takes no place in it.
  assert api.v1_create_task(A, '{"title": "Follow-up"}', WF, BUDGET, 2) ->> 'status' = 'queued', 'a follow-up was refused at a full quota';
  assert (api.v1_usage(A) ->> 'tasks')::integer = 2, 'open tasks were miscounted';
  perform api.v1_cancel_task(A, v_t2, BUDGET);
  perform api.v1_create_task(A, '{"title": "Three", "run": true}', WF, BUDGET, 2);
  assert api.v1_create_task(A, '{"title": "Unlimited", "run": true}', WF, BUDGET) ->> 'id' is not null, 'no limit refused a task';

  -- Storage: version files and unused uploads count, and the limit holds at both ends.
  v_art := api.v1_create_artifact(A, v_t1, '{"type": "web-page"}', BUDGET) ->> 'id';
  v_up := api.v1_create_upload(A, v_art, 'image/png', BUDGET, null, null, 1000) ->> 'id';
  perform api.v1_finish_upload(A, v_up, 600, BUDGET, 1000);
  perform api.v1_create_artifact_version(A, v_art, null, v_up, BUDGET);
  assert (api.v1_usage(A) ->> 'storage')::bigint = 600, 'a version file was not counted';
  perform pg_temp.refuses(format('select api.v1_create_upload(%L, %L, %L, %s, 500, null, 1000)', A, v_art, 'image/png', BUDGET),
    'AKB23', 'a declared upload past the storage left');
  v_up := api.v1_create_upload(A, v_art, 'image/png', BUDGET, null, null, 1000) ->> 'id';
  assert (api.v1_upload_target(A, v_up, 1000) ->> 'room')::bigint = 400, 'the room left was wrong';
  perform pg_temp.refuses(format('select api.v1_finish_upload(%L, %L, 401, %s, 1000)', A, v_up, BUDGET),
    'AKB23', 'a finished upload past the storage left');
  v_up := api.v1_create_upload(A, v_art, 'video/mp4', BUDGET, 300, 'mp_1', 1000, 'upl_mp1') ->> 'id';
  assert (api.v1_usage(A) ->> 'storage')::bigint = 900, 'a multipart upload did not hold its declared size';
  perform api.v1_add_upload_part(A, v_up, 2, 'e2', BUDGET);
  perform api.v1_add_upload_part(A, v_up, 1, 'e1', BUDGET);
  perform api.v1_add_upload_part(A, v_up, 1, 'e1b', BUDGET);
  assert api.v1_upload_target(A, v_up) -> 'parts' = '[{"part": 1, "etag": "e1b"}, {"part": 2, "etag": "e2"}]',
    'parts were not kept one per number, in order';

  -- Expiry: a finished task past its keep goes with its files and events; an open one stays.
  perform api.v1_update_task(A, v_t1, '{"status": "failed"}', BUDGET);
  update cloud.tasks set updated_at = now() - interval '8 days' where id in (v_t1, v_t2);
  assert api.v1_expiring_accounts(7, 50) ? A::text, 'an account with an expired task was not found';
  v_json := api.v1_expired(A, 30, 100);
  assert jsonb_array_length(v_json -> 'tasks') = 0, 'a 30-day keep expired an 8-day-old task';
  v_json := api.v1_expired(A, 7, 100);
  assert v_json -> 'tasks' ? v_t1 and v_json -> 'tasks' ? v_t2, 'expired tasks were not named';
  assert jsonb_array_length(v_json -> 'files') = 1, 'the version file was not named';
  assert v_json -> 'multipart' -> 0 ->> 'id' = 'mp_1', 'an open multipart upload was not named';
  v_json := api.v1_delete_expired(A, 7, array[v_t1, v_t2]);
  assert (v_json ->> 'tasks')::integer = 2, 'expired tasks were not deleted';
  assert not exists (select 1 from cloud.api_events where workspace_id = cloud.v1_personal(A) and (data ->> 'id' = v_t1 or data ->> 'task' = v_t1)),
    'events naming an expired task were kept';
  assert (api.v1_usage(A) ->> 'storage')::bigint = 0, 'expired files still counted';
  assert (api.v1_usage(A) ->> 'tasks')::integer = 2, 'expiry touched open tasks';

  -- Abandoned uploads are named for R2, then dropped.
  update cloud.artifact_uploads set expires_at = now() - interval '2 days' where account_id = B;
  v_t1 := api.v1_create_task(A, '{"title": "Four"}', WF, BUDGET) ->> 'id';
  v_art := api.v1_create_artifact(A, v_t1, '{"type": "web-page"}', BUDGET) ->> 'id';
  insert into cloud.artifact_uploads (id, account_id, artifact_id, object_key, content_type, expires_at)
  values ('upl_old', A, v_art, 'k', 'image/png', now() - interval '2 days');
  assert api.v1_abandoned_uploads(500) @> '[{"id": "upl_old"}]', 'an abandoned upload was not named';
  assert api.v1_drop_uploads(array['upl_old']) = 1, 'an abandoned upload was not dropped';

  -- A storage pack is its own row, never a second Pro.
  perform api.record_subscription('sub_pack', A, 'cust_a', 'monthly', 'active', now() + interval '1 month', BUDGET, 'storage');
  assert api.subscriptions_for(A) -> 0 ->> 'item' = 'storage', 'a storage pack read back as Pro';
  assert api.storage_pack_holders()::jsonb = jsonb_build_array(A), 'a renewing pack''s holder was not named (#2033)';
  perform api.record_subscription('sub_pack', A, 'cust_a', 'monthly', 'canceled', now(), BUDGET, 'storage');
  assert api.storage_pack_holders()::jsonb = '[]', 'a canceled pack''s holder was named (#2033)';
  perform pg_temp.refuses(format('select api.record_subscription(%L, %L, %L, %L, %L, null, %s, %L)',
    'sub_bad', A, 'c', 'monthly', 'active', BUDGET, 'studio'), '23514', 'Studio recorded as an item');

  assert to_regclass('cloud.studio_waitlist') is null, 'the Studio waitlist is still there (#2118)';
  assert to_regprocedure('api.join_studio_waitlist(text, uuid, integer)') is null, 'the Studio waitlist still takes addresses (#2118)';

  raise notice 'sql checks: #2017 plan checks passed';
end
$plans$;

-- Short task keys (#2034): numbered per project, `TASK` for the rest (#2114), old keys still answer.
do $task_keys$
declare
  BUDGET constant integer := 100000;
  A constant uuid := 'a3a3a3a3-1111-4111-8111-111111111111';
  B constant uuid := 'b3b3b3b3-2222-4222-8222-222222222222';
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  v_wc jsonb;
  v_other text;
  v_t1 jsonb;
  v_t2 jsonb;
  v_loose jsonb;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'keys-a'), (B, 'keys-b');

  v_wc := api.v1_create_project(A, '{"name": "WildCrane"}', BUDGET);
  assert v_wc ->> 'prefix' = 'WC' and not (v_wc ->> 'general')::boolean, 'a project took no prefix from its name';
  assert api.v1_create_project(A, '{"name": "wild crane"}', BUDGET) ->> 'prefix' = 'WC2', 'a taken prefix was given twice';
  assert api.v1_create_project(A, '{"name": "官网"}', BUDGET) ->> 'prefix' = 'P', 'a name with no initials took no prefix';
  v_other := api.v1_create_project(A, '{"name": "Docs", "prefix": "DOC"}', BUDGET) ->> 'id';
  assert api.v1_create_project(B, '{"name": "Wild Crane"}', BUDGET) ->> 'prefix' = 'WC', 'another account''s prefix was taken';
  perform pg_temp.refuses(format('select api.v1_create_project(%L, %L, %s)', A, '{"name": "x", "prefix": "WC"}', BUDGET),
    'AKB21', 'two projects shared a prefix');
  perform pg_temp.refuses(format('select api.v1_create_project(%L, %L, %s)', A, '{"name": "x", "prefix": "TASK"}', BUDGET),
    'AKB21', 'a project took the prefix of tasks with no project');
  assert api.v1_create_project(A, '{"name": "Take A Small Kit"}', BUDGET) ->> 'prefix' = 'TASK2', 'a name''s initials took TASK';

  -- Numbered in order per project; a task filed without one lands in the project for none.
  v_t1 := api.v1_create_task(A, jsonb_build_object('title', 'One', 'project', v_wc ->> 'id'), WF, BUDGET);
  v_t2 := api.v1_create_task(A, jsonb_build_object('title', 'Two', 'project', v_wc ->> 'id'), WF, BUDGET);
  assert v_t1 ->> 'key' = 'WC-1' and v_t2 ->> 'key' = 'WC-2', 'tasks were not numbered in order';
  v_loose := api.v1_create_task(A, '{"title": "Loose"}', WF, BUDGET);
  assert v_loose ->> 'key' = 'TASK-1', 'a task with no project was not TASK-1';
  assert (select count(*) from cloud.projects where account_id = A and general and name = 'general') = 1,
    'the project for tasks with none was not made once';
  assert api.v1_create_task(A, '{"title": "Loose too"}', WF, BUDGET) ->> 'key' = 'TASK-2', 'a second task with no project was not 2';
  assert (select count(*) from cloud.projects where account_id = A and general) = 1, 'a second project for none was made';
  assert api.v1_task_id(A, 'WC', 2) = v_t2 ->> 'id', 'a key did not name its task';
  perform pg_temp.refuses(format('select api.v1_task_id(%L, %L, 2)', B, 'WC'), 'AKB20', 'B read A''s task by key');

  -- A move takes the new project's next number; the old key still answers.
  v_json := api.v1_update_task(A, v_t1 ->> 'id', jsonb_build_object('project', v_other), BUDGET);
  assert v_json ->> 'key' = 'DOC-1' and v_json ->> 'project' = v_other, 'a moved task was not renumbered';
  assert api.v1_task_id(A, 'WC', 1) = v_t1 ->> 'id', 'a moved task''s old key stopped answering';
  assert api.v1_task(A, api.v1_task_id(A, 'WC', 1)) ->> 'key' = 'DOC-1', 'an old key did not read the current one';
  assert api.v1_create_task(A, jsonb_build_object('title', 'Three', 'project', v_wc ->> 'id'), WF, BUDGET) ->> 'key' = 'WC-3',
    'a moved task''s number was given again';
  perform pg_temp.refuses(format('select api.v1_update_task(%L, %L, %L, %s)', B, v_t2 ->> 'id', jsonb_build_object('project', v_other), BUDGET),
    'AKB20', 'B moved A''s task');

  -- A new prefix moves every key; the old ones keep answering.
  assert api.v1_update_project(A, v_wc ->> 'id', '{"prefix": "CRANE"}', BUDGET) ->> 'prefix' = 'CRANE', 'a prefix did not change';
  assert api.v1_task(A, v_t2 ->> 'id') ->> 'key' = 'CRANE-2', 'a renamed prefix left the key';
  assert api.v1_task_id(A, 'WC', 2) = v_t2 ->> 'id', 'an old prefix stopped answering';
  perform pg_temp.refuses(format('select api.v1_update_project(%L, %L, %L, %s)', A, v_other, '{"prefix": "CRANE"}', BUDGET),
    'AKB21', 'a prefix was taken twice by a rename');

  -- A current key wins over an alias.
  perform api.v1_update_project(A, v_other, '{"prefix": "WC"}', BUDGET);
  assert api.v1_task_id(A, 'WC', 1) = v_t1 ->> 'id', 'a current key lost to an alias';
  assert api.v1_task_id(A, 'WC', 2) = v_t2 ->> 'id', 'an alias stopped answering under a reused prefix';

  -- Deleting a project deletes its tasks; the project for none is never deleted.
  assert api.v1_project(A, v_wc ->> 'id') -> 'counts' = '{"tasks": 2, "others_tasks": 0, "others": 0,
    "scheduled_agents": 0, "folders": 0}', 'a project''s counts misread';
  perform api.v1_delete_project(A, v_wc ->> 'id', BUDGET);
  assert not exists (select 1 from cloud.tasks where id = v_t2 ->> 'id'), 'a deleted project left its task';
  assert exists (select 1 from cloud.tasks where id = v_t1 ->> 'id'), 'a deleted project took a task it no longer had';
  perform pg_temp.refuses(format('select api.v1_delete_project(%L, %L, %s)', A, v_loose ->> 'project', BUDGET),
    'AKB21', 'the project for tasks with none was deleted');

  -- Closing an account takes its projects, tasks and aliases together.
  delete from cloud.accounts where id = A;
  assert not exists (select 1 from cloud.task_aliases where account_id = A), 'a closed account left its aliases';

  raise notice 'sql checks: #2034 task key checks passed';
end
$task_keys$;



-- Card review over share links (#2019): one card per task (#2036), review revisions,
-- comments and what a link reaches.
do $share_links$
declare
  BUDGET constant integer := 100000;
  A constant uuid := 'a0a0a0a0-7777-4777-8777-777777777777';
  B constant uuid := 'b0b0b0b0-8888-4888-8888-888888888888';
  R constant uuid := 'c0c0c0c0-9999-4999-8999-999999999999';
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "Review"}';
  OPTIONS constant jsonb := '[{"label": "Go ahead", "approve": true}, {"label": "Simplify it"}]';
  v_task text;
  v_other text;
  v_art text;
  v_foreign text;
  v_link jsonb;
  v_json jsonb;
  v_seq bigint;
begin
  insert into cloud.accounts (id, handle) values (A, 'share-a'), (B, 'share-b');
  insert into cloud.admitted_accounts (handle) values ('share-a'), ('share-b');

  v_task := api.v1_create_task(A, '{"title": "Pricing"}', WF, BUDGET) ->> 'id';
  v_other := api.v1_create_task(A, '{"title": "Other"}', WF, BUDGET) ->> 'id';
  v_art := api.v1_create_artifact(A, v_task, '{"type": "html"}', BUDGET) ->> 'id';
  v_foreign := api.v1_create_artifact(A, v_other, '{"type": "html"}', BUDGET) ->> 'id';
  perform api.v1_create_artifact_version(A, v_foreign, '{"html": "elsewhere"}', null, BUDGET);

  -- The card: saved over in place, written against the revision before, never past a foreign artifact.
  assert api.v1_task(A, v_task) -> 'card_version' = 'null', 'a task with no card named a version';
  perform pg_temp.refuses(format('select pg_temp.card(%L, %L)', A, v_task), 'AKB20', 'a task with no card read one');
  perform pg_temp.refuses(format('select pg_temp.save_card(%L, %L, %L, 1, %s)', A, v_task, '{"body": "x"}', BUDGET),
    'AKB27', 'a first card written against version 1');
  perform pg_temp.refuses(format('select pg_temp.save_card(%L, %L, %L, 0, %s)', A, v_task,
    jsonb_build_object('body', 'x', 'assets', jsonb_build_object('a.html', jsonb_build_object('artifact', v_foreign))), BUDGET),
    'AKB20', 'a card pointing at another task''s artifact');
  perform pg_temp.save_card(A, v_task, '{"body": "# One\n\n- [ ] todo"}', 0, BUDGET);
  perform pg_temp.refuses(format('select pg_temp.save_card(%L, %L, %L, 0, %s)', A, v_task, '{"body": "late"}', BUDGET),
    'AKB27', 'a stale write overwrote the card');
  v_json := pg_temp.save_card(A, v_task, jsonb_build_object('body', 'Two',
    'assets', jsonb_build_object('a.html', jsonb_build_object('artifact', v_art))), 1, BUDGET);
  assert v_json ->> 'body' = 'Two' and v_json -> 'assets' -> 'a.html' ->> 'artifact' = v_art, 'a saved card misread';
  assert (api.v1_task(A, v_task) ->> 'card_version')::integer = (v_json ->> 'version')::integer, 'the task did not name its card''s revision';
  assert pg_temp.card(A, v_task) ->> 'body' = 'Two', 'the card was not saved over';
  assert (select count(*) from cloud.api_events where workspace_id = cloud.v1_personal(A) and type = 'card.updated') = 2, 'a save raised no event';
  perform pg_temp.refuses(format('select pg_temp.card(%L, %L)', B, v_task), 'AKB20', 'B read A''s card');

  -- The review: submitted, then question and options; the revision moves with each change.
  perform pg_temp.save_card(A, v_task, jsonb_build_object('body', 'Two',
    'assets', jsonb_build_object('a.html', jsonb_build_object('artifact', v_art))), 2, BUDGET);
  assert (api.v1_task(A, v_task) -> 'review' ->> 'revision')::integer = 0, 'a card moved a review never submitted';
  perform cloud.v1_submit_draft(v_task);
  v_json := api.v1_update_review(A, v_task, jsonb_build_object('question', 'Ship it?', 'options', OPTIONS), BUDGET);
  assert v_json ->> 'object' = 'review' and v_json ->> 'task' = v_task and v_json ->> 'status' = 'ready'
    and (v_json ->> 'revision')::integer = 2 and v_json -> 'options' = OPTIONS, 'setting the review''s question misread';
  perform pg_temp.refuses(format('select api.v1_update_review(%L, %L, %L, %s)', B, v_task, '{"question": "x"}', BUDGET),
    'AKB20', 'B asked A''s review');
  perform api.v1_create_artifact_version(A, v_art, '{"html": "v1"}', null, BUDGET);
  v_json := api.v1_task(A, v_task) -> 'review';
  assert v_json ->> 'status' = 'ready' and (v_json ->> 'revision')::integer = 3, 'a preview did not move the review on';
  assert (select artifacts from cloud.review_revisions where task_id = v_task and phase = 1 and revision = 3)
    = jsonb_build_array(jsonb_build_object('artifact', v_art, 'version', 1)), 'the revision did not log its preview';
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', A, v_task,
    '{"decision": "approve"}', '{"kind": "user", "handle": "share-a"}', BUDGET), 'AKB21', 'a decision named no revision');
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', A, v_task,
    '{"decision": "approve", "review_revision": 1}', '{"kind": "user", "handle": "share-a"}', BUDGET),
    'AKB26', 'an outdated review was approved');

  -- Links admit the task's guests.
  perform pg_temp.refuses(format('select api.v1_create_share_link(%L, %L, %L, %L, %s)', B, v_task, '{}', 'h0', BUDGET),
    'AKB20', 'B shared A''s task');
  v_link := api.v1_create_share_link(A, v_task, '{}', 'h1', BUDGET);
  assert v_link ->> 'access' = 'invited' and v_link ->> 'task' = v_task and not v_link ? 'emails', 'a new link misread';
  perform api.v1_add_guest(A, v_task, ' Ana@Studio.co ', BUDGET);

  perform pg_temp.refuses(format('select api.v1_shared(%L, null, null)', 'nope'), 'AKB24', 'an unknown link opened');
  perform pg_temp.refuses(format('select api.v1_shared(%L, null, null)', 'h1'), 'AKB25', 'an invited link opened signed out');
  perform pg_temp.refuses(format('select api.v1_shared(%L, %L, %L)', 'h1', R, 'eve@x.co'), 'AKB25', 'an uninvited email opened');
  v_json := api.v1_shared('h1', R, 'ANA@studio.co');
  assert v_json ->> 'role' = 'guest' and v_json -> 'task' ->> 'status' = 'waiting_review', 'an invited email was not a guest';
  assert pg_temp.body_of(v_json -> 'card') = 'Two' and v_json -> 'review' -> 'options' = OPTIONS
    and (v_json -> 'review' ->> 'phase')::integer = 1, 'the review missed its card';
  assert jsonb_array_length(v_json -> 'artifacts') = 1 and v_json -> 'artifacts' -> 0 ->> 'id' = v_art,
    'the review reached past its task';
  assert not v_json ? 'guests', 'a guest saw the guest list';
  v_json := api.v1_shared('h1', A, null);
  assert v_json ->> 'role' = 'owner' and v_json -> 'guests' -> 0 ->> 'email' = 'ana@studio.co', 'the account was not the owner';
  perform pg_temp.refuses(format('select api.v1_shared_file(%L, %L, %L, %L, 1)', 'h1', R, 'ana@studio.co', v_foreign),
    'AKB20', 'a file of another task was reached');

  -- Comments and decisions through the link.
  v_seq := (select max(seq) from cloud.api_events where workspace_id = cloud.v1_personal(A));
  v_json := api.v1_shared_comment('h1', R, 'ana@studio.co', 'Looks close', BUDGET);
  assert v_json ->> 'workspace' = cloud.v1_personal(A) and v_json -> 'result' -> 'author' ->> 'kind' = 'reviewer', 'a reviewer comment misread';
  assert jsonb_array_length(api.v1_list_events(A, v_seq, 100, '{alert.created}') -> 'data') = 1, 'a comment raised no event';
  assert jsonb_array_length(api.v1_list_events(A, v_seq, 100, '{comment.created,alert.created}') -> 'data') = 0,
    'a hidden event was shown';
  assert (v_json -> 'result' ->> 'phase')::integer = 1, 'a comment missed its phase';
  perform pg_temp.refuses(format('select api.v1_shared_decide(%L, %L, %L, 0, null, 3, %s)', 'h1', R, 'ana@studio.co', BUDGET),
    'AKB25', 'a guest decided');
  perform pg_temp.refuses(format('select api.v1_shared_decide(%L, %L, null, null, %L, 3, %s)', 'h1', A, ' ', BUDGET),
    'AKB21', '"other" with nothing written');
  perform pg_temp.refuses(format('select api.v1_shared_decide(%L, %L, null, -1, null, 3, %s)', 'h1', A, BUDGET),
    'AKB21', 'a negative option');
  perform pg_temp.refuses(format('select api.v1_shared_decide(%L, %L, null, 0, null, 1, %s)', 'h1', A, BUDGET),
    'AKB26', 'a stale page approved');
  v_json := api.v1_shared_decide('h1', A, null, 1, 'Fewer tiers', 3, BUDGET) -> 'result';
  assert v_json ->> 'decision' = 'request_changes' and v_json ->> 'comment' = E'Simplify it\n\nFewer tiers'
    and v_json -> 'decided_by' ->> 'kind' = 'user'
    and (v_json ->> 'review_revision')::integer = 3 and not v_json ? 'card_version', 'a request for changes misread';
  assert api.v1_task(A, v_task) -> 'review' ->> 'status' = 'changes_requested', 'the request did not move the review';

  -- A new card is reviewed again: a page opened on the old one is outdated.
  perform pg_temp.save_card(A, v_task, '{"body": "Three"}', 3, BUDGET);
  v_json := api.v1_task(A, v_task) -> 'review';
  assert (v_json ->> 'revision')::integer = 4 and v_json -> 'options' = OPTIONS, 'a new card was not up for review';
  perform pg_temp.refuses(format('select api.v1_shared_decide(%L, %L, null, 0, null, 3, %s)', 'h1', A, BUDGET),
    'AKB26', 'a page on the old card approved');
  assert pg_temp.body_of(api.v1_shared('h1', R, 'ana@studio.co') -> 'card') = 'Three', 'the link did not open the current card';

  -- View only: no history, no writes; a guest signed in keeps their role.
  perform api.v1_update_share_link(A, v_link ->> 'id', '{"access": "link"}', BUDGET);
  v_json := api.v1_shared('h1', null, null);
  assert v_json ->> 'role' is null and not v_json ? 'comments' and not v_json ? 'decisions'
    and not v_json -> 'review' ? 'status', 'a visitor saw the history';
  perform pg_temp.refuses(format('select api.v1_shared_comment(%L, null, null, %L, %s)', 'h1', 'hi', BUDGET),
    'AKB25', 'a visitor commented');
  v_json := api.v1_shared_decide('h1', A, null, 0, null, 4, BUDGET) -> 'result';
  assert v_json ->> 'decision' = 'approve' and v_json ->> 'comment' = 'Go ahead', 'an approval misread';
  v_json := api.v1_shared('h1', R, 'ana@studio.co');
  assert jsonb_array_length(v_json -> 'decisions') = 2 and jsonb_array_length(v_json -> 'revisions') = 4,
    'the history lost a decision or a revision';

  -- Revoked and expired links open nothing.
  perform api.v1_revoke_share_link(A, v_link ->> 'id', BUDGET);
  perform pg_temp.refuses(format('select api.v1_shared(%L, %L, %L)', 'h1', R, 'ana@studio.co'), 'AKB24', 'a revoked link opened');
  perform pg_temp.refuses(format('select api.v1_update_share_link(%L, %L, %L, %s)', A, v_link ->> 'id', '{"access": "link"}', BUDGET),
    'AKB21', 'a revoked link was changed');
  v_link := api.v1_create_share_link(A, v_task, '{"access": "link"}', 'h2', BUDGET);
  update cloud.share_links set expires_at = now() - interval '1 second' where id = v_link ->> 'id';
  perform pg_temp.refuses(format('select api.v1_shared(%L, null, null)', 'h2'), 'AKB24', 'an expired link opened');
  assert jsonb_array_length(api.v1_list_share_links(A, v_task) -> 'data') = 2, 'the task''s links were not listed';

  -- #2003: the card's own mockups, uploaded as the task's artifacts, are the review's too.
  v_other := api.v1_create_artifact(A, v_task, '{"type": "asset", "name": ".assets/1/pricing.tsx"}', BUDGET) ->> 'id';
  perform api.v1_create_artifact_version(A, v_other, '{"x": 1}', null, BUDGET);
  perform pg_temp.save_card(A, v_task, jsonb_build_object('body', 'Four',
    'assets', jsonb_build_object('.assets/1/pricing.tsx', jsonb_build_object('artifact', v_other, 'version', 1))), 4, BUDGET);
  perform api.v1_create_share_link(A, v_task, '{"access": "link"}', 'h3', BUDGET);
  assert exists (select 1 from jsonb_array_elements(api.v1_shared('h3', null, null) -> 'artifacts') x where x ->> 'id' = v_other),
    'the review missed its card''s mockup';
  perform api.v1_shared_file('h3', null, null, v_other, 1);
  perform pg_temp.refuses(format('select api.v1_shared_file(%L, null, null, %L, 1)', 'h3', v_foreign),
    'AKB20', 'a file of another task was reached');

  raise notice 'sql checks: #2019 share link checks passed';
end
$share_links$;

-- #2029: a reviewer's comment alerts the task's owner; the owner's own reads them.
do $comment_alerts$
declare
  A constant uuid := 'aaaaaaaa-2029-4029-8029-000000000001';
  HOME constant uuid := 'cccccccc-2029-4029-8029-000000000003';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  REVIEWER constant jsonb := '{"kind": "reviewer", "email": "ana@studio.co"}';
  v_site text;
  v_task text;
  v_cmt text;
  v_json json;
begin
  insert into cloud.accounts (id, handle) values (A, 'comment-a');
  perform api.register_runner(A, HOME, 'home-mac', 1, '0.2.0', '[]', true, 900, BUDGET);
  v_site := api.add_project_folder(A, HOME, 'site', '/Users/a/site', BUDGET) ->> 'project';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing page', 'project', v_site), WF, BUDGET) ->> 'id';
  perform pg_temp.review(v_task, 'ready');

  -- A reviewer's comment: one alert on the desktop, carrying who said what.
  v_cmt := api.v1_create_comment(A, v_task, 'Make the CTA bigger', REVIEWER, BUDGET) ->> 'id';
  assert (select count(*) from cloud.alerts where kind = 'comment' and comment_id = v_cmt and channel = 'desktop') = 1,
    'a reviewer comment did not alert the desktop';
  assert json_array_length(api.list_desktop_alerts(A, HOME)) = 1, 'a Runner that did not ask was shown a comment';
  assert json_array_length(api.list_desktop_alerts(A, HOME, true)) = 2, 'a Runner that asked was not shown the comment';
  select x into v_json from json_array_elements(api.list_desktop_alerts(A, HOME, true)) x where x ->> 'kind' = 'comment';
  assert v_json ->> 'kind' = 'comment' and v_json -> 'comment' ->> 'id' = v_cmt
    and v_json -> 'comment' ->> 'body' = 'Make the CTA bigger' and v_json -> 'comment' -> 'author' ->> 'email' = 'ana@studio.co',
    'a comment alert misread';
  assert api.list_desktop_alerts(A, HOME) -> 0 ->> 'comment' is null, 'a review alert named a comment';
  assert api.runner_inbox(A) -> 'review' -> 0 ->> 'alert' <> v_json ->> 'id', 'a comment stood in for the review';

  -- The owner's own comment, by hand or by key, alerts nothing and reads the task's comments.
  perform api.v1_create_comment(A, v_task, 'On it', '{"kind": "user", "handle": "comment-a"}', BUDGET);
  perform api.v1_create_comment(A, v_task, 'Done', '{"kind": "api_key", "id": "key_1", "name": "ci"}', BUDGET);
  assert (select count(*) from cloud.alerts where account_id = A and kind = 'comment') = 1, 'the owner''s own comment raised an alert';
  assert (select read_at from cloud.alerts where comment_id = v_cmt) is not null, 'the owner''s reply left a comment unread';
  assert (select read_at from cloud.alerts where account_id = A and kind = 'review') is null, 'the owner''s reply read the review';

  -- With no Runner showing notifications, it waits on the web; deciding the review reads it.
  perform api.register_runner(A, HOME, 'home-mac', 1, '0.2.0', '[]', false, 900, BUDGET);
  v_cmt := api.v1_create_comment(A, v_task, 'One more', REVIEWER, BUDGET) ->> 'id';
  assert api.v1_list_alerts(A, 'web', null, 20) -> 'data' -> 0 -> 'comment' ->> 'id' = v_cmt,
    'a comment did not wait on the web';
  perform pg_temp.review(v_task, 'approved');
  assert (select read_at from cloud.alerts where comment_id = v_cmt) is not null, 'a decided review left a comment unread';

  -- Deleting the comment takes its alert.
  delete from cloud.comments where id = v_cmt;
  assert not exists (select 1 from cloud.alerts where comment_id = v_cmt), 'a deleted comment kept its alert';

  raise notice 'sql checks: #2029 comment alert checks passed';
end
$comment_alerts$;


-- #2037: a task's jobs one at a time, a conflict retried once, and the workspace written whole.
do $workspace$
declare
  A constant uuid := 'aaaaaaaa-2037-4037-8037-000000000001';
  HOME constant uuid := 'cccccccc-2037-4037-8037-000000000003';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  v_site text;
  v_task text;
  v_general text;
  v_art text;
  v_first uuid;
  v_second uuid;
  v_other uuid;
  v_loose uuid;
  v_retry uuid;
  v_job uuid;
  v_push text;
  v_json json;
  v_out jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'workspace-a');
  perform api.register_runner(A, HOME, 'home-mac', 2, '0.3.0', '[]', false, 900, BUDGET);
  v_site := api.add_project_folder(A, HOME, 'site', '/Users/a/site', BUDGET) ->> 'project';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing page', 'project', v_site), WF, BUDGET) ->> 'id';
  v_general := api.v1_create_task(A, jsonb_build_object('title', 'Loose notes'), WF, BUDGET) ->> 'id';

  -- A task's job runs in its project's folder and carries the task.
  v_json := api.dispatch_runner_job(A, 'codex', null, 'First', '[]', BUDGET, v_task);
  v_first := (v_json ->> 'id')::uuid;
  assert v_json ->> 'task' = v_task and v_json ->> 'projectDir' = '/Users/a/site' and (v_json ->> 'attempt')::int = 1,
    'a task''s job did not carry its task and folder';
  perform pg_temp.refuses(format('select api.dispatch_runner_job(%L, %L, %L, %L, %L, %s, %L)', A, 'codex',
    'prj_other', 'x', '[]', BUDGET, v_task), 'AKB21', 'a task''s job in another project');
  v_second := (api.dispatch_runner_job(A, 'codex', null, 'Second', '[]', BUDGET, v_task) ->> 'id')::uuid;
  v_other := (api.dispatch_runner_job(A, 'codex', null, 'Other', '[]', BUDGET, v_general) ->> 'id')::uuid;
  v_loose := (api.dispatch_runner_job(A, 'codex', null, 'Loose', '[]', BUDGET) ->> 'id')::uuid;
  assert api.dispatch_runner_job(A, 'codex', null, 'x', '[]', BUDGET) ->> 'task' is null, 'a job without a task named one';

  -- One job of a task at a time; other tasks and loose jobs run beside it.
  assert not exists (select 1 from json_array_elements(api.list_runner_jobs(A, HOME)) j where (j ->> 'id')::uuid = v_second),
    'a task''s second job was listed before its first ended';
  assert not (api.claim_runner_job(A, HOME, v_second, 900, BUDGET) ->> 'claimed')::boolean,
    'a task''s second job was claimed before its first';
  assert (api.claim_runner_job(A, HOME, v_first, 900, BUDGET) ->> 'claimed')::boolean, 'a task''s first job was not claimed';
  assert not (api.claim_runner_job(A, HOME, v_second, 900, BUDGET) ->> 'claimed')::boolean,
    'a task''s second job was claimed while its first ran';
  assert (api.claim_runner_job(A, HOME, v_other, 900, BUDGET) ->> 'claimed')::boolean, 'another task''s job waited';
  assert (api.claim_runner_job(A, HOME, v_loose, 900, BUDGET) ->> 'claimed')::boolean, 'a job without a task waited';

  -- A conflict is dispatched again, ahead of the task's next job.
  v_json := api.finish_runner_job(A, HOME, v_first, 'conflict', '', BUDGET);
  v_retry := (v_json -> 'retry' ->> 'id')::uuid;
  assert v_json -> 'job' ->> 'outcome' = 'conflict' and (v_json -> 'retry' ->> 'attempt')::int = 2
    and v_json -> 'retry' ->> 'prompt' = 'First', 'a conflict was not dispatched again';
  assert not (api.claim_runner_job(A, HOME, v_second, 900, BUDGET) ->> 'claimed')::boolean, 'a retry was overtaken';
  assert (api.claim_runner_job(A, HOME, v_retry, 900, BUDGET) ->> 'claimed')::boolean, 'a retry was not claimed';
  v_json := api.finish_runner_job(A, HOME, v_retry, 'conflict', '', BUDGET);
  assert v_json -> 'job' ->> 'outcome' = 'failed' and v_json -> 'job' ->> 'reason' = 'The card was updated elsewhere.'
    and json_typeof(v_json -> 'retry') = 'null', 'a second conflict did not fail';
  assert (api.claim_runner_job(A, HOME, v_second, 900, BUDGET) ->> 'claimed')::boolean,
    'a task''s next job was not freed when the one before ended';
  -- An interrupted job frees the task too.
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 second' where id = v_second;
  v_first := (api.dispatch_runner_job(A, 'codex', null, 'Third', '[]', BUDGET, v_task) ->> 'id')::uuid;
  assert (api.claim_runner_job(A, HOME, v_first, 900, BUDGET) ->> 'claimed')::boolean, 'an interrupted job held its task';
  -- A loose job never conflicts.
  assert api.finish_runner_job(A, HOME, v_loose, 'conflict', '', BUDGET) -> 'job' ->> 'outcome' = 'failed',
    'a job without a task was retried';

  -- #2081: a card file indexed as a push lands — where it is, its seq, its stages and its assets.
  v_art := api.v1_create_artifact(A, v_task, '{"type": "asset", "name": "hero.png"}', BUDGET) ->> 'id';
  perform api.v1_create_artifact_version(A, v_art, '{"x": 1}', null, BUDGET);
  v_out := api.v1_index_cards(A, v_site, jsonb_build_array(
    jsonb_build_object('task', v_task, 'path', 'todo/1-' || replace(v_task, '_', '-') || '.md', 'seq', 7,
      'front', '{"title": "Pricing, priced", "status": "planning", "phase": 2, "previews": ["copywriting", "ui-designer"], "stages": 2}'::jsonb),
    jsonb_build_object('task', v_task, 'assets', jsonb_build_object('hero.png', jsonb_build_object('artifact', v_art, 'version', 1),
      'gone.png', jsonb_build_object('artifact', 'art_nope')))), BUDGET);
  v_json := api.v1_task(A, v_task);
  assert (v_json ->> 'card_version')::int = 7 and v_json ->> 'title' = 'Pricing, priced', 'a pushed card was not indexed';
  v_out := api.v1_card(A, v_task);
  assert v_out -> 'metadata' @> '{"phase": 2, "previews": ["copywriting", "ui-designer"], "stages": 2}' and v_out -> 'assets' ? 'hero.png'
    and not v_out -> 'assets' ? 'gone.png', 'a pushed card kept the wrong stages or assets';
  perform pg_temp.refuses(format('select api.v1_index_cards(%L, %L, %L, %s)', 'bbbbbbbb-2037-4037-8037-000000000002', v_site, '[]', BUDGET), 'AKB20',
    'B indexed A''s project');

  -- Archived, it says so; deleted where it is, the task has no card; another project's task is untouched.
  perform api.v1_index_cards(A, v_site, jsonb_build_array(
    jsonb_build_object('task', v_task, 'path', 'todo/1-' || replace(v_task, '_', '-') || '.md', 'deleted', true),
    jsonb_build_object('task', v_task, 'path', '.archive/1-' || replace(v_task, '_', '-') || '.md', 'seq', 8, 'front', '{}'::jsonb),
    jsonb_build_object('task', v_general, 'path', 'todo/9-x.md', 'seq', 8, 'front', '{}'::jsonb)), BUDGET);
  assert (select card_status from cloud.tasks where id = v_task) = 'archived', 'a card in .archive/ was not archived';
  assert (select card_path from cloud.tasks where id = v_general) is null, 'a card indexed another project''s task';
  perform api.v1_index_cards(A, v_site, jsonb_build_array(
    jsonb_build_object('task', v_task, 'path', '.archive/1-' || replace(v_task, '_', '-') || '.md', 'deleted', true)), BUDGET);
  perform pg_temp.refuses(format('select api.v1_card(%L, %L)', A, v_task), 'AKB20', 'a deleted card was read');

  -- A push belongs to the job a Runner holds on that project.
  v_push := api.v1_create_task(A, jsonb_build_object('title', 'Push', 'project', v_site), WF, BUDGET) ->> 'id';
  v_job := (api.dispatch_runner_job(A, 'codex', null, 'Push', '[]', BUDGET, v_push) ->> 'id')::uuid;
  perform pg_temp.refuses(format('select api.v1_board_job(%L, %L, %L, %L)', A, v_site, v_job, HOME), 'AKB21',
    'a waiting job pushed');
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  assert api.v1_board_job(A, v_site, v_job, HOME) ->> 'task' = v_push, 'a held job could not push';
  perform pg_temp.refuses(format('select api.v1_board_job(%L, %L, %L, %L)', A, v_site, v_job, gen_random_uuid()), 'AKB21',
    'another computer pushed a job it does not hold');
  perform pg_temp.refuses(format('select api.v1_board_job(%L, %L, %L, %L)', A, cloud.v1_general(cloud.v1_personal(A)), v_job, HOME),
    'AKB21', 'a job pushed to another project');

  -- A lapsed lease: refused, the job finished, and the task's job dispatched once more at the head of its queue.
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 second' where id = v_job;
  perform pg_temp.refuses(format('select api.v1_board_job(%L, %L, %L, %L)', A, v_site, v_job, HOME), 'AKB21',
    'a lapsed job pushed');
  perform api.list_runner_jobs(A, HOME);
  assert (select state || '/' || outcome from cloud.runner_jobs where id = v_job) = 'finished/failed', 'a lapsed job was left';
  select id into v_second from cloud.runner_jobs where task_id = v_push and attempt = 2 and state = 'waiting';
  assert v_second is not null, 'a lapsed job was not dispatched again';
  perform api.claim_runner_job(A, HOME, v_second, 900, BUDGET);
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 second' where id = v_second;
  perform api.list_runner_jobs(A, HOME);
  assert not exists (select 1 from cloud.runner_jobs where task_id = v_push and state = 'waiting'),
    'a second lapse was dispatched again';

  raise notice 'sql checks: #2037 task files checks passed';
end
$workspace$;


-- Workflows as files (#2040): versions a task is pinned to, built-ins numbered on first use,
-- and reviews made from the plan's drafts as a plan job finishes.
do $workflow_files$
declare
  A constant uuid := 'aaaaaaaa-2040-4040-8040-000000000001';
  B constant uuid := 'bbbbbbbb-2040-4040-8040-000000000002';
  HOME constant uuid := 'cccccccc-2040-4040-8040-000000000003';
  BUDGET constant integer := 100000;
  ACTOR constant jsonb := '{"kind": "user", "handle": "wf-a"}';
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "h1", "files": {"WORKFLOW.md": "one"}}';
  BLOG constant jsonb := '{"id": "wf_builtin_blog_post", "builtin": true, "name": "Blog post", "lands": false,
    "hash": "b1", "files": {"WORKFLOW.md": "blog"}}';
  v_wf text;
  v_task text;
  v_old text;
  v_blog text;
  v_job uuid;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'wf-a'), (B, 'wf-b');
  perform api.register_runner(A, HOME, 'home-mac', 2, '0.3.0', '[]', false, 900, BUDGET);

  -- An own workflow keeps a version per change; a task stays on the one it was made on.
  v_wf := api.v1_create_workflow(A, '{"name": "Mine", "lands": true, "files": {"WORKFLOW.md": "v1"}}', BUDGET) ->> 'id';
  v_old := api.v1_create_task(A, '{"title": "Old"}', jsonb_build_object('id', v_wf, 'builtin', false), BUDGET) ->> 'id';
  v_json := api.v1_update_workflow(A, v_wf, '{"name": "Mine 2", "lands": false, "files": {"WORKFLOW.md": "v2"}}', BUDGET);
  assert (v_json ->> 'version')::int = 2, 'a change did not add a version';
  assert api.v1_workflow(A, v_wf) -> 'files' ->> 'WORKFLOW.md' = 'v2', 'a workflow did not read its current files';
  v_json := api.v1_task_workflow(A, v_old);
  assert (v_json ->> 'version')::int = 1 and v_json -> 'files' ->> 'WORKFLOW.md' = 'v1',
    'a change reached a task made before it';
  perform api.v1_update_workflow(A, v_wf, '{"name": "Mine 3", "lands": false, "files": {"WORKFLOW.md": "v3"}}', BUDGET);
  assert not exists (select 1 from cloud.workflow_versions where workflow_id = v_wf and version = 2),
    'a version nothing uses was kept';
  perform api.v1_delete_workflow(A, v_wf, BUDGET);
  assert api.v1_task_workflow(A, v_old) -> 'files' ->> 'WORKFLOW.md' = 'v1', 'deleting a workflow took a task''s version';
  perform pg_temp.refuses(format('select api.v1_task_workflow(%L, %L)', B, v_old), 'AKB20', 'B read A''s task workflow');
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', B, '{"title": "x"}',
    jsonb_build_object('id', v_wf, 'builtin', false), BUDGET), 'AKB20', 'a task was made on a deleted workflow');

  -- A built-in is numbered the first time its files are used, once.
  assert (api.v1_builtin_versions('[{"id": "wf_builtin_coding", "hash": "h1"}]') ->> 'wf_builtin_coding')::int = 1,
    'an unused built-in did not read as version 1';
  v_task := api.v1_create_task(A, '{"title": "Pricing"}', CODING, BUDGET) ->> 'id';
  perform api.v1_create_task(B, '{"title": "Theirs"}', CODING, BUDGET);
  perform api.v1_create_task(A, '{"title": "Later"}', CODING || '{"hash": "h2", "files": {"WORKFLOW.md": "two"}}', BUDGET);
  assert (select count(*) from cloud.workflow_versions where workflow_id = 'wf_builtin_coding') = 2,
    'a built-in''s files were stored more than once';
  assert api.v1_task(A, v_task) -> 'workflow' = '{"id": "wf_builtin_coding", "name": "Coding", "version": 1}',
    'a task did not name its workflow version';
  assert (api.v1_builtin_versions('[{"id": "wf_builtin_coding", "hash": "h2"}]') ->> 'wf_builtin_coding')::int = 2,
    'an updated built-in was not version 2';
  assert api.v1_task(A, v_task) -> 'review' ->> 'status' is null, 'a new task was up for review';

  -- A finished plan job submits the card's stage; approving it moves the card on.
  perform pg_temp.save_card(A, v_task, '{"body": "Plan", "metadata": {"phase": 1, "previews": ["copywriting", "ui-designer"], "stages": 2}}', 0, BUDGET);
  perform pg_temp.refuses(format('select api.dispatch_runner_job(%L, %L, %L, %L, %L, %s, %L, %L)', A, 'codex', null, 'x', '[]',
    BUDGET, v_task, 'review'), '23514', 'a job took an unknown stage');
  v_job := (api.dispatch_runner_job(A, 'codex', null, 'Plan it', '[]', BUDGET, v_task, 'plan') ->> 'id')::uuid;
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET);
  v_json := api.v1_task(A, v_task) -> 'review';
  assert v_json ->> 'status' = 'ready' and (v_json ->> 'phase')::int = 1,
    'a submitted stage was not up for review';
  assert (select status from cloud.tasks where id = v_task) = 'waiting_review', 'a submitted task was not waiting for review';
  perform api.v1_create_comment(A, v_task, 'Tighter', ACTOR, BUDGET);
  perform api.v1_create_decision(A, v_task, jsonb_build_object('decision', 'approve', 'review_revision',
    (select review_revision from cloud.tasks where id = v_task)), ACTOR, BUDGET);
  assert (pg_temp.card(A, v_task) -> 'metadata' ->> 'phase')::int = 2, 'approving a stage did not move the card on';
  assert (select status from cloud.tasks where id = v_task) = 'queued', 'a task with a stage left did not wait for it';
  v_json := api.v1_task_workflow(A, v_task);
  assert (v_json ->> 'round')::int = 2 and (v_json ->> 'rounds')::int = 2 and (v_json ->> 'lands')::boolean
    and v_json -> 'previews' = '["copywriting", "ui-designer"]' and not v_json ? 'delivers',
    'a task''s workflow did not read the stage its card is on';

  v_job := (api.dispatch_runner_job(A, 'codex', null, 'Draft it', '[]', BUDGET, v_task, 'plan') ->> 'id')::uuid;
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET);
  v_json := api.v1_task(A, v_task) -> 'review';
  assert v_json ->> 'status' = 'ready' and (v_json ->> 'phase')::int = 2,
    'the next stage was not up for review';
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', A, v_task,
    jsonb_build_object('decision', 'approve', 'review_revision', (v_json ->> 'revision')::int - 1), ACTOR, BUDGET),
    'AKB26', 'an outdated stage was approved');
  perform api.v1_create_comment(A, v_task, 'Good', ACTOR, BUDGET);
  perform api.v1_create_decision(A, v_task, jsonb_build_object('decision', 'approve', 'review_revision',
    (v_json ->> 'revision')::int), ACTOR, BUDGET);
  assert (select status from cloud.tasks where id = v_task) = 'queued', 'a build workflow ended at its plan';
  assert (select string_agg(phase::text, ',' order by id) from cloud.decisions where task_id = v_task) = '1,2'
    and (select string_agg(phase::text, ',' order by id) from cloud.comments where task_id = v_task) = '1,2',
    'a decision or comment missed the stage it was made in';
  v_json := api.v1_list_comments(A, v_task, null, 20);
  assert jsonb_array_length(v_json -> 'data') = 2 and (v_json -> 'data' -> 1 ->> 'phase')::int = 2, 'the task''s comments misread';

  -- Going back reviews the earlier stage again.
  perform pg_temp.save_card(A, v_task, '{"body": "Plan", "metadata": {"phase": 1}}',
    (select card_version from cloud.tasks where id = v_task), BUDGET);
  v_job := (api.dispatch_runner_job(A, 'codex', null, 'Back', '[]', BUDGET, v_task, 'plan') ->> 'id')::uuid;
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET);
  assert (select review_status || '/' || review_phase from cloud.tasks where id = v_task) = 'ready/1',
    'going back kept the later stage';

  -- Without stages the whole plan is one review; a workflow delivering its plan ends there.
  v_blog := api.v1_create_task(A, '{"title": "Launch post"}', BLOG, BUDGET) ->> 'id';
  perform pg_temp.save_card(A, v_blog, '{"body": "Outline"}', 0, BUDGET);
  v_job := (api.dispatch_runner_job(A, 'codex', null, 'Write', '[]', BUDGET, v_blog, 'plan') ->> 'id')::uuid;
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'failed', 'x', BUDGET);
  assert (select review_status from cloud.tasks where id = v_blog) is null, 'a failed plan job submitted a draft';
  v_job := (api.dispatch_runner_job(A, 'codex', null, 'Write', '[]', BUDGET, v_blog, 'plan') ->> 'id')::uuid;
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET);
  v_json := api.v1_task(A, v_blog) -> 'review';
  assert v_json ->> 'status' = 'ready' and (v_json ->> 'phase')::int = 1,
    'a plan without stages was not up for review';
  perform api.v1_create_decision(A, v_blog, jsonb_build_object('decision', 'approve', 'review_revision',
    (v_json ->> 'revision')::int), ACTOR, BUDGET);
  assert (select status from cloud.tasks where id = v_blog) = 'done', 'a workflow delivering its plan did not end';

  raise notice 'sql checks: #2040 workflow file checks passed';
end
$workflow_files$;

-- #2027: a task's guests, and the owner's chat on the review page.
do $guests$
declare
  A constant uuid := 'a0a0a0a0-2027-4027-8027-000000000001';
  B constant uuid := 'b0b0b0b0-2027-4027-8027-000000000002';
  R constant uuid := 'c0c0c0c0-2027-4027-8027-000000000003';
  HOME constant uuid := 'cccccccc-2027-4027-8027-000000000004';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "h1", "files": {"WORKFLOW.md": "one"}}';
  v_task text;
  v_other text;
  v_art text;
  v_job uuid;
  v_first uuid;
  v_json jsonb;
  v_prompt text;
begin
  insert into cloud.accounts (id, handle) values (A, 'guests-a'), (B, 'guests-b');
  perform api.register_runner(A, HOME, 'home-mac', 2, '0.3.0', '[]', false, 900, BUDGET);
  -- Each task's plan is submitted for review.
  v_task := api.v1_create_task(A, '{"title": "Pricing"}', WF, BUDGET) ->> 'id';
  v_other := api.v1_create_task(A, '{"title": "Other"}', WF, BUDGET) ->> 'id';
  foreach v_prompt in array array[v_task, v_other] loop
    perform pg_temp.save_card(A, v_prompt, '{"body": "One"}', 0, BUDGET);
    v_job := (api.dispatch_runner_job(A, 'codex', null, 'Plan', '[]', BUDGET, v_prompt, 'plan') ->> 'id')::uuid;
    perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
    perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET);
  end loop;
  update cloud.runners set live_until = now() - interval '1 second' where owner_id = A;
  perform api.v1_create_share_link(A, v_task, '{}', 'g1', BUDGET);
  perform api.v1_create_share_link(A, v_other, '{}', 'g2', BUDGET);

  -- Guests: kept once, lower case, only by the owner, and each task its own.
  perform api.v1_add_guest(A, v_task, 'Ana@Studio.co', BUDGET);
  perform api.v1_add_guest(A, v_task, 'ana@studio.co', BUDGET);
  perform api.v1_add_guest(A, v_other, 'bo@x.co', BUDGET);
  assert api.v1_list_guests(A, v_task) -> 'data' = jsonb_build_array(jsonb_build_object('object', 'guest', 'task', v_task,
    'email', 'ana@studio.co', 'created_at', api.v1_list_guests(A, v_task) -> 'data' -> 0 -> 'created_at')),
    'the guests were not kept once, lower case';
  perform pg_temp.refuses(format('select api.v1_add_guest(%L, %L, %L, %s)', B, v_task, 'x@y.co', BUDGET), 'AKB20', 'B invited to A''s task');
  perform pg_temp.refuses(format('select api.v1_list_guests(%L, %L)', B, v_task), 'AKB20', 'B listed A''s guests');
  perform pg_temp.refuses(format('select api.v1_shared(%L, %L, %L)', 'g1', R, 'bo@x.co'), 'AKB25', 'another task''s guest opened');
  assert api.v1_shared('g2', R, 'bo@x.co') ->> 'role' = 'guest', 'a guest did not open their own task';

  -- The chat is the owner's alone.
  perform pg_temp.refuses(format('select api.v1_shared_chat(%L, %L, %L)', 'g1', R, 'ana@studio.co'), 'AKB25', 'a guest read the chat');
  perform pg_temp.refuses(format('select api.v1_shared_chat_send(%L, %L, %L, %L, %L, %s)', 'g1', R, 'ana@studio.co', 'hi',
    'task', BUDGET), 'AKB25', 'a guest chatted');
  perform pg_temp.refuses(format('select api.v1_shared_chat_clear(%L, %L, %L, %s)', 'g1', R, 'ana@studio.co', BUDGET),
    'AKB25', 'a guest cleared the chat');
  update cloud.share_links set access = 'link' where token_hash = 'g1';
  perform pg_temp.refuses(format('select api.v1_shared_chat(%L, null, null)', 'g1'), 'AKB25', 'a visitor read the chat');
  update cloud.share_links set access = 'invited' where token_hash = 'g1';

  -- No Runner, no reply.
  perform pg_temp.refuses(format('select api.v1_shared_chat_send(%L, %L, null, %L, %L, %s)', 'g1', A, 'hi', 'task', BUDGET),
    'AKB26', 'a message sent with no Runner');
  perform api.register_runner(A, HOME, 'home-mac', 2, '0.3.0',
    '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true, "loggedIn": false}]', false, 900, BUDGET);
  perform cloud.v1_default_runtime(A);
  update cloud.runtimes set connector = 'codex' where account_id = A and is_default;
  v_json := api.v1_shared_chat('g1', A, null);
  assert v_json ->> 'status' = 'idle' and v_json ->> 'runtime' = 'task' and (v_json -> 'runner' ->> 'connected')::boolean
    and v_json -> 'messages' = '[]' and v_json -> 'context' = 'null', 'an empty chat misread';

  -- A message waits behind the task's other jobs, then is the task's next job.
  v_first := (api.dispatch_runner_job(A, 'codex', null, 'Build', '[]', BUDGET, v_task) ->> 'id')::uuid;
  v_json := api.v1_shared_chat_send('g1', A, null, 'Fewer tiers?', null, BUDGET) -> 'result';
  assert v_json ->> 'status' = 'queued' and v_json ->> 'runtime' = 'task', 'a message behind another job was not queued';
  select id, prompt into v_job, v_prompt from cloud.runner_jobs
    where id = (select job_id from cloud.task_chats where task_id = v_task);
  assert v_prompt like '%akb guide card-chat%' and v_prompt like '%Fewer tiers?' and v_prompt not like '%so far%',
    'the first message''s prompt misread';
  perform pg_temp.refuses(format('select api.v1_shared_chat_send(%L, %L, null, %L, %L, %s)', 'g1', A, 'again', 'task', BUDGET),
    'AKB26', 'a second message while replying');
  perform pg_temp.refuses(format('select api.v1_shared_chat_clear(%L, %L, null, %s)', 'g1', A, BUDGET),
    'AKB26', 'the chat cleared while replying');
  perform api.claim_runner_job(A, HOME, v_first, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_first, 'done', '', BUDGET);
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  assert api.v1_shared_chat('g1', A, null) ->> 'status' = 'replying', 'a claimed reply was not replying';
  assert api.v1_shared_chat('g1', A, null) ->> 'job' = v_job::text, 'a replying chat did not name its job';

  -- The reply lands as a message; the session and its context are kept.
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET,
    '{"reply": "Two tiers.", "session": "th_1", "context": {"used": 38000, "limit": 200000}}');
  v_json := api.v1_shared_chat('g1', A, null);
  assert v_json ->> 'status' = 'idle' and jsonb_array_length(v_json -> 'messages') = 2
    and v_json -> 'messages' -> 1 ->> 'role' = 'agent' and v_json -> 'messages' -> 1 ->> 'body' = 'Two tiers.'
    and v_json -> 'context' = '{"used": 38000, "limit": 200000}', 'a reply did not land';
  assert v_json -> 'job' = 'null', 'an idle chat named a job';

  -- The next message continues the session and carries the conversation.
  perform api.v1_shared_chat_send('g1', A, null, 'And the copy?', null, BUDGET);
  select id, prompt into v_job, v_prompt from cloud.runner_jobs where task_id = v_task and state = 'waiting';
  assert (select resume from cloud.runner_jobs where id = v_job) = 'th_1', 'the session was not continued';
  assert v_prompt like '%User: Fewer tiers?%Agent: Two tiers.%And the copy?', 'the prompt missed the conversation';

  -- A second conflict fails the reply with its own status.
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  v_job := (api.finish_runner_job(A, HOME, v_job, 'conflict', '', BUDGET) -> 'retry' ->> 'id')::uuid;
  assert (select resume from cloud.runner_jobs where id = v_job) = 'th_1', 'a retry lost the session';
  assert api.v1_shared_chat('g1', A, null) ->> 'status' = 'replying', 'a retried reply was not replying';
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'conflict', '', BUDGET);
  assert api.v1_shared_chat('g1', A, null) ->> 'status' = 'conflict', 'a card updated elsewhere was not said';

  -- Clearing drops the messages and the session; the next prompt carries none of them.
  v_json := api.v1_shared_chat_clear('g1', A, null, BUDGET) -> 'result';
  assert v_json -> 'messages' = '[]' and v_json ->> 'status' = 'idle' and v_json ->> 'runtime' = 'task'
    and v_json -> 'context' = 'null', 'clearing misread';
  perform api.v1_shared_chat_send('g1', A, null, 'Start over', 'task', BUDGET);
  select id, prompt into v_job, v_prompt from cloud.runner_jobs where task_id = v_task and state = 'waiting';
  assert v_prompt not like '%Fewer tiers%' and v_prompt not like '%so far%' and v_prompt like '%Start over',
    'a cleared conversation reached the prompt';
  assert (select resume from cloud.runner_jobs where id = v_job) is null, 'a cleared chat continued its session';

  -- Another agent starts a new session.
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET, '{"reply": "Sure.", "session": "th_2"}');
  perform api.v1_shared_chat_send('g1', A, null, 'Your view?',
    api.v1_create_runtime(A, '{"name": "Codex mini", "connector": "codex", "model": "gpt-5-mini"}', BUDGET) ->> 'id', BUDGET);
  select id into v_job from cloud.runner_jobs where task_id = v_task and state = 'waiting';
  assert (select resume from cloud.runner_jobs where id = v_job) is null, 'another model continued the session';
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'failed', 'Exited with code 1.', BUDGET);
  assert api.v1_shared_chat('g1', A, null) ->> 'status' = 'failed', 'a failed reply was not said';

  -- A card the chat rewrote is reviewed again: a page on the old one is outdated.
  v_art := api.v1_create_artifact(A, v_task, '{"type": "html"}', BUDGET) ->> 'id';
  perform api.v1_create_artifact_version(A, v_art, '{"html": "v1"}', null, BUDGET);
  v_json := api.v1_shared('g1', R, 'ana@studio.co');
  perform pg_temp.save_card(A, v_task, '{"body": "One, revised"}', (select card_version from cloud.tasks where id = v_task), BUDGET);
  assert (api.v1_task(A, v_task) -> 'review' ->> 'revision')::int = (v_json -> 'review' ->> 'revision')::int + 1,
    'a rewritten card did not move the review on';
  perform pg_temp.refuses(format('select api.v1_shared_decide(%L, %L, null, 0, null, %s, %s)', 'g1', A,
    v_json -> 'review' ->> 'revision', BUDGET), 'AKB26', 'the owner approved the old card');

  -- A removed guest is refused at once.
  perform api.v1_remove_guest(A, v_task, 'ANA@studio.co', BUDGET);
  perform pg_temp.refuses(format('select api.v1_shared(%L, %L, %L)', 'g1', R, 'ana@studio.co'), 'AKB25', 'a removed guest opened');
  perform pg_temp.refuses(format('select api.v1_shared_comment(%L, %L, %L, %L, %s)', 'g1', R, 'ana@studio.co', 'hi', BUDGET),
    'AKB25', 'a removed guest commented');
  perform pg_temp.refuses(format('select api.v1_remove_guest(%L, %L, %L, %s)', A, v_task, 'ana@studio.co', BUDGET),
    'AKB20', 'a guest removed twice');

  -- #2055: an invitation naming an open link of the task returns what the email needs, once.
  v_json := api.v1_add_guest(A, v_task, 'cy@x.co', BUDGET, 'g1');
  assert v_json -> 'guest' ->> 'email' = 'cy@x.co' and v_json -> 'invite' ->> 'inviter' = 'guests-a'
    and v_json -> 'invite' ->> 'title' = 'Pricing'
    and v_json -> 'invite' ->> 'expires_at' = cloud.v1_ts((select expires_at from cloud.share_links where token_hash = 'g1')),
    'a new guest got no invitation';
  update cloud.accounts set name = 'Alex Chen' where id = A;
  assert api.v1_add_guest(A, v_task, 'cy@x.co', BUDGET, 'g1') -> 'invite' = 'null', 'a guest was invited twice';
  assert api.v1_add_guest(A, v_task, 'dee@x.co', BUDGET) -> 'invite' = 'null', 'an invitation with no link was mailed';
  perform api.v1_remove_guest(A, v_task, 'cy@x.co', BUDGET);
  assert api.v1_add_guest(A, v_task, 'cy@x.co', BUDGET, 'g1') -> 'invite' ->> 'inviter' = 'Alex Chen',
    'a guest invited again after removal got no invitation';
  perform api.v1_create_share_link(A, v_task, '{}', 'g3', BUDGET);
  update cloud.share_links set revoked_at = now() where token_hash = 'g3';
  perform api.v1_create_share_link(A, v_task, '{}', 'g4', BUDGET);
  update cloud.share_links set expires_at = now() - interval '1 second' where token_hash = 'g4';
  foreach v_prompt in array array['g2', 'g3', 'g4', 'nope'] loop
    perform pg_temp.refuses(format('select api.v1_add_guest(%L, %L, %L, %s, %L)', A, v_task, 'eve@x.co', BUDGET, v_prompt),
      'AKB28', format('link %s was taken for an invitation', v_prompt));
  end loop;
  assert not exists (select 1 from cloud.task_guests where task_id = v_task and email = 'eve@x.co'),
    'a refused invitation kept the guest';

  raise notice 'sql checks: #2027 guest and chat checks passed';
end
$guests$;

-- #2045: workspaces and their members — access is membership, from the next call on.
do $workspaces$
declare
  O constant uuid := 'a0a0a0a0-2045-4045-8045-000000000001';
  M constant uuid := 'b0b0b0b0-2045-4045-8045-000000000002';
  X constant uuid := 'c0c0c0c0-2045-4045-8045-000000000003';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  v_ws text;
  v_prj text;
  v_task text;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle, name) values (O, 'ws-owner', 'Olga'), (M, 'ws-member', null), (X, 'ws-stranger', null);
  insert into auth.identities (user_id, provider, identity_data) values
    (O, 'github', '{"user_name": "ws-owner", "email": "olga@studio.co"}'),
    (M, 'email', '{"email": "Mia@Studio.co"}');

  -- Every account starts with its personal workspace.
  v_json := api.v1_list_workspaces(O, null, 20) -> 'data';
  assert jsonb_array_length(v_json) = 1 and (v_json -> 0 ->> 'personal')::boolean and v_json -> 0 ->> 'role' = 'owner'
    and v_json -> 0 ->> 'name' = 'Olga', 'an account had no personal workspace';
  assert api.v1_list_workspaces(M, null, 20) -> 'data' -> 0 ->> 'name' = 'ws-member', 'a nameless account''s workspace misread';
  perform pg_temp.refuses(format('select api.v1_add_member(%L, %L, %L, %s)', O, cloud.v1_personal(O), 'mia@studio.co', BUDGET),
    'AKB21', 'a personal workspace took a member');
  perform pg_temp.refuses(format('select api.v1_delete_workspace(%L, %L, %s)', O, cloud.v1_personal(O), BUDGET),
    'AKB21', 'a personal workspace was deleted');
  perform pg_temp.refuses(format('select api.v1_remove_member(%L, %L, %L, %s)', O, cloud.v1_personal(O), O, BUDGET),
    'AKB21', 'a personal workspace was left');

  -- An owner adds a signed-in account by its email; it joins as a member.
  v_ws := api.v1_create_workspace(O, '{"name": "Studio"}', BUDGET) ->> 'id';
  perform pg_temp.refuses(format('select api.v1_add_member(%L, %L, %L, %s)', O, v_ws, 'nobody@x.co', BUDGET),
    'AKB21', 'an email with no account joined');
  perform pg_temp.refuses(format('select api.v1_add_member(%L, %L, %L, %s)', X, v_ws, 'mia@studio.co', BUDGET),
    'AKB20', 'a stranger added a member');
  v_json := api.v1_add_member(O, v_ws, 'mia@studio.co', BUDGET);
  assert v_json ->> 'role' = 'member' and v_json ->> 'account' = M::text and v_json ->> 'email' = 'mia@studio.co',
    'a member did not join as a member';
  perform pg_temp.refuses(format('select api.v1_add_member(%L, %L, %L, %s)', M, v_ws, 'olga@studio.co', BUDGET),
    'AKB14', 'a member managed members');
  perform pg_temp.refuses(format('select api.v1_update_workspace(%L, %L, %L, %s)', M, v_ws, '{"name": "x"}', BUDGET),
    'AKB14', 'a member renamed the workspace');
  assert jsonb_array_length(api.v1_list_members(M, v_ws) -> 'data') = 2, 'a member did not see the members';
  assert jsonb_array_length(api.v1_list_workspaces(M, null, 20) -> 'data') = 2, 'a member did not see the workspace';
  perform pg_temp.refuses(format('select api.v1_list_members(%L, %L)', X, v_ws), 'AKB20', 'a stranger listed the members');

  -- A member works on the whole workspace; the task is theirs, its usage the creator's.
  v_prj := api.v1_create_project(O, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_json := api.v1_create_task(M, jsonb_build_object('title', 'Loose', 'workspace', v_ws), WF, BUDGET);
  assert v_json ->> 'workspace' = v_ws and v_json ->> 'key' = 'TASK-1', 'a shared workspace''s task with no project misread';
  assert (select general from cloud.projects where id = v_json ->> 'project'), 'a shared workspace''s loose task had a project';
  assert cloud.v1_general(v_ws) <> cloud.v1_general(cloud.v1_personal(M)), 'a shared workspace shared the personal tasks with no project';
  assert api.v1_task(O, v_json ->> 'id') ->> 'id' = v_json ->> 'id', 'another member did not see a task with no project';
  delete from cloud.tasks where id = v_json ->> 'id';
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', M,
    jsonb_build_object('title', 't', 'workspace', cloud.v1_personal(M), 'project', v_prj), WF, BUDGET),
    'AKB20', 'a task named a project of another workspace');
  v_json := api.v1_create_task(M, jsonb_build_object('title', 'Landing', 'project', v_prj), WF, BUDGET);
  v_task := v_json ->> 'id';
  assert v_json ->> 'workspace' = v_ws and v_json ->> 'created_by' = 'ws-member', 'a member''s task misread';
  assert api.v1_task_id(O, 'S', 1) = v_task, 'a key did not find a task in a shared workspace';
  perform pg_temp.review(v_task, 'ready');
  assert api.v1_update_task(O, v_task, '{"title": "Landing v2"}', BUDGET) ->> 'title' = 'Landing v2', 'an owner could not edit a member''s task';
  perform pg_temp.refuses(format('select api.v1_task(%L, %L)', X, v_task), 'AKB20', 'a stranger read the task');
  assert jsonb_array_length(api.v1_list_tasks(O, v_ws, null, null, null, 20) -> 'data') = 1, 'the workspace''s tasks were not listed';
  assert jsonb_array_length(api.v1_list_tasks(O, null, null, null, null, 20) -> 'data') = 0, 'a list left the personal workspace';
  update cloud.tasks set status = 'running' where id = v_task;
  assert cloud.v1_open_tasks(O) = 1 and cloud.v1_open_tasks(M) = 0, 'a member''s task counted against their own plan';
  assert api.v1_payer(M, 'task', v_task) = O and api.v1_payer(M, 'target', null) = M, 'the plan was not the creator''s';
  v_json := api.v1_project(O, v_prj) -> 'counts';
  assert v_json ->> 'tasks' = '1' and v_json ->> 'others_tasks' = '1' and v_json ->> 'others' = '1',
    'an owner''s counts missed a member''s task';
  assert api.v1_project(M, v_prj) -> 'counts' ->> 'others_tasks' = '0', 'a member''s own task counted as another''s';
  perform pg_temp.refuses(format('select api.v1_delete_project(%L, %L, %s)', M, v_prj, BUDGET),
    'AKB14', 'a member deleted a shared project');

  -- Owners alone invite guests, open a link to anyone, and change links; members make invited ones.
  perform pg_temp.refuses(format('select api.v1_add_guest(%L, %L, %L, %s)', M, v_task, 'ana@x.co', BUDGET), 'AKB14', 'a member invited a guest');
  perform pg_temp.refuses(format('select api.v1_create_share_link(%L, %L, %L, %L, %s)', M, v_task, '{"access": "link"}', 'w0', BUDGET),
    'AKB14', 'a member opened a link to anyone');
  v_json := api.v1_create_share_link(M, v_task, '{}', 'w1', BUDGET);
  perform pg_temp.refuses(format('select api.v1_revoke_share_link(%L, %L, %s)', M, v_json ->> 'id', BUDGET), 'AKB14', 'a member revoked a link');
  perform api.v1_add_guest(O, v_task, 'ana@x.co', BUDGET);

  -- The review page names each role; members chat like owners, guests do not.
  assert api.v1_shared('w1', M, 'mia@studio.co') ->> 'role' = 'member', 'a member opened as no member';
  assert api.v1_shared('w1', O, 'olga@studio.co') ->> 'role' = 'owner', 'an owner opened as no owner';
  assert api.v1_shared('w1', X, 'ana@x.co') ->> 'role' = 'guest', 'a guest opened as no guest';
  assert api.v1_shared('w1', M, 'mia@studio.co') -> 'guests' is null, 'a member saw the guests';
  assert api.v1_shared_chat('w1', M, null) ->> 'object' = 'task_chat', 'a member could not read the chat';
  perform pg_temp.refuses(format('select api.v1_shared_chat(%L, %L, %L)', 'w1', X, 'ana@x.co'), 'AKB25', 'a guest read the chat');

  -- Alerts go to the task's creator alone: an owner's comment tells the member who started it.
  perform api.v1_create_comment(O, v_task, 'Bigger CTA', '{"kind": "user", "handle": "ws-owner"}', BUDGET);
  assert (select count(*) from cloud.alerts where account_id = M and kind = 'comment') = 1, 'the task''s creator was not told';
  assert not exists (select 1 from cloud.alerts where account_id = O), 'someone else was alerted';

  -- Events: every workspace the account is in, an alert for its account alone.
  v_json := api.v1_list_events(M, 0, 100) -> 'data';
  assert v_json @> '[{"type": "task.created"}]' and v_json @> '[{"type": "alert.created"}]', 'a member missed the workspace''s events';
  assert not (api.v1_list_events(O, 0, 100) -> 'data') @> '[{"type": "alert.created"}]', 'an owner read a member''s alert';
  assert jsonb_array_length(api.v1_list_events(X, 0, 100) -> 'data') = 0, 'a stranger read the workspace''s events';

  -- Roles: the creator always stays an owner.
  perform api.v1_update_member(O, v_ws, M, 'owner', BUDGET);
  perform pg_temp.refuses(format('select api.v1_update_member(%L, %L, %L, %L, %s)', M, v_ws, O, 'member', BUDGET),
    'AKB16', 'the creator was made a member');
  perform pg_temp.refuses(format('select api.v1_remove_member(%L, %L, %L, %s)', O, v_ws, O, BUDGET),
    'AKB16', 'the creator left');
  perform api.v1_update_member(M, v_ws, M, 'member', BUDGET);

  -- Removed, a member reads, writes and decides nothing more.
  perform api.v1_remove_member(O, v_ws, M, BUDGET);
  perform pg_temp.refuses(format('select api.v1_task(%L, %L)', M, v_task), 'AKB20', 'a removed member read a task');
  perform pg_temp.refuses(format('select api.v1_update_task(%L, %L, %L, %s)', M, v_task, '{"title": "x"}', BUDGET),
    'AKB20', 'a removed member wrote a task');
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', M, v_task, '{"decision": "approve"}',
    '{"kind": "user", "handle": "ws-member"}', BUDGET), 'AKB20', 'a removed member decided');
  perform pg_temp.refuses(format('select api.v1_shared(%L, %L, %L)', 'w1', M, 'mia@studio.co'), 'AKB25', 'a removed member opened the review');
  perform pg_temp.refuses(format('select api.dispatch_runner_job(%L, %L, null, %L, %L, %s, %L)', M, 'codex', 'Build', '[]', BUDGET, v_task),
    'AKB20', 'a removed member''s Runner took the task');
  assert not (api.v1_list_events(M, 0, 100) -> 'data') @> jsonb_build_array(jsonb_build_object('workspace', v_ws)),
    'a removed member read the workspace''s events';
  assert jsonb_array_length(api.v1_list_alerts(M, null, null, 20) -> 'data') = 0, 'a removed member kept the workspace''s alerts';
  assert jsonb_array_length(api.v1_list_workspaces(M, null, 20) -> 'data') = 1, 'a removed member still listed the workspace';

  -- A member leaves by removing themself.
  perform api.v1_add_member(O, v_ws, 'mia@studio.co', BUDGET);
  perform api.v1_remove_member(M, v_ws, M, BUDGET);
  assert not cloud.v1_in(M, v_ws), 'a member could not leave';

  -- An owner deletes a project with a member's task in it.
  perform api.v1_delete_project(O, v_prj, BUDGET);
  assert not exists (select 1 from cloud.tasks where id = v_task), 'an owner''s delete left a member''s task';

  -- Deleting takes everything in it.
  perform api.v1_add_member(O, v_ws, 'mia@studio.co', BUDGET);
  perform pg_temp.refuses(format('select api.v1_delete_workspace(%L, %L, %s)', M, v_ws, BUDGET), 'AKB14', 'a member deleted the workspace');
  perform api.v1_delete_workspace(O, v_ws, BUDGET);
  assert not exists (select 1 from cloud.tasks where id = v_task) and not exists (select 1 from cloud.projects where id = v_prj)
    and exists (select 1 from cloud.dropped_boards where board = v_ws)
    and not exists (select 1 from cloud.api_events where workspace_id = v_ws), 'a deleted workspace left its content';

  raise notice 'sql checks: #2045 workspace checks passed';
end
$workspaces$;

-- #2006: artifact components — an account's own, pinned as submitted, reached only through
-- the review that uses them.
do $components$
declare
  A constant uuid := 'a0a0a0a0-2006-4006-8006-000000000001';
  B constant uuid := 'b0b0b0b0-2006-4006-8006-000000000002';
  R constant uuid := 'c0c0c0c0-2006-4006-8006-000000000003';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "Subs"}';
  M1 constant jsonb := '{"title": {"en": "Subtitles", "zh": "字幕"}, "types": ["@cmp-a/subtitles"]}';
  M2 constant jsonb := '{"title": {"en": "Subtitles", "zh": "字幕"}, "types": ["@cmp-a/subtitles"], "schema": {"type": "array"}}';
  v_task text;
  v_art text;
  v_other text;
  v_team text;
  v_hash1 text;
  v_hash2 text;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'Cmp-A'), (B, 'cmp-b');

  -- Published under the account's own types, once per version.
  perform pg_temp.refuses(format('select api.v1_create_component(%L, %L, %L, %L, %s)', A, 'subs', '1.0.0',
    '{"title": {"en": "S", "zh": "S"}, "types": ["@cmp-b/subtitles"]}', BUDGET), 'AKB21', 'a component took another account''s type');
  v_json := api.v1_create_component(A, 'subs', '1.0.0', M1, BUDGET);
  assert v_json ->> 'object' = 'component_version' and not (v_json ->> 'uploaded')::boolean and v_json ? 'id', 'a new version misread';
  assert api.v1_create_component(A, 'subs', '1.0.0', M1, BUDGET) ->> 'id' = v_json ->> 'id', 'an unfinished version was not answered again';
  v_hash1 := api.v1_component_upload_target(A, 'subs', '1.0.0') ->> 'stored';
  assert v_hash1 ~ '^[a-f0-9]{32}$', 'a version had no host';
  perform pg_temp.refuses(format('select api.v1_component_upload_target(%L, %L, %L)', B, 'subs', '1.0.0'), 'AKB20', 'B uploaded A''s version');
  perform pg_temp.refuses(format('select api.v1_finish_component(%L, %L, %L, 10, %s)', B, 'subs', '1.0.0', BUDGET), 'AKB20', 'B finished A''s version');
  perform api.v1_finish_component(A, 'subs', '1.0.0', 10, BUDGET);
  perform pg_temp.refuses(format('select api.v1_create_component(%L, %L, %L, %L, %s)', A, 'subs', '1.0.0', M1, BUDGET),
    'AKB21', 'a published version was published again');
  perform pg_temp.refuses(format('select api.v1_component_upload_target(%L, %L, %L)', A, 'subs', '1.0.0'), 'AKB21', 'a published bundle was replaced');
  perform pg_temp.refuses(format('select api.v1_create_component(%L, %L, %L, %L, %s)', A, 'other', '1.0.0', M1, BUDGET),
    'AKB21', 'two components drew one type');

  -- The account's own list; nobody else's.
  assert jsonb_array_length(api.v1_list_components(A) -> 'data') = 1, 'the account''s components were not listed';
  assert api.v1_list_components(B) -> 'data' = '[]', 'B listed A''s components';
  perform pg_temp.refuses(format('select api.v1_component(%L, %L)', B, 'subs'), 'AKB20', 'B read A''s component');
  perform pg_temp.refuses(format('select api.v1_delete_component_version(%L, %L, %L, %s)', B, 'subs', '1.0.0', BUDGET),
    'AKB20', 'B removed A''s version');

  -- A version written pins the newest published component version; a later one changes nothing.
  v_task := api.v1_create_task(A, '{"title": "Subtitles"}', WF, BUDGET) ->> 'id';
  perform pg_temp.review(v_task, 'ready');
  v_art := api.v1_create_artifact(A, v_task, '{"type": "@cmp-a/subtitles"}', BUDGET) ->> 'id';
  v_json := api.v1_create_artifact_version(A, v_art, '[{"text": "Hi"}]', null, BUDGET);
  assert v_json -> 'component' = '{"name": "subs", "version": "1.0.0"}', 'a version did not pin its component';
  perform api.v1_create_component(A, 'subs', '1.1.0', M2, BUDGET);
  assert api.v1_artifact_version(A, v_art, 1) -> 'component' ->> 'version' = '1.0.0', 'an unfinished version was pinned';
  perform api.v1_finish_component(A, 'subs', '1.1.0', 10, BUDGET);
  v_hash2 := (select hash from cloud.component_versions where version = '1.1.0' and account_id = A);
  assert api.v1_artifact_version(A, v_art, 1) -> 'component' ->> 'version' = '1.0.0', 'publishing moved a pinned version';
  assert api.v1_create_artifact_version(A, v_art, '[{"text": "Hey"}]', null, BUDGET) -> 'component' ->> 'version' = '1.1.0',
    'a new version did not pin the newest component';
  -- B's task of the same type draws with nothing.
  v_other := api.v1_create_artifact(B, api.v1_create_task(B, '{"title": "Theirs"}', WF, BUDGET) ->> 'id',
    '{"type": "@cmp-a/subtitles"}', BUDGET) ->> 'id';
  assert api.v1_create_artifact_version(B, v_other, '[]', null, BUDGET) -> 'component' = 'null', 'B''s task used A''s component';

  -- A guest cannot write a version; the link reaches only the components under review.
  perform api.v1_create_share_link(A, v_task, '{}', 'c1', BUDGET);
  perform api.v1_add_guest(A, v_task, 'ana@studio.co', BUDGET);
  perform pg_temp.refuses(format('select api.v1_create_artifact_version(%L, %L, %L, null, %s)', R, v_art, '[]', BUDGET),
    'AKB20', 'a guest wrote a version');
  v_json := api.v1_shared_component('c1', R, 'ana@studio.co', 'subs', '1.0.0');
  assert v_json ->> 'stored' = v_hash1 and v_json -> 'title' ->> 'zh' = '字幕', 'the link missed its component';
  assert api.v1_shared('c1', R, 'ana@studio.co') -> 'artifacts' -> 0 -> 'versions' -> -1 -> 'component' ->> 'version' = '1.1.0',
    'the review missed its pin';
  perform api.v1_create_component(A, 'unused', '1.0.0', '{"title": {"en": "U", "zh": "U"}, "types": ["@cmp-a/unused"]}', BUDGET);
  perform api.v1_finish_component(A, 'unused', '1.0.0', 10, BUDGET);
  perform pg_temp.refuses(format('select api.v1_shared_component(%L, %L, %L, %L, %L)', 'c1', R, 'ana@studio.co', 'unused', '1.0.0'),
    'AKB20', 'the link reached a component its review does not use');

  -- An owner's save in the component moves the card's pins with it; nobody else saves.
  perform pg_temp.save_card(A, v_task, jsonb_build_object('body', 'Subs', 'metadata', '{"priority": "high"}'::jsonb,
    'assets', jsonb_build_object('subs.json', jsonb_build_object('artifact', v_art, 'version', 1))), 0, BUDGET);
  v_json := api.v1_save_artifact_version(A, v_art, '[{"text": "Edited"}]', BUDGET);
  assert (pg_temp.card(A, v_task) -> 'assets' -> 'subs.json' ->> 'version')::integer = (v_json ->> 'version')::integer
    and pg_temp.card(A, v_task) -> 'metadata' ->> 'priority' = 'high', 'a save did not move the card''s pin';
  perform pg_temp.refuses(format('select api.v1_save_artifact_version(%L, %L, %L, %s)', R, v_art, '[]', BUDGET),
    'AKB20', 'a guest saved through a component');
  insert into auth.identities (user_id, provider, identity_data) values (B, 'email', '{"email": "b@cmp.co"}');
  v_json := api.v1_create_workspace(A, '{"name": "Team"}', BUDGET);
  perform api.v1_add_member(A, v_json ->> 'id', 'b@cmp.co', BUDGET);
  v_json := api.v1_create_project(A, jsonb_build_object('name', 'Team', 'workspace', v_json ->> 'id'), BUDGET);
  v_other := api.v1_create_artifact(B, api.v1_create_task(B, jsonb_build_object('title', 'Team', 'project', v_json ->> 'id'), WF, BUDGET) ->> 'id',
    '{"type": "@cmp-a/subtitles"}', BUDGET) ->> 'id';
  perform pg_temp.refuses(format('select api.v1_save_artifact_version(%L, %L, %L, %s)', B, v_other, '[]', BUDGET),
    'AKB14', 'a member saved through a component');
  -- #2082: a member reads the component their artifact version pinned; nobody outside does.
  v_team := api.v1_create_artifact(A, api.v1_create_task(A, jsonb_build_object('title', 'Ours', 'project', v_json ->> 'id'), WF, BUDGET) ->> 'id',
    '{"type": "@cmp-a/subtitles"}', BUDGET) ->> 'id';
  perform api.v1_create_artifact_version(A, v_team, '[]', null, BUDGET);
  v_json := api.v1_artifact_component(B, v_team, 1);
  assert v_json ->> 'stored' = v_hash2 and v_json ->> 'version' = '1.1.0', 'a member missed the pinned component';
  perform pg_temp.refuses(format('select api.v1_artifact_component(%L, %L, 1)', R, v_team), 'AKB20', 'an outsider read a pinned component');
  perform api.v1_create_artifact_version(B, v_other, '[]', null, BUDGET);
  perform pg_temp.refuses(format('select api.v1_artifact_component(%L, %L, 1)', B, v_other), 'AKB20', 'a version with no pin answered one');

  -- Removed: the link refuses it, its number stays taken, and new versions pin past it.
  v_json := api.v1_delete_component_version(A, 'subs', '1.1.0', BUDGET);
  assert (v_json ->> 'deleted')::boolean and v_json ->> 'stored' = v_hash2, 'a removal misread';
  perform pg_temp.refuses(format('select api.v1_shared_component(%L, %L, %L, %L, %L)', 'c1', R, 'ana@studio.co', 'subs', '1.1.0'),
    'AKB20', 'a removed component was reached');
  perform pg_temp.refuses(format('select api.v1_artifact_component(%L, %L, 1)', B, v_team), 'AKB20', 'a member reached a removed component');
  perform pg_temp.refuses(format('select api.v1_create_component(%L, %L, %L, %L, %s)', A, 'subs', '1.1.0', M2, BUDGET),
    'AKB21', 'a removed version number was reused');
  assert api.v1_create_artifact_version(A, v_art, '[]', null, BUDGET) -> 'component' ->> 'version' = '1.0.0',
    'a new version pinned a removed component';

  raise notice 'sql checks: #2006 component checks passed';
end
$components$;

-- #2020: tasks the Runner works with akb, one flow job per step, and each person's own chat.

/** Claims the run task's waiting step and finishes it, its card saved first as a Runner does;
 *  answers the step. */
create function pg_temp.step(p_owner uuid, p_machine uuid, p_task text, p_outcome text, p_reason text, p_report jsonb)
returns cloud.runner_jobs language plpgsql as $fn$
declare
  j cloud.runner_jobs := cloud.v1_flow_job(p_task);
begin
  if j.id is null then raise exception 'no step is waiting on %', p_task; end if;
  if not (api.claim_runner_job(p_owner, p_machine, j.id, 900, 100000) ->> 'claimed')::boolean then
    raise exception 'the step on % could not be claimed', p_task;
  end if;
  if p_outcome = 'done' and (select card_path from cloud.tasks where id = p_task) is null then
    perform pg_temp.save_card(p_owner, p_task, '{"body": "Card"}', 0, 100000);
  end if;
  perform api.finish_runner_job(p_owner, p_machine, j.id, p_outcome, p_reason, 100000, p_report);
  return j;
end;
$fn$;

/** A decision on the task's review. */
create function pg_temp.decide(p_account uuid, p_task text, p_decision text, p_comment text default null)
returns jsonb language sql as $fn$
  select api.v1_create_decision(p_account, t.id, jsonb_strip_nulls(jsonb_build_object('decision', p_decision,
    'comment', p_comment, 'review_revision', t.review_revision)), '{"kind": "user", "handle": "run-a"}', 100000)
  from cloud.tasks t where t.id = p_task;
$fn$;

do $run_tasks$
declare
  A constant uuid := 'a0a0a0a0-2020-4020-8020-000000000001';
  M constant uuid := 'b0b0b0b0-2020-4020-8020-000000000002';
  HOME constant uuid := 'cccccccc-2020-4020-8020-000000000003';
  BUDGET constant integer := 100000;
  RUNTIMES constant jsonb := '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]';
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  BLOG constant jsonb := '{"id": "wf_builtin_blog_post", "builtin": true, "name": "Blog post", "lands": false,
    "hash": "b1", "files": {"WORKFLOW.md": "blog"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_other text;
  v_job cloud.runner_jobs;
  v_chat uuid;
  v_seq bigint;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'run-a'), (M, 'run-m');
  insert into auth.identities (user_id, provider, identity_data) values (M, 'email', '{"email": "m@run.co"}');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', RUNTIMES, false, 900, BUDGET);

  -- Start: the task waits for its first step, and the request opens the creator's chat.
  select coalesce(max(seq), 0) into v_seq from cloud.api_events;
  v_json := api.v1_create_task(A, '{"title": "Pricing", "request": "Build a pricing page.", "run": true}', CODING, BUDGET);
  v_task := v_json ->> 'id';
  assert v_json ->> 'status' = 'queued' and v_json -> 'run' ->> 'state' = 'queued'
    and (v_json -> 'run' ->> 'runner_connected')::boolean and v_json ->> 'last_job' = v_json -> 'run' ->> 'job'
    and v_json -> 'result' = 'null' and v_json -> 'failure' = 'null', 'a run task did not wait for its first step';
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.flow = '{"verb": "create", "workflow": "wf_builtin_coding", "text": "Build a pricing page.", "title": "Pricing"}'
    and v_job.runtime = 'claude-code' and v_job.owner_id = A, 'the first step misread';
  assert (api.list_runner_jobs(A, HOME) -> 0 -> 'flow' ->> 'verb') = 'create', 'the Runner did not read the step''s flow';
  v_json := api.v1_task_chat(A, v_task);
  assert v_json ->> 'status' = 'replying' and jsonb_array_length(v_json -> 'messages') = 1
    and v_json -> 'messages' -> 0 ->> 'body' = 'Build a pricing page.', 'the request did not open the chat';
  assert api.v1_list_chats(A, null, null, 20) -> 'data' -> 0 ->> 'state' = 'replying', 'a chat waiting on its step was not replying';
  assert exists (select 1 from cloud.api_events where seq > v_seq and type = 'chat.updated' and account_id = A
    and data = jsonb_build_object('task', v_task, 'state', 'replying')), 'the chat change was not told to its member';
  assert (api.v1_create_task(A, '{"title": "Plain"}', CODING, BUDGET) -> 'run') = 'null', 'a task without run was handed over';

  -- A claimed step makes the task running; done, its draft waits for review and the agent answers.
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  assert api.v1_task(A, v_task) -> 'run' ->> 'state' = 'running' and api.v1_task(A, v_task) ->> 'status' = 'running',
    'a claimed step did not run the task';
  perform pg_temp.save_card(A, v_task, '{"body": "Plan"}', 0, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"card": 7, "reply": "Planned two tiers."}');
  v_json := api.v1_task(A, v_task);
  assert v_json ->> 'status' = 'waiting_review' and v_json -> 'run' = 'null' and v_json ->> 'last_job' = v_job.id::text,
    'a finished step did not submit its draft';
  v_json := api.v1_task(A, v_task) -> 'review';
  assert v_json ->> 'status' = 'ready' and v_json ->> 'question' = 'Approve this plan?' and v_json -> 'options' =
    '[{"label": "Approve", "approve": true}, {"label": "Request changes", "approve": false}]'
    and v_json -> 'card_question' = 'null', 'the default review misread';
  assert exists (select 1 from cloud.alerts where task_id = v_task and phase = 1 and kind = 'review'), 'a first draft raised no review alert';
  v_json := api.v1_task_chat(A, v_task);
  assert v_json ->> 'status' = 'idle' and v_json -> 'messages' -> 1 ->> 'role' = 'agent'
    and v_json -> 'messages' -> 1 ->> 'body' = 'Planned two tiers.', 'the agent''s summary did not answer the chat';
  assert api.v1_list_chats(A, null, null, 20) -> 'data' -> 0 ->> 'state' = 'waiting_you', 'a planned task was not waiting for its creator';

  -- Request changes: the Runner revises, on the card it reported.
  perform pg_temp.decide(A, v_task, 'request_changes', 'Fewer tiers.');
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.flow = '{"verb": "revise", "workflow": "wf_builtin_coding", "card": 7, "text": "Fewer tiers."}',
    'a change asked did not revise';
  assert api.v1_task(A, v_task) ->> 'status' = 'queued', 'a revising task was not queued';
  assert api.v1_list_chats(A, null, null, 20) -> 'data' -> 0 ->> 'state' = 'idle', 'a queued task''s chat was not idle';
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', A, v_task,
    jsonb_build_object('decision', 'approve', 'review_revision', (select review_revision from cloud.tasks where id = v_task)),
    '{"kind": "user", "handle": "run-a"}', BUDGET), 'AKB21', 'a decision while the agent works');

  -- The card's open question is the next review, with no approving option.
  perform pg_temp.step(A, HOME, v_task, 'done', null,
    '{"card": 7, "review": {"question": "Which currency?", "options": ["USD", "EUR"], "position": 2}}');
  v_json := api.v1_task(A, v_task) -> 'review';
  assert v_json ->> 'question' = 'Which currency?' and (v_json ->> 'card_question')::int = 2
    and v_json -> 'options' = '[{"label": "USD", "approve": false}, {"label": "EUR", "approve": false}]',
    'the card''s question was not the review';

  -- Answering it through the review page resolves it, naming the question.
  perform api.v1_create_share_link(A, v_task, '{}', 'run1', BUDGET);
  perform api.v1_shared_decide('run1', A, null, 1, null, (v_json ->> 'revision')::int, BUDGET);
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.flow ->> 'verb' = 'resolve' and v_job.flow ->> 'text' = E'Which currency?\n\nEUR', 'an answer did not resolve the question';

  -- The resolved card has two drafting stages: each approval approves the stage, the last builds.
  perform pg_temp.save_card(A, v_task, jsonb_build_object('body', 'Plan', 'metadata', '{"phase": 1, "stages": 2}'::jsonb),
    (select card_version from cloud.tasks where id = v_task), BUDGET);
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"card": 7}');
  assert (select review_status || '/' || review_phase from cloud.tasks where id = v_task) = 'ready/1',
    'the first stage was not submitted';
  perform pg_temp.decide(A, v_task, 'approve');
  assert (cloud.v1_flow_job(v_task)).flow ->> 'verb' = 'approve' and (pg_temp.card(A, v_task) -> 'metadata' ->> 'phase')::int = 2,
    'approving a stage with one left did not approve it';
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"card": 7, "reply": "Drafted."}');
  assert (select review_status || '/' || review_phase from cloud.tasks where id = v_task) = 'ready/2', 'the second stage was not submitted';
  perform pg_temp.decide(A, v_task, 'approve');
  assert (cloud.v1_flow_job(v_task)).flow ->> 'verb' = 'implement', 'approving the last stage did not build';
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"reply": "Shipped the pricing page.", "landing": {"commit": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678", "branch": "main"}}');
  v_json := api.v1_task(A, v_task);
  assert v_json ->> 'status' = 'done' and v_json ->> 'result' = 'Shipped the pricing page.' and v_json -> 'run' = 'null',
    'a built task did not end with its summary';
  -- #2109: where it landed, named as the computer was then, and asked of that computer.
  assert v_json -> 'landing' = jsonb_build_object('commit', 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', 'branch', 'main',
    'machine', (select machine_name from cloud.runners where owner_id = A)), format('the landing misread: %s', v_json -> 'landing');
  v_json := api.v1_task_landing(A, v_task);
  assert v_json ->> 'owner' = A::text and v_json ->> 'machine' = HOME::text and (v_json ->> 'online')::boolean,
    format('the landed computer misread: %s', v_json);
  perform api.hint_runner_diff(A, 'req-1', v_json ->> 'project', v_json ->> 'commit');

  -- A build held on a question asks it; the answer carries the build on.
  v_task := api.v1_create_task(A, '{"title": "Hold", "run": true}', CODING, BUDGET) ->> 'id';
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"card": 8}');
  perform pg_temp.decide(A, v_task, 'approve');
  perform pg_temp.step(A, HOME, v_task, 'done', null,
    '{"card": 8, "review": {"question": "Keep the old page?", "options": ["Yes", "No"], "position": 1}}');
  assert api.v1_task(A, v_task) ->> 'status' = 'waiting_review', 'a held build ended the task';
  perform pg_temp.decide(A, v_task, 'request_changes', 'No');
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.flow ->> 'verb' = 'implement' and v_job.flow ->> 'text' = E'Keep the old page?\n\nNo',
    'an answer to a held build did not carry it on';
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"reply": "Built."}');
  assert api.v1_task(A, v_task) ->> 'status' = 'done', 'the carried-on build did not end the task';
  assert api.v1_task(A, v_task) -> 'landing' = 'null' and api.v1_task_landing(A, v_task) is null,
    'a build that landed nothing named a landing';

  -- A workflow delivering its plan ends at the last approval, with the last step's summary.
  v_task := api.v1_create_task(A, '{"title": "发布文章", "request": "写一篇发布文章", "run": true}', BLOG, BUDGET) ->> 'id';
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"reply": "大纲已写好。"}');
  assert (select review ->> 'question' from cloud.tasks where id = v_task) = '批准这份方案？',
    'a Chinese request was not asked in Chinese';
  perform pg_temp.decide(A, v_task, 'approve');
  v_json := api.v1_task(A, v_task);
  assert v_json ->> 'status' = 'done' and v_json ->> 'result' = '大纲已写好。' and v_json -> 'run' = 'null',
    'a plan-delivering task did not end with its summary';

  -- A failed step fails the task with its reason, and the chat it answered.
  v_task := api.v1_create_task(A, '{"title": "Fail", "run": true}', CODING, BUDGET) ->> 'id';
  perform pg_temp.step(A, HOME, v_task, 'failed', 'akb exited with code 1.', null);
  v_json := api.v1_task(A, v_task);
  assert v_json ->> 'status' = 'failed' and v_json ->> 'failure' = 'akb exited with code 1.', 'a failed step did not fail the task';
  assert api.v1_task_chat(A, v_task) ->> 'status' = 'failed', 'a failed first step left the chat replying';

  -- No agent on the computer: the step still goes out, and fails with the Runner's reason.
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', '[{"name": "codex", "installed": false}]', false, 900, BUDGET);
  v_task := api.v1_create_task(A, '{"title": "Nobody", "run": true}', CODING, BUDGET) ->> 'id';
  assert (cloud.v1_flow_job(v_task)).runtime = 'claude-code', 'a step with no agent known was not Claude Code';
  perform pg_temp.step(A, HOME, v_task, 'failed', 'Claude Code or Codex is not available on this computer.', null);
  assert api.v1_task(A, v_task) ->> 'failure' = 'Claude Code or Codex is not available on this computer.',
    'no agent did not fail the task with its reason';
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', '[{"name": "codex", "installed": true}]', false, 900, BUDGET);
  assert (cloud.v1_default_runtime(A)).connector = 'claude-code', 'Global default moved with what the Runner reports (#2074)';

  -- The Runner offline: the step waits, and the task with it.
  update cloud.runners set live_until = now() - interval '1 second' where owner_id = A;
  v_json := api.v1_create_task(A, '{"title": "Later", "run": true}', CODING, BUDGET);
  v_task := v_json ->> 'id';
  assert v_json ->> 'status' = 'queued' and not (v_json -> 'run' ->> 'runner_connected')::boolean,
    'a task for an offline Runner was refused or not waiting';

  -- Cancel: a queued task's waiting steps end with it; a running one is refused.
  v_json := api.v1_cancel_task(A, v_task, BUDGET);
  assert v_json ->> 'status' = 'cancelled' and v_json -> 'run' = 'null', 'a queued task was not cancelled';
  assert (select outcome = 'failed' and reason = 'Cancelled.' from cloud.runner_jobs where task_id = v_task),
    'a cancelled task''s step kept waiting';
  assert api.v1_task_chat(A, v_task) ->> 'status' = 'failed', 'a cancelled task''s chat kept replying';
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', RUNTIMES, false, 900, BUDGET);
  v_task := api.v1_create_task(A, '{"title": "Busy", "run": true}', CODING, BUDGET) ->> 'id';
  perform api.claim_runner_job(A, HOME, (cloud.v1_flow_job(v_task)).id, 900, BUDGET);
  perform pg_temp.refuses(format('select api.v1_cancel_task(%L, %L, %s)', A, v_task, BUDGET), 'AKB26', 'a running task was cancelled');

  -- A step whose lease ran out runs once more (#2081), then fails its task when the Runner
  -- registers again, or at the sweep.
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 second' where task_id = v_task;
  assert api.v1_task(A, v_task) -> 'run' = 'null', 'an interrupted step still read as running';
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', RUNTIMES, false, 900, BUDGET);
  assert (cloud.v1_flow_job(v_task)).attempt = 2 and api.v1_task(A, v_task) ->> 'status' = 'running',
    'a lapsed step was not run again';
  perform api.claim_runner_job(A, HOME, (cloud.v1_flow_job(v_task)).id, 900, BUDGET);
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 second' where task_id = v_task and state = 'claimed';
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', RUNTIMES, false, 900, BUDGET);
  v_json := api.v1_task(A, v_task);
  assert v_json ->> 'status' = 'failed' and v_json ->> 'failure' = 'The Runner stopped before this step finished.',
    'an interrupted step left its task running';
  v_task := api.v1_create_task(A, '{"title": "Swept", "run": true}', CODING, BUDGET) ->> 'id';
  perform api.claim_runner_job(A, HOME, (cloud.v1_flow_job(v_task)).id, 900, BUDGET);
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 second', attempt = 2 where task_id = v_task;
  assert (api.v1_sweep() ->> 'interrupted')::int = 1, 'the sweep failed no interrupted task';
  assert api.v1_task(A, v_task) ->> 'status' = 'failed', 'the sweep left an interrupted task running';

  -- Chats are each person's: a member's runs on the creator's Runner, and nobody reads another's.
  v_ws := api.v1_create_workspace(A, '{"name": "Run studio"}', BUDGET) ->> 'id';
  perform api.v1_add_member(A, v_ws, 'm@run.co', BUDGET);
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_other := api.v1_create_task(A, jsonb_build_object('title', 'Landing', 'request', 'A landing page', 'project', v_prj, 'run', true),
    CODING, BUDGET) ->> 'id';
  perform pg_temp.step(A, HOME, v_other, 'done', null, '{"reply": "Planned."}');
  select coalesce(max(seq), 0) into v_seq from cloud.api_events;
  v_json := api.v1_task_chat_send(M, v_other, 'Make it blue', null, BUDGET);
  assert v_json ->> 'status' = 'replying' and jsonb_array_length(v_json -> 'messages') = 1, 'a member''s chat misread';
  select h.job_id into v_chat from cloud.task_chats h where h.task_id = v_other and h.account_id = M;
  assert (select owner_id from cloud.runner_jobs where id = v_chat) = A, 'a member''s chat did not run on the creator''s Runner';
  assert (select prompt from cloud.runner_jobs where id = v_chat) not like '%landing page%', 'a member''s prompt carried another''s chat';
  assert jsonb_array_length(api.v1_task_chat(A, v_other) -> 'messages') = 2, 'the creator read a member''s message';
  perform api.v1_create_share_link(A, v_other, '{}', 'run2', BUDGET);
  assert api.v1_shared_chat('run2', M, 'm@run.co') -> 'messages' -> 0 ->> 'body' = 'Make it blue',
    'the review page did not read the member''s own chat';
  assert not exists (select 1 from jsonb_array_elements(api.v1_list_events(A, v_seq, 100) -> 'data') e
                     where e ->> 'type' = 'chat.updated'), 'a member''s chat change reached another member';
  assert exists (select 1 from jsonb_array_elements(api.v1_list_events(M, v_seq, 100) -> 'data') e
                 where e ->> 'type' = 'chat.updated'), 'a member''s chat change did not reach them';
  v_json := api.v1_list_chats(M, v_ws, null, 20) -> 'data';
  assert jsonb_array_length(v_json) = 1 and v_json -> 0 ->> 'task' = v_other and v_json -> 0 ->> 'state' = 'replying'
    and v_json -> 0 ->> 'key' = 'S-1' and v_json -> 0 ->> 'project' = v_prj, 'a member''s chats misread';
  assert jsonb_array_length(api.v1_list_chats(M, null, null, 20) -> 'data') = 0, 'chats left their workspace';
  perform api.claim_runner_job(A, HOME, v_chat, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_chat, 'done', '', BUDGET, '{"reply": "Blue it is."}');
  assert api.v1_list_chats(M, v_ws, null, 20) -> 'data' -> 0 ->> 'state' = 'waiting_you', 'a member''s answered chat misread';
  assert jsonb_array_length(api.v1_task_chat(A, v_other) -> 'messages') = 2, 'a member''s reply reached the creator''s chat';
  v_json := api.v1_task_chat_clear(M, v_other, BUDGET);
  assert v_json -> 'messages' = '[]' and jsonb_array_length(api.v1_task_chat(A, v_other) -> 'messages') = 2,
    'clearing a member''s chat touched another''s';

  -- A page of chats, newest message first.
  v_json := api.v1_list_chats(A, null, null, 1);
  assert jsonb_array_length(v_json -> 'data') = 1 and v_json ->> 'next' = v_json -> 'data' -> 0 ->> 'task', 'a chat page misread';
  assert api.v1_list_chats(A, null, v_json ->> 'next', 1) -> 'data' -> 0 ->> 'task' <> v_json ->> 'next', 'the next page repeated a chat';

  -- A step's log is every member's to read; another member's chat job is not.
  assert api.read_runner_job(M, (select id from cloud.runner_jobs where task_id = v_other and flow is not null limit 1))
    -> 'job' -> 'flow' ->> 'verb' = 'create', 'a member could not read a step''s log';
  perform api.v1_task_chat_send(A, v_other, 'Mine', null, BUDGET);
  perform pg_temp.refuses(format('select api.read_runner_job(%L, %L)', M,
    (select h.job_id from cloud.task_chats h where h.task_id = v_other and h.account_id = A)), 'AKB02', 'a member read another''s chat job');

  raise notice 'sql checks: #2020 run task checks passed';
end
$run_tasks$;

-- #2030: official workflows are installed per workspace, by its owners; a task keeps its version.
do $marketplace$
declare
  O constant uuid := 'a0a0a0a0-2030-4030-8030-000000000001';
  M constant uuid := 'b0b0b0b0-2030-4030-8030-000000000002';
  X constant uuid := 'c0c0c0c0-2030-4030-8030-000000000003';
  BUDGET constant integer := 100000;
  V1 constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "mk1", "files": {"WORKFLOW.md": "one"}}';
  V2 constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "mk2", "files": {"WORKFLOW.md": "two"}}';
  v_ws text;
  v_prj text;
  v_old text;
  v_new text;
  v_seq bigint;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (O, 'mk-owner'), (M, 'mk-member'), (X, 'mk-stranger');
  insert into auth.identities (user_id, provider, identity_data) values (M, 'email', '{"email": "m@mk.co"}');

  -- Every listed one comes installed, in a personal workspace and a new shared one alike.
  assert api.v1_installed_workflows(O, null) ? 'wf_builtin_coding'
     and api.v1_installed_workflows(O, null) ? 'wf_builtin_video_clone', 'a personal workspace came without the listed workflows';
  v_ws := api.v1_create_workspace(O, '{"name": "Studio"}', BUDGET) ->> 'id';
  perform api.v1_add_member(O, v_ws, 'm@mk.co', BUDGET);
  v_prj := api.v1_create_project(O, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  assert api.v1_installed_workflows(M, v_ws) ? 'wf_builtin_coding', 'a new workspace came without the listed workflows';

  -- Owners alone install and uninstall; someone outside the workspace finds nothing.
  perform pg_temp.refuses(format('select api.v1_install_workflow(%L, %L, %L, false, %s)', M, v_ws, 'wf_builtin_coding', BUDGET),
    'AKB14', 'a member uninstalled a workflow');
  perform pg_temp.refuses(format('select api.v1_install_workflow(%L, %L, %L, true, %s)', M, v_ws, 'wf_builtin_coding', BUDGET),
    'AKB14', 'a member installed a workflow');
  perform pg_temp.refuses(format('select api.v1_install_workflow(%L, %L, %L, true, %s)', X, v_ws, 'wf_builtin_coding', BUDGET),
    'AKB20', 'a stranger installed a workflow');
  perform pg_temp.refuses(format('select api.v1_installed_workflows(%L, %L)', X, v_ws), 'AKB20', 'a stranger read the installs');

  -- A task started before an uninstall keeps its version; none can start after it.
  v_old := api.v1_create_task(M, jsonb_build_object('title', 'Before', 'project', v_prj), V1, BUDGET) ->> 'id';
  select coalesce(max(seq), 0) into v_seq from cloud.api_events;
  v_json := api.v1_install_workflow(O, v_ws, 'wf_builtin_coding', false, BUDGET);
  assert not (v_json ->> 'installed')::boolean and not api.v1_installed_workflows(M, v_ws) ? 'wf_builtin_coding',
    'an uninstall left the workflow installed';
  assert exists (select 1 from cloud.api_events where seq > v_seq and workspace_id = v_ws and type = 'workflow.uninstalled'),
    'an uninstall wrote no event';
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', M,
    jsonb_build_object('title', 'After', 'project', v_prj), V1, BUDGET), 'AKB20', 'a task started on an uninstalled workflow');
  assert api.v1_task_workflow(M, v_old) -> 'files' ->> 'WORKFLOW.md' = 'one', 'an uninstall reached a task already made';
  assert api.v1_installed_workflows(O, null) ? 'wf_builtin_coding', 'an uninstall reached another workspace';

  -- Installed again, a new task takes the new version and the old task keeps its own.
  perform api.v1_install_workflow(O, v_ws, 'wf_builtin_coding', true, BUDGET);
  perform api.v1_install_workflow(O, v_ws, 'wf_builtin_coding', true, BUDGET);
  assert (select count(*) from cloud.workflow_installs where workspace_id = v_ws and workflow_id = 'wf_builtin_coding') = 1,
    'installing twice installed twice';
  v_new := api.v1_create_task(M, jsonb_build_object('title', 'After', 'project', v_prj), V2, BUDGET) ->> 'id';
  assert (api.v1_task_workflow(M, v_new) ->> 'version')::int = (api.v1_task_workflow(M, v_old) ->> 'version')::int + 1
     and api.v1_task_workflow(M, v_new) -> 'files' ->> 'WORKFLOW.md' = 'two'
     and api.v1_task_workflow(M, v_old) -> 'files' ->> 'WORKFLOW.md' = 'one', 'a new version reached the wrong task';

  -- One listed later is installed by hand, and only new workspaces get it on their own.
  insert into cloud.workflow_listings (workflow_id) values ('wf_builtin_later');
  assert not api.v1_installed_workflows(O, v_ws) ? 'wf_builtin_later', 'a later listing installed itself';
  v_ws := api.v1_create_workspace(O, '{"name": "New"}', BUDGET) ->> 'id';
  assert api.v1_installed_workflows(O, v_ws) ? 'wf_builtin_later', 'a new workspace missed a listed workflow';

  raise notice 'sql checks: #2030 marketplace checks passed';
end
$marketplace$;

-- #2054: the old board workspace is gone — its tables, and every `workspace_id uuid` column.
do $old_workspaces$
begin
  assert not exists (select 1 from pg_tables where schemaname = 'cloud'
                      and (tablename = 'workspaces' or tablename like 'workspace\_%')),
    'an old workspace table is still there';
  assert not exists (select 1 from information_schema.columns where table_schema = 'cloud'
                      and column_name = 'workspace_id' and data_type = 'uuid'),
    'a column still points at an old workspace';
  raise notice 'sql checks: #2054 old workspace checks passed';
end
$old_workspaces$;

-- #2022: an existing project placed on this computer, by any member who sees it.
do $place$
declare
  A constant uuid := 'aaaaaaaa-2022-4022-8022-000000000001';
  B constant uuid := 'bbbbbbbb-2022-4022-8022-000000000002';
  X constant uuid := 'eeeeeeee-2022-4022-8022-000000000005';
  HOME constant uuid := 'cccccccc-2022-4022-8022-000000000003';
  LAPTOP constant uuid := 'dddddddd-2022-4022-8022-000000000004';
  BUDGET constant integer := 100000;
  v_ws text;
  v_team text;
  v_site text;
  v_json json;
begin
  insert into cloud.accounts (id, handle) values (A, 'place-a'), (B, 'place-b'), (X, 'place-x');
  insert into auth.identities (user_id, provider, identity_data) values (B, 'email', '{"email": "b@place.co"}');
  v_ws := api.v1_create_workspace(A, '{"name": "Team"}', BUDGET) ->> 'id';
  perform api.v1_add_member(A, v_ws, 'b@place.co', BUDGET);
  v_team := api.v1_create_project(A, jsonb_build_object('name', 'Docs', 'workspace', v_ws), BUDGET) ->> 'id';
  perform api.register_runner(A, HOME, 'a-mac', 1, '0.2.0', '[]', true, 900, BUDGET);
  perform api.register_runner(B, LAPTOP, 'b-mac', 1, '0.2.0', '[]', true, 900, BUDGET);
  perform api.register_runner(X, LAPTOP, 'x-mac', 1, '0.2.0', '[]', true, 900, BUDGET);
  v_site := api.add_project_folder(A, HOME, 'site', '/Users/a/site', BUDGET) ->> 'project';

  -- A teammate sees the team's project as not on their computer, and places it there.
  v_json := api.list_elsewhere_projects(B, LAPTOP);
  assert json_array_length(v_json) = 1 and v_json -> 0 ->> 'project' = v_team
    and v_json -> 0 ->> 'workspace_name' = 'Team' and not (v_json -> 0 ->> 'personal')::boolean,
    'a teammate did not see the team''s project as elsewhere';
  assert not (api.v1_list_projects(B, v_ws, null, null) -> 'data' -> 0 ->> 'placed')::boolean, 'an unplaced project read as placed';
  v_json := api.add_project_folder(B, LAPTOP, 'ignored', '/Users/b/docs', BUDGET, v_team);
  assert v_json ->> 'project' = v_team and v_json ->> 'name' = 'Docs', 'placing made another project';
  assert json_array_length(api.list_elsewhere_projects(B, LAPTOP)) = 0, 'a placed project was still elsewhere';
  assert (api.v1_list_projects(B, v_ws, null, null) -> 'data' -> 0 ->> 'placed')::boolean, 'a placed project read as unplaced';
  assert not (api.v1_list_projects(A, v_ws, null, null) -> 'data' -> 0 ->> 'placed')::boolean, 'another''s folder placed it for me';

  -- The owner's own project, removed from this computer, comes back as itself.
  assert exists (select 1 from json_array_elements(api.list_elsewhere_projects(A, HOME)) e where e ->> 'project' = v_team),
    'the owner did not see the team''s project as elsewhere';
  assert not exists (select 1 from json_array_elements(api.list_elsewhere_projects(A, HOME)) e where e ->> 'project' = v_site),
    'a placed project was listed as elsewhere';
  perform api.remove_project_folder(A, HOME, v_site, BUDGET);
  assert (select (e ->> 'personal')::boolean from json_array_elements(api.list_elsewhere_projects(A, HOME)) e where e ->> 'project' = v_site),
    'a removed project was not elsewhere in the personal workspace';
  assert api.add_project_folder(A, HOME, 'x', '/Users/a/site2', BUDGET, v_site) ->> 'path' = '/Users/a/site2', 'a removed project was not placed again';

  -- A folder held by another project is refused, naming it; nobody outside sees the project.
  perform pg_temp.refuses(format('select api.add_project_folder(%L, %L, %L, %L, %s, %L)', A, HOME, 'x', '/Users/a/site2', BUDGET, v_team),
    'AKB29', 'a folder held by another project was placed again');
  perform pg_temp.refuses(format('select api.add_project_folder(%L, %L, %L, %L, %s, %L)', X, LAPTOP, 'x', '/Users/x/docs', BUDGET, v_team),
    'AKB20', 'a non-member placed a project');
  assert json_array_length(api.list_elsewhere_projects(X, LAPTOP)) = 0, 'a non-member saw another''s projects';

  raise notice 'sql checks: #2022 place checks passed';
end
$place$;

-- #2066: daily task counts and run usage, by the asked time zone, for members alone.
do $stats$
declare
  O constant uuid := 'a0a0a0a0-2066-4066-8066-000000000001';
  X constant uuid := 'c0c0c0c0-2066-4066-8066-000000000003';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  v_ws text;
  v_prj text;
  v_done text;
  v_cancelled text;
  v_failed text;
  v_rows jsonb;
  v_day jsonb;
begin
  insert into cloud.accounts (id, handle) values (O, 'st-owner'), (X, 'st-stranger');
  v_ws := api.v1_create_workspace(O, '{"name": "Stats"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(O, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_done := api.v1_create_task(O, jsonb_build_object('title', 'Done', 'project', v_prj), WF, BUDGET) ->> 'id';
  v_cancelled := api.v1_create_task(O, jsonb_build_object('title', 'Cancelled', 'project', v_prj), WF, BUDGET) ->> 'id';
  v_failed := api.v1_create_task(O, jsonb_build_object('title', 'Failed', 'project', v_prj), WF, BUDGET) ->> 'id';

  -- Closing stamps closed_at, reopening clears it, and a failure is not a close.
  update cloud.tasks set status = 'done' where id = v_done;
  perform api.v1_cancel_task(O, v_cancelled, BUDGET);
  update cloud.tasks set status = 'failed' where id = v_failed;
  assert (select closed_at is not null from cloud.tasks where id = v_done), 'a done task has no closed_at';
  assert (select closed_at is not null from cloud.tasks where id = v_cancelled), 'a cancelled task has no closed_at';
  assert (select closed_at is null from cloud.tasks where id = v_failed), 'a failed task was closed';
  update cloud.tasks set status = 'queued' where id = v_done;
  assert (select closed_at is null from cloud.tasks where id = v_done), 'a reopened task kept its closed_at';
  update cloud.tasks set status = 'done' where id = v_done;

  -- 2026-03-01 23:30 UTC is 03-02 07:30 in Shanghai.
  update cloud.tasks set created_at = '2026-03-01 23:30+00', closed_at = '2026-03-01 23:45+00' where workspace_id = v_ws;
  insert into cloud.runner_jobs (owner_id, runtime, prompt, task_id, state, outcome, finished_at, usage, cost_usd) values
    (O, 'claude-code', 'p', v_done, 'finished', 'done', '2026-03-01 23:50+00',
     '{"input": 10, "cacheCreation": 20, "cacheRead": 30, "output": 40}', 0.5),
    (O, 'claude-code', 'p', v_cancelled, 'finished', 'done', '2026-03-01 23:55+00', null, 0.25),
    (O, 'claude-code', 'p', v_failed, 'finished', 'failed', '2026-03-01 23:58+00', null, null);

  v_rows := api.v1_workspace_stats(O, v_ws, '2026-03-01', '2026-03-02', 'UTC') -> 'data';
  assert jsonb_array_length(v_rows) = 1, 'a day with nothing was listed';
  v_day := v_rows -> 0;
  assert v_day ->> 'date' = '2026-03-01' and (v_day ->> 'created')::int = 3 and (v_day ->> 'completed')::int = 1
     and (v_day ->> 'rejected')::int = 1, format('the counts were wrong: %s', v_day);
  assert v_day -> 'usage' = '{"input": 10, "cacheCreation": 20, "cacheRead": 30, "output": 40}'
     and (v_day ->> 'costUsd')::numeric = 0.75, format('the usage was wrong: %s', v_day);

  v_rows := api.v1_workspace_stats(O, v_ws, '2026-03-01', '2026-03-02', 'Asia/Shanghai') -> 'data';
  assert jsonb_array_length(v_rows) = 1 and v_rows -> 0 ->> 'date' = '2026-03-02', 'days were not split in the asked zone';
  assert jsonb_array_length(api.v1_workspace_stats(O, v_ws, '2026-03-01', '2026-03-01', 'Asia/Shanghai') -> 'data') = 0,
    'a day outside the range was listed';

  perform pg_temp.refuses(format('select api.v1_workspace_stats(%L, %L, %L, %L, %L)', X, v_ws, '2026-03-01', '2026-03-02', 'UTC'),
    'AKB20', 'a stranger read the stats');
  perform pg_temp.refuses(format('select api.v1_workspace_stats(%L, %L, %L, %L, %L)', O, v_ws, '2026-03-01', '2026-03-02', 'Mars/Base'),
    'AKB28', 'an unknown time zone was taken');

  raise notice 'sql checks: #2066 stats checks passed';
end
$stats$;

-- #2074: each account's runtimes, the one a task runs on, and a connection test.

do $runtimes$
declare
  A constant uuid := 'a0a0a0a0-2074-4074-8074-000000000001';
  X constant uuid := 'b0b0b0b0-2074-4074-8074-000000000002';
  HOME constant uuid := 'cccccccc-2074-4074-8074-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_list jsonb;
  v_default text;
  v_light text;
  v_task text;
  v_job cloud.runner_jobs;
  v_test jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'rt-a'), (X, 'rt-x');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0',
    '[{"name": "claude-code", "installed": true, "loggedIn": false}, {"name": "codex", "installed": true}]', false, 900, BUDGET);

  -- Global default is made on first read, by the old pick: Claude Code is signed out, so Codex.
  v_list := api.v1_list_runtimes(A);
  assert jsonb_array_length(v_list -> 'data') = 1 and (v_list -> 'data' -> 0 ->> 'default')::boolean
    and v_list -> 'data' -> 0 ->> 'connector' = 'codex' and v_list -> 'data' -> 0 -> 'model' = 'null',
    format('Global default was not made by the old pick: %s', v_list);
  assert v_list -> 'connectors' = '{"claude-code": "signed_out", "codex": "ready"}' and (v_list ->> 'runner_connected')::boolean,
    format('the connectors misread: %s', v_list);
  assert v_list -> 'models' = '{}', format('models appeared that nobody reported: %s', v_list);
  v_default := v_list -> 'data' -> 0 ->> 'id';
  assert api.v1_list_runtimes(A) -> 'data' -> 0 ->> 'id' = v_default, 'a second read made another Global default';

  -- The models each connector offers, as the Runner last reported them (#2087).
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0',
    '[{"name": "claude-code", "installed": true, "loggedIn": false, "models": [{"id": "opus", "name": "Opus"}]},
      {"name": "codex", "installed": true, "models": [{"id": "gpt-a", "name": "GPT-A"}]}]', false, 900, BUDGET);
  assert api.v1_list_runtimes(A) -> 'models' = '{"claude-code": [{"id": "opus", "name": "Opus"}], "codex": [{"id": "gpt-a", "name": "GPT-A"}]}',
    format('the models misread: %s', api.v1_list_runtimes(A));

  -- Add, change, and the rules on names.
  v_light := api.v1_create_runtime(A, '{"name": "Light", "connector": "claude-code", "model": "claude-haiku-4-5"}', BUDGET) ->> 'id';
  perform pg_temp.refuses(format('select api.v1_create_runtime(%L, %L, %s)', A, '{"name": "light", "connector": "codex"}', BUDGET),
    'AKB28', 'a taken name was added');
  perform pg_temp.refuses(format('select api.v1_update_runtime(%L, %L, %L, %s)', A, v_default, '{"name": "Mine"}', BUDGET),
    'AKB21', 'Global default was renamed');
  perform pg_temp.refuses(format('select api.v1_delete_runtime(%L, %L, %s)', A, v_default, BUDGET),
    'AKB21', 'Global default was deleted');
  assert api.v1_update_runtime(A, v_default, '{"connector": "claude-code", "model": "opus"}', BUDGET) ->> 'model' = 'opus',
    'Global default''s model was not set';
  assert api.v1_update_runtime(A, v_light, '{"model": null}', BUDGET) -> 'model' = 'null', 'a model was not cleared';
  assert api.v1_update_runtime(A, v_light, '{"model": "claude-haiku-4-5"}', BUDGET) ->> 'name' = 'Light', 'a model change renamed';

  -- Only the caller's own.
  perform pg_temp.refuses(format('select api.v1_update_runtime(%L, %L, %L, %s)', X, v_light, '{"model": "x"}', BUDGET),
    'AKB20', 'a stranger changed a runtime');
  perform pg_temp.refuses(format('select api.v1_delete_runtime(%L, %L, %s)', X, v_light, BUDGET),
    'AKB20', 'a stranger deleted a runtime');
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', X,
    jsonb_build_object('title', 'Theirs', 'run', true, 'runtime', v_light), CODING, BUDGET), 'AKB20', 'a task ran on another''s runtime');
  assert jsonb_array_length(api.v1_list_runtimes(X) -> 'data') = 1, 'a stranger saw another''s runtimes';

  -- A task's steps carry its runtime; once deleted, Global default.
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Light one', 'run', true, 'runtime', v_light), CODING, BUDGET) ->> 'id';
  assert api.v1_task(A, v_task) ->> 'runtime' = v_light, 'the task did not keep its runtime';
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.runtime = 'claude-code' and v_job.model = 'claude-haiku-4-5', 'the step did not carry the runtime';
  assert (api.list_runner_jobs(A, HOME) -> -1 ->> 'model') = 'claude-haiku-4-5', 'the Runner did not read the model';
  update cloud.runner_jobs set state = 'finished', outcome = 'done', finished_at = now() where id = v_job.id;
  perform api.v1_delete_runtime(A, v_light, BUDGET);
  assert api.v1_task(A, v_task) -> 'runtime' = 'null', 'a deleted runtime stayed on its task';
  v_job := cloud.v1_dispatch_flow(v_task, 'implement');
  assert v_job.runtime = 'claude-code' and v_job.model = 'opus', 'a step after the delete was not on Global default';
  update cloud.runner_jobs set state = 'finished', outcome = 'done', finished_at = now() where id = v_job.id;
  v_task := api.v1_create_task(A, '{"title": "Plain", "run": true}', CODING, BUDGET) ->> 'id';
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.model = 'opus', 'a task naming no runtime was not on Global default';
  update cloud.runner_jobs set state = 'finished', outcome = 'done', finished_at = now() where id = v_job.id;

  -- A test: a job the Runner runs and reports on; refused while it is offline, stopped when late.
  v_test := api.v1_test_runtime(A, v_default, 'Reply with OK.', BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (v_test ->> 'job')::uuid);
  assert v_job.test and v_job.task_id is null and v_job.runtime = 'claude-code' and v_job.model = 'opus', 'the test job misread';
  assert api.v1_runtime_test(A, v_job.id, 45) is null, 'a running test read as ended';
  perform pg_temp.refuses(format('select api.v1_runtime_test(%L, %L, 45)', X, v_job.id), 'AKB20', 'a stranger read a test');
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"ms": 2400}');
  assert api.v1_runtime_test(A, v_job.id, 45) = '{"outcome": "done", "reason": null, "elapsed_ms": 2400}',
    'a passed test misread';
  v_test := api.v1_test_runtime(A, v_default, 'Reply with OK.', BUDGET);
  update cloud.runner_jobs set created_at = now() - interval '1 minute' where id = (v_test ->> 'job')::uuid;
  assert api.v1_runtime_test(A, (v_test ->> 'job')::uuid, 45) ->> 'reason' = 'timeout', 'a late test was not stopped';
  update cloud.runners set live_until = now() - interval '1 second' where owner_id = A;
  perform pg_temp.refuses(format('select api.v1_test_runtime(%L, %L, %L, %s)', A, v_default, 'Reply with OK.', BUDGET),
    'AKB26', 'a test went to an offline Runner');

  raise notice 'sql checks: #2074 runtime checks passed';
end
$runtimes$;

-- #2083: a chat runs on the task's runtime, or one of the caller's own.
do $chat_runtimes$
declare
  A constant uuid := 'a0a0a0a0-2083-4083-8083-000000000001';
  M constant uuid := 'b0b0b0b0-2083-4083-8083-000000000002';
  HOME constant uuid := 'cccccccc-2083-4083-8083-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_deep text;
  v_light text;
  v_mine text;
  v_job cloud.runner_jobs;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'cr-a'), (M, 'cr-m');
  insert into auth.identities (user_id, provider, identity_data) values (M, 'email', '{"email": "m@cr.co"}');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0',
    '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]', false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Chat studio"}', BUDGET) ->> 'id';
  perform api.v1_add_member(A, v_ws, 'm@cr.co', BUDGET);
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_deep := api.v1_create_runtime(A, '{"name": "Deep", "connector": "codex", "model": "gpt-5.1-codex"}', BUDGET) ->> 'id';
  v_light := api.v1_create_runtime(A, '{"name": "Light", "connector": "claude-code", "model": "haiku"}', BUDGET) ->> 'id';
  v_mine := api.v1_create_runtime(M, '{"name": "Mine", "connector": "claude-code"}', BUDGET) ->> 'id';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj, 'run', true, 'runtime', v_deep),
    CODING, BUDGET) ->> 'id';
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"reply": "Planned."}');

  -- The creator sees the task's runtime by its name, then their others.
  v_json := api.v1_task_chat(A, v_task);
  assert v_json ->> 'runtime' = 'task' and v_json -> 'runtimes' -> 0 = jsonb_build_object('id', 'task', 'name', 'Deep',
    'default', false, 'connector', 'codex', 'model', 'gpt-5.1-codex', 'status', 'ready'), format('the creator''s first option misread: %s', v_json);
  assert (select array_agg(e ->> 'id') from jsonb_array_elements(v_json -> 'runtimes') e)
    = array['task', (cloud.v1_default_runtime(A)).id, v_light], format('the creator''s options misread: %s', v_json);

  -- A member sees it by connector and model only, then their own.
  v_json := api.v1_task_chat(M, v_task);
  assert v_json -> 'runtimes' -> 0 ->> 'name' is null and v_json -> 'runtimes' -> 0 ->> 'model' = 'gpt-5.1-codex'
    and (select array_agg(e ->> 'id') from jsonb_array_elements(v_json -> 'runtimes') e)
      = array['task', (cloud.v1_default_runtime(M)).id, v_mine], format('a member''s options misread: %s', v_json);

  -- By default the chat runs on the task's connector and model, on the creator's Runner.
  perform api.v1_task_chat_send(M, v_task, 'Why tiers?', null, BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task and account_id = M));
  assert v_job.owner_id = A and v_job.runtime = 'codex' and v_job.model = 'gpt-5.1-codex', 'the chat did not follow the task';
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"reply": "Clarity.", "session": "s1"}');

  -- Another's runtime is refused; the member's own is remembered, and a new session starts.
  perform pg_temp.refuses(format('select api.v1_task_chat_send(%L, %L, %L, %L, %s)', M, v_task, 'x', v_light, BUDGET),
    'AKB20', 'a member chatted on another''s runtime');
  perform api.v1_task_chat_send(M, v_task, 'Yours?', v_mine, BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task and account_id = M));
  assert v_job.owner_id = A and v_job.runtime = 'claude-code' and v_job.model is null and v_job.resume is null,
    'the member''s pick did not start a new session on it';
  assert api.v1_task_chat(M, v_task) ->> 'runtime' = v_mine, 'the pick was not remembered';
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"reply": "Sure.", "session": "s2"}');
  perform api.v1_task_chat_send(M, v_task, 'Go on', null, BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task and account_id = M));
  assert v_job.runtime = 'claude-code' and v_job.resume = 's2', 'the remembered pick did not continue its session';
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"reply": "More.", "session": "s2"}');

  -- A deleted pick falls back to the task's.
  perform api.v1_delete_runtime(M, v_mine, BUDGET);
  assert api.v1_task_chat(M, v_task) ->> 'runtime' = 'task', 'a deleted pick was kept';

  -- Same connector, another model: a new session.
  perform api.v1_task_chat_send(A, v_task, 'Mine', 'task', BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task and account_id = A));
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"reply": "Ok.", "session": "s3"}');
  perform api.v1_update_runtime(A, v_deep, '{"model": "gpt-5-mini"}', BUDGET);
  perform api.v1_task_chat_send(A, v_task, 'Again', null, BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task and account_id = A));
  assert v_job.model = 'gpt-5-mini' and v_job.resume is null, 'another model continued the session';
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"reply": "Ok."}');

  -- A connector not ready on the creator's Runner is marked, and refused without keeping the message.
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0',
    '[{"name": "codex", "installed": true, "loggedIn": false}, {"name": "claude-code", "installed": false}]', false, 900, BUDGET);
  v_json := api.v1_task_chat(A, v_task);
  assert v_json -> 'runtimes' -> 0 ->> 'status' = 'signed_out', 'a signed-out connector was not marked';
  assert (select e ->> 'status' from jsonb_array_elements(v_json -> 'runtimes') e where e ->> 'id' = v_light) = 'not_installed',
    'a missing connector was not marked';
  perform pg_temp.refuses(format('select api.v1_task_chat_send(%L, %L, %L, null, %s)', A, v_task, 'Lost', BUDGET),
    'AKB30', 'a message went to a signed-out connector');
  assert not exists (select 1 from cloud.task_chat_messages where task_id = v_task and body = 'Lost'), 'a refused message was kept';

  raise notice 'sql checks: #2083 chat runtime checks passed';
end
$chat_runtimes$;

-- #2089: a deleted account's boards and R2 files are queued for the hourly run.
do $dropped$
declare
  A constant uuid := 'a0a0a0a0-2089-4089-8089-000000000001';
  BUDGET constant integer := 100000;
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "One step"}';
  v_ws text;
  v_own text;
  v_team text;
  v_task text;
  v_art text;
  v_used text;
  v_spare text;
  v_open text;
  v_job uuid;
  v_boards text[];
  v_keys text[];
begin
  assert exists (select 1 from cloud.dropped_boards where board = 'prj_01a1763415610bab616a62bd40c7'),
    'the #2086 board was not queued';
  insert into cloud.accounts (id, handle) values (A, 'dropped-a');
  v_task := api.v1_create_task(A, '{"title": "Loose"}', WF, BUDGET) ->> 'id';
  v_own := api.v1_create_project(A, '{"name": "Own"}', BUDGET) ->> 'id';
  v_ws := api.v1_create_workspace(A, '{"name": "Team"}', BUDGET) ->> 'id';
  v_team := api.v1_create_project(A, jsonb_build_object('name', 'Team site', 'workspace', v_ws), BUDGET) ->> 'id';
  select array_agg(id order by id) into v_boards from cloud.v1_workspaces where account_id = A;
  assert cardinality(v_boards) = 2 and v_boards @> array[v_ws], 'the account''s workspaces misread';

  v_art := api.v1_create_artifact(A, v_task, '{"type": "web-page"}', BUDGET) ->> 'id';
  v_used := api.v1_create_upload(A, v_art, 'image/png', BUDGET, null, null, 1000000) ->> 'id';
  perform api.v1_finish_upload(A, v_used, 600, BUDGET, 1000000);
  perform api.v1_create_artifact_version(A, v_art, null, v_used, BUDGET);
  v_spare := api.v1_create_upload(A, v_art, 'image/png', BUDGET, null, null, 1000000) ->> 'id';
  perform api.v1_finish_upload(A, v_spare, 100, BUDGET, 1000000);
  v_open := api.v1_create_upload(A, v_art, 'video/mp4', BUDGET, 300, 'mp_2089', 1000000) ->> 'id';
  insert into cloud.runner_jobs (owner_id, runtime, prompt) values (A, 'codex', 'Run') returning id into v_job;

  -- A used upload's key is its version's, queued with the version and not before.
  delete from cloud.artifact_uploads where id = v_used;
  assert not exists (select 1 from cloud.dropped_files f join cloud.artifact_versions v on v.file ->> 'key' = f.key
    where v.artifact_id = v_art), 'a used upload was queued';

  select array_agg(k order by k) into v_keys from (
    select file ->> 'key' k from cloud.artifact_versions where artifact_id = v_art
    union select object_key from cloud.artifact_uploads where id in (v_spare, v_open)) x;
  delete from cloud.accounts where id = A;

  assert (select count(*) from cloud.dropped_boards where board = any(v_boards)) = 2, 'a workspace''s board was not queued';
  assert not exists (select 1 from cloud.dropped_boards where board in (v_own, v_team)), 'a project''s board was queued (#2114)';
  assert (select count(*) from cloud.dropped_files where key = any(v_keys)) = 3, 'a file was not queued';
  assert not exists (select 1 from cloud.dropped_files where key like '%' || v_job || '%'), 'a run log was queued (#2164)';
  assert (select multipart_id from cloud.dropped_files where key = (select k from unnest(v_keys) k where k like '%' || v_open || '%')) = 'mp_2089',
    'an open multipart upload lost its id';

  -- The hourly run takes them once ten minutes old, and forgets what it cleared.
  assert not api.v1_dropped_boards(1000) ? v_ws and not api.v1_dropped_files(1000) @> jsonb_build_array(jsonb_build_object('key', v_keys[1])),
    'a fresh drop was handed out';
  update cloud.dropped_boards set dropped_at = now() - interval '11 minutes' where board = any(v_boards);
  update cloud.dropped_files set dropped_at = now() - interval '11 minutes' where key = any(v_keys);
  assert api.v1_dropped_boards(1000) ?& v_boards, 'an old drop was not handed out';
  assert (select count(*) from jsonb_array_elements(api.v1_dropped_files(1000)) f where f ->> 'key' = any(v_keys)) = 3,
    'an old file was not handed out';
  assert api.v1_forget_boards(v_boards) = 2 and api.v1_forget_files(v_keys) = 3, 'cleared drops were not forgotten';
  assert not exists (select 1 from cloud.dropped_boards where board = any(v_boards))
    and not exists (select 1 from cloud.dropped_files where key = any(v_keys)), 'a forgotten drop stayed';

  raise notice 'sql checks: #2089 dropped file checks passed';
end
$dropped$;

-- #2064: a card's blockers hold its steps, and a task that ends is filed for the Worker.
do $dependencies$
declare
  A constant uuid := 'a0a0a0a0-2064-4064-8064-000000000001';
  HOME constant uuid := 'cccccccc-2064-4064-8064-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_prj text;
  v_prefix text;
  v_a text;
  v_b text;
  v_root text;
  v_job cloud.runner_jobs;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'dep-a');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', '[{"name": "codex", "installed": true}]', false, 900, BUDGET);
  v_prj := api.v1_create_project(A, '{"name": "Deps"}', BUDGET) ->> 'id';
  select prefix into v_prefix from cloud.projects where id = v_prj;
  v_a := api.v1_create_task(A, jsonb_build_object('title', 'A', 'project', v_prj), CODING, BUDGET) ->> 'id';
  v_root := api.v1_create_task(A, jsonb_build_object('title', 'Root', 'project', v_prj), CODING, BUDGET) ->> 'id';
  v_b := api.v1_create_task(A, jsonb_build_object('title', 'B', 'project', v_prj, 'run', true), CODING, BUDGET) ->> 'id';
  perform pg_temp.step(A, HOME, v_b, 'done', null, '{"reply": "Planned."}');

  -- A key or an id of the project's tasks, as the number the card file holds.
  assert api.v1_card_numbers(A, v_b, jsonb_build_array(v_prefix || '-1', v_root)) = '[1, 2]', 'a blocker was not numbered';
  perform pg_temp.refuses(format('select api.v1_card_numbers(%L, %L, %L)', A, v_b, '["' || v_prefix || '-99"]'), 'AKB28',
    'a blocker naming no task was taken');

  -- The file's numbers read back as keys; what a PUT set, such as the parent, outlives a push.
  perform pg_temp.save_card(A, v_b, jsonb_build_object('body', 'B', 'metadata', jsonb_build_object('parent', v_root)), 1, BUDGET);
  perform api.v1_index_cards(A, v_prj, jsonb_build_array(jsonb_build_object('task', v_b,
    'path', (select card_path from cloud.tasks where id = v_b), 'seq', 50, 'front', '{}'::jsonb,
    'links', '{"blocked_by": [1], "related": [2], "schedule": {"action": "revise", "notes": "N"}}'::jsonb)), BUDGET);
  v_json := (select card_metadata from cloud.tasks where id = v_b);
  assert v_json = jsonb_build_object('parent', v_root, 'blocked_by', jsonb_build_array(v_prefix || '-1'),
    'related', jsonb_build_array(v_prefix || '-2'), 'schedule', '{"action": "revise", "notes": "N"}'::jsonb),
    format('the card links misread: %s', v_json);
  assert cloud.v1_open_blockers((select t from cloud.tasks t where t.id = v_b)) = array[v_a], 'an open blocker was missed';

  -- Blocked, a step is held rather than dispatched, and nothing starts it early.
  v_job := cloud.v1_dispatch_flow(v_b, 'implement', 'Go');
  assert v_job.id is null and cloud.v1_flow_job(v_b) is null, 'a blocked task was dispatched';
  assert (select held_flow from cloud.tasks where id = v_b) = '{"verb": "implement", "text": "Go"}', 'the step was not held';
  assert not (api.v1_release_task(v_b, 'revise', 'N') ->> 'started')::boolean, 'a blocked task was released';

  -- Ending files the task once; the Worker reads its project's cards.
  perform api.v1_cancel_task(A, v_a, BUDGET);
  assert api.v1_take_endings(10) @> jsonb_build_array(jsonb_build_object('task', v_a, 'closing', false)), 'an ending was not filed';
  assert api.v1_take_endings(10) = '[]', 'a claimed ending was handed out twice';
  v_json := api.v1_ending(v_a);
  assert v_json ->> 'status' = 'cancelled' and v_json -> 'cards' @> jsonb_build_array(jsonb_build_object('task', v_b, 'busy', false)),
    format('the ending misread: %s', v_json);
  perform api.v1_ending_done(v_a);
  assert not exists (select 1 from cloud.task_endings where task_id = v_a), 'a handled ending stayed';

  -- Unblocked: the held step starts, the schedule's notes after its text.
  assert (api.v1_release_task(v_b, 'revise', 'N') ->> 'verb') = 'implement', 'the held step did not start';
  v_job := cloud.v1_flow_job(v_b);
  assert v_job.flow ->> 'verb' = 'implement' and v_job.flow ->> 'text' = E'Go\n\nN', format('the step misread: %s', v_job.flow);
  assert (select held_flow from cloud.tasks where id = v_b) is null, 'a started step stayed held';

  -- A group closed by its last subtask is done, and its ending says so.
  assert (api.v1_close_group(v_root) ->> 'closed')::boolean, 'the group was not closed';
  assert (select status from cloud.tasks where id = v_root) = 'done', 'a closed group is not done';
  assert (select closing from cloud.task_endings where task_id = v_root), 'a closed group''s ending was not marked';

  raise notice 'sql checks: #2064 dependency checks passed';
end
$dependencies$;

-- #2108: cards named by their task's number; a new task's card fields; a group's subtasks.
do $by_number$
declare
  A constant uuid := 'a0a0a0a0-2108-4108-8108-000000000001';
  HOME constant uuid := 'cccccccc-2108-4108-8108-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_prj text;
  v_ws text;
  v_prefix text;
  v_root text;
  v_sub text;
  v_new text;
  v_job cloud.runner_jobs;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'num-a');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', '[{"name": "codex", "installed": true}]', false, 900, BUDGET);
  v_prj := api.v1_create_project(A, '{"name": "Numbers"}', BUDGET) ->> 'id';
  select prefix, workspace_id into v_prefix, v_ws from cloud.projects where id = v_prj;
  v_root := api.v1_create_task(A, jsonb_build_object('title', 'Pricing page', 'project', v_prj), CODING, BUDGET) ->> 'id';
  v_sub := api.v1_create_task(A, jsonb_build_object('title', '定价', 'project', v_prj), CODING, BUDGET) ->> 'id';

  -- A card is written under its number and its title's slug.
  assert api.v1_card_place(A, v_root, null, BUDGET) ->> 'path' = 'todo/1-pricing-page.md', 'a new card was misnamed';
  assert api.v1_card_place(A, v_sub, null, BUDGET) ->> 'path' = 'todo/2-task.md', 'a title with no slug was misnamed';

  -- A push names cards by number: the group's root and its subtask, whose parent is the group.
  perform api.v1_index_cards(A, v_prj, jsonb_build_array(
    jsonb_build_object('number', 1, 'path', 'todo/1-pricing/root.md', 'seq', 3, 'front', '{}'::jsonb),
    jsonb_build_object('number', 2, 'path', 'todo/1-pricing/2-copy.md', 'seq', 4, 'front', '{}'::jsonb, 'parent', 1),
    jsonb_build_object('number', 99, 'path', 'todo/99-stray.md', 'seq', 5, 'front', '{}'::jsonb)), BUDGET);
  assert (select card_path from cloud.tasks where id = v_root) = 'todo/1-pricing/root.md', 'a group root was not indexed by number';
  assert (select card_metadata ->> 'parent' from cloud.tasks where id = v_sub) = v_prefix || '-1', 'a subtask has no parent';
  assert api.v1_ending(v_sub) ->> 'parent' = v_root, 'a subtask''s ending names no group';
  perform api.v1_index_cards(A, v_prj, jsonb_build_array(
    jsonb_build_object('number', 2, 'path', 'todo/1-pricing/2-copy.md', 'deleted', true)), BUDGET);
  assert (select card_path from cloud.tasks where id = v_sub) is null, 'a deleted card was kept by number';

  -- The one-off board move matches cards by project and number.
  perform api.v1_board_moved(v_ws, jsonb_build_array(
    jsonb_build_object('project', v_prj, 'number', 1, 'path', 'todo/1-pricing/root.md', 'seq', 42)));
  assert (select card_version from cloud.tasks where id = v_root) = 42, 'a moved card was not matched by number';

  -- A new task keeps its card fields; its blockers and relations by number, key or id, as keys.
  v_json := api.v1_create_task(A, jsonb_build_object('title', 'Checkout', 'project', v_prj, 'run', true,
    'metadata', jsonb_build_object('priority', 'high', 'roi', 'low', 'modules', jsonb_build_array('web'), 'related', jsonb_build_array(v_root),
      'blocked_by', jsonb_build_array('2'))), CODING, BUDGET);
  v_new := v_json ->> 'id';
  assert (select card_metadata from cloud.tasks where id = v_new) = jsonb_build_object('priority', 'high', 'roi', 'low',
    'modules', '["web"]'::jsonb, 'related', jsonb_build_array(v_prefix || '-1'), 'blocked_by', jsonb_build_array(v_prefix || '-2')),
    format('the card fields misread: %s', (select card_metadata from cloud.tasks where id = v_new));
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', A,
    jsonb_build_object('title', 'X', 'project', v_prj, 'metadata', '{"blocked_by": ["77"]}'::jsonb), CODING, BUDGET),
    'AKB28', 'a blocker naming no task was taken');

  -- Blocked, even planning waits; its last blocker ending starts it, with the card fields.
  assert cloud.v1_flow_job(v_new) is null and (select held_flow ->> 'verb' from cloud.tasks where id = v_new) = 'create',
    'a blocked task started planning';
  perform api.v1_cancel_task(A, v_sub, BUDGET);
  v_job := cloud.v1_flow_job(v_new);
  assert v_job.flow ->> 'verb' = 'create' and v_job.flow -> 'metadata' ->> 'priority' = 'high'
    and v_job.flow -> 'metadata' -> 'blocked_by' = jsonb_build_array(v_prefix || '-2'), format('the first step misread: %s', v_job.flow);
  assert (select job_id from cloud.task_chats where task_id = v_new) = v_job.id, 'the chat does not follow the started job';

  raise notice 'sql checks: #2108 card number checks passed';
end
$by_number$;

-- #2073: ideas drafted in a discussion, started as tasks; a discussion is no task.
do $discussions$
declare
  A constant uuid := 'a0a0a0a0-2073-4073-8073-000000000001';
  O constant uuid := 'b0b0b0b0-2073-4073-8073-000000000002';
  HOME constant uuid := 'cccccccc-2073-4073-8073-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_dsc text;
  v_other text;
  v_idea text;
  v_blog text;
  v_task text;
  v_open integer;
  v_seq bigint;
  v_job uuid;
  v_json jsonb;
  v_run json;
begin
  insert into cloud.accounts (id, handle) values (A, 'dsc-a'), (O, 'dsc-o');
  v_ws := api.v1_create_workspace(A, '{"name": "Ideas"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';

  -- No Runner: nothing is made.
  perform pg_temp.refuses(format('select api.v1_create_discussion(%L, %L, %s)', A,
    jsonb_build_object('workspace', v_ws, 'body', 'Hi'), BUDGET), 'AKB26', 'a discussion started with no Runner');
  assert not exists (select 1 from cloud.discussions where account_id = A), 'a refused discussion was kept';
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0',
    '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]', false, 900, BUDGET);

  -- Create: the first message is a job on the creator's Runner, in the discussion's project.
  v_open := cloud.v1_open_tasks(A);
  select coalesce(max(seq), 0) into v_seq from cloud.api_events;
  v_json := api.v1_create_discussion(A, jsonb_build_object('project', v_prj, 'body', 'Add a pricing page'), BUDGET);
  v_dsc := v_json ->> 'id';
  assert v_dsc like 'dsc\_%' and v_json ->> 'object' = 'discussion' and v_json ->> 'workspace' = v_ws
    and v_json ->> 'project' = v_prj and v_json ->> 'title' = 'Add a pricing page' and v_json ->> 'status' = 'replying'
    and v_json ->> 'runtime' = (cloud.v1_default_runtime(A)).id and v_json -> 'ideas' = '[]'
    and jsonb_array_length(v_json -> 'messages') = 1 and (v_json -> 'runner' ->> 'connected')::boolean,
    format('a new discussion misread: %s', v_json);
  v_job := (select job_id from cloud.discussions where id = v_dsc);
  assert v_json ->> 'job' = v_job::text, 'a replying discussion did not name its job';
  v_run := cloud.runner_job_json((select j from cloud.runner_jobs j where j.id = v_job));
  assert v_run ->> 'task' is null and v_run ->> 'project' = v_prj and v_run -> 'discussion' ->> 'id' = v_dsc
    and (v_run -> 'discussion' -> 'ideas')::jsonb = '[]' and v_run ->> 'prompt' like '%akb guide discuss-idea%No ideas yet.%Add a pricing page'
    and v_run ->> 'runtime' = 'claude-code', format('the discussion''s job misread: %s', v_run);
  assert exists (select 1 from cloud.api_events where seq > v_seq and type = 'discussion.updated' and account_id = A
    and data = jsonb_build_object('discussion', v_dsc, 'state', 'replying')), 'the discussion change was not told to its creator';
  assert api.v1_list_chats(A, v_ws, null, 20) -> 'data' -> 0 = jsonb_build_object('discussion', v_dsc, 'title', 'Add a pricing page',
    'project', v_prj, 'last_message_at', cloud.v1_ts(now()), 'state', 'replying'), 'a replying discussion was not listed';
  assert cloud.v1_open_tasks(A) = v_open, 'a discussion counted as an open task';

  -- Only its creator reads it, and one reply at a time.
  perform pg_temp.refuses(format('select api.v1_discussion(%L, %L)', O, v_dsc), 'AKB20', 'another read a discussion');
  perform pg_temp.refuses(format('select api.v1_discussion_send(%L, %L, %L, null, %s)', A, v_dsc, 'More', BUDGET),
    'AKB26', 'a second message went while replying');

  -- A finished reply lands, and its ideas with it.
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  v_run := api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET, '{"reply": "One idea.", "session": "s1", "ideas": [
    {"id": "new_1", "title": "Pricing page", "outcome": "A page with tiers.", "acceptance": ["Shows tiers", "Links to sign-up"],
     "workflow": "wf_builtin_coding"}]}');
  assert (v_run -> 'start')::jsonb = '[]' and v_run ->> 'discussion' = v_dsc, format('the finish misread: %s', v_run);
  v_json := api.v1_discussion(A, v_dsc);
  v_idea := v_json -> 'ideas' -> 0 ->> 'id';
  assert v_idea like 'idea\_%' and v_json ->> 'status' = 'idle' and v_json ->> 'title' = 'Pricing page'
    and v_json -> 'messages' -> 1 ->> 'body' = 'One idea.' and v_json -> 'ideas' -> 0 -> 'acceptance' = '["Shows tiers", "Links to sign-up"]'
    and v_json -> 'ideas' -> 0 -> 'task' = 'null', format('the reply''s ideas misread: %s', v_json);
  assert v_json -> 'job' = 'null', 'an idle discussion named a job';
  assert api.v1_list_chats(A, v_ws, null, 20) -> 'data' -> 0 ->> 'state' = 'waiting_you', 'an idea waiting did not wait for its creator';

  -- The next message continues the session, with the ideas in its prompt; asked to start, the finish says so.
  perform api.v1_discussion_send(A, v_dsc, 'Also a blog', null, BUDGET);
  select j.id into v_job from cloud.runner_jobs j join cloud.discussions d on d.job_id = j.id where d.id = v_dsc;
  assert (select resume from cloud.runner_jobs where id = v_job) = 's1', 'the session was not continued';
  assert (select prompt from cloud.runner_jobs where id = v_job) like
    format('%%- %s · Pricing page · wf_builtin_coding · not started%%', v_idea), 'the prompt did not list the ideas';
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  v_run := api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET, jsonb_build_object('reply', 'Two.', 'ideas', jsonb_build_array(
    jsonb_build_object('id', v_idea, 'title', 'Pricing page', 'outcome', 'A page with tiers.', 'acceptance', '["Shows tiers"]'::jsonb,
      'workflow', 'wf_builtin_coding', 'start', true),
    jsonb_build_object('id', 'new_1', 'title', 'Blog', 'outcome', 'Posts.', 'acceptance', '[]'::jsonb, 'workflow', 'wf_builtin_coding'))));
  assert (v_run -> 'start')::jsonb = jsonb_build_array(v_idea), format('the idea to start was not answered: %s', v_run);
  v_blog := api.v1_discussion(A, v_dsc) -> 'ideas' -> 1 ->> 'id';

  -- Start: a run task as POST /v1/tasks makes, in the discussion's project, linked both ways.
  v_json := api.v1_start_idea(A, v_dsc, v_idea, null, CODING, BUDGET, 10);
  v_task := v_json ->> 'id';
  assert v_json ->> 'title' = 'Pricing page' and v_json ->> 'request' = E'A page with tiers.\n\n## Done when\n- Shows tiers'
    and v_json ->> 'project' = v_prj and v_json ->> 'discussion' = v_dsc and v_json -> 'run' ->> 'state' = 'queued'
    and v_json ->> 'runtime' = (cloud.v1_default_runtime(A)).id, format('the started task misread: %s', v_json);
  assert cloud.v1_open_tasks(A) = v_open + 1, 'a started idea did not count as a task';
  assert api.v1_discussion(A, v_dsc) -> 'ideas' -> 0 -> 'task' = jsonb_build_object('id', v_task, 'key', v_json ->> 'key'),
    'the idea did not name its task';
  perform pg_temp.refuses(format('select api.v1_start_idea(%L, %L, %L, null, %L, %s)', A, v_dsc, v_idea, CODING, BUDGET),
    'AKB21', 'an idea was started twice');
  perform pg_temp.refuses(format('select api.v1_update_idea(%L, %L, %L, %L, %s)', A, v_dsc, v_idea, 'wf_builtin_x', BUDGET),
    'AKB21', 'a started idea changed its workflow');
  perform pg_temp.refuses(format('select api.v1_update_idea(%L, %L, %L, %L, %s)', A, v_dsc, v_blog, 'wf_nope', BUDGET),
    'AKB20', 'an idea took a workflow the workspace lacks');
  assert api.v1_update_idea(A, v_dsc, v_blog, 'wf_builtin_x', BUDGET) -> 'ideas' -> 1 ->> 'workflow' = 'wf_builtin_x',
    'an idea did not take an installed workflow';
  perform pg_temp.refuses(format('select api.v1_start_idea(%L, %L, %L, null, %L, %s, 0)', A, v_dsc, v_blog,
    '{"id": "wf_builtin_x", "builtin": true, "name": "X", "lands": true, "hash": "x1", "files": {}}', BUDGET),
    'AKB23', 'an idea started past the quota');
  assert api.v1_discussion(A, v_dsc) -> 'ideas' -> 1 -> 'task' = 'null', 'a refused start was kept';

  -- Dropping the last open idea takes the discussion off the list; the ideas outlive a clear.
  perform pg_temp.refuses(format('select api.v1_drop_idea(%L, %L, %L, %s)', A, v_dsc, v_idea, BUDGET),
    'AKB21', 'a started idea was dropped');
  v_json := api.v1_drop_idea(A, v_dsc, v_blog, BUDGET);
  assert jsonb_array_length(v_json -> 'ideas') = 1, 'a dropped idea was still answered';
  assert not exists (select 1 from jsonb_array_elements(api.v1_list_chats(A, v_ws, null, 20) -> 'data') e where e ->> 'discussion' = v_dsc),
    'a discussion with nothing left to start was still listed';
  v_json := api.v1_discussion_clear(A, v_dsc, BUDGET);
  assert v_json -> 'messages' = '[]' and jsonb_array_length(v_json -> 'ideas') = 1 and v_json -> 'context' = 'null',
    'a clear did not keep the ideas alone';

  -- At most ten ideas; a dropped one in the report is dropped.
  v_other := api.v1_create_discussion(A, jsonb_build_object('workspace', v_ws, 'body', 'Many'), BUDGET) ->> 'id';
  v_job := (select job_id from cloud.discussions where id = v_other);
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET, jsonb_build_object('ideas',
    (select jsonb_agg(jsonb_build_object('id', 'new_' || n, 'title', 'Idea ' || n, 'workflow', 'wf_builtin_coding')) from generate_series(1, 12) n)));
  assert jsonb_array_length(api.v1_discussion(A, v_other) -> 'ideas') = 10, 'a discussion held more than ten ideas';
  assert api.v1_list_chats(A, v_ws, api.v1_list_chats(A, v_ws, null, 1) ->> 'next', 1) -> 'data' -> 0 ->> 'discussion' = v_other
    and api.v1_list_chats(A, v_ws, v_other, 20) -> 'data' = '[]', 'the list did not page past a discussion';

  -- Delete: its task stays, no longer naming it.
  assert api.v1_delete_discussion(A, v_dsc, BUDGET) = jsonb_build_object('id', v_dsc, 'object', 'discussion', 'deleted', true),
    'a delete misread';
  assert api.v1_task(A, v_task) -> 'discussion' = 'null', 'a started task still named its deleted discussion';
  perform pg_temp.refuses(format('select api.v1_discussion(%L, %L)', A, v_dsc), 'AKB20', 'a deleted discussion was read');
  assert cloud.v1_open_tasks(A) = v_open + 1, 'open tasks moved with a discussion';

  raise notice 'sql checks: #2073 discussion checks passed';
end
$discussions$;

-- #2146: a task started from a discussion carries its session, one session for its whole chat.
do $discussion_sessions$
declare
  A constant uuid := 'a0a0a0a0-2146-4146-8146-000000000001';
  HOME constant uuid := 'cccccccc-2146-4146-8146-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_dsc text;
  v_task text;
  v_other text;
  v_job cloud.runner_jobs;
  v_chat uuid;
  v_ideas jsonb;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'dss-a');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', '[{"name": "claude-code", "installed": true}]', false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Ideas"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_dsc := api.v1_create_discussion(A, jsonb_build_object('project', v_prj, 'body', 'Add a pricing page'), BUDGET) ->> 'id';
  v_chat := (select job_id from cloud.discussions where id = v_dsc);
  perform api.claim_runner_job(A, HOME, v_chat, 900, BUDGET);
  v_ideas := (select jsonb_agg(jsonb_build_object('id', 'new_' || n, 'title', 'Idea ' || n, 'outcome', 'Tiers, not plans.',
    'acceptance', '[]'::jsonb, 'workflow', 'wf_builtin_coding')) from generate_series(1, 2) n);
  perform api.finish_runner_job(A, HOME, v_chat, 'done', '', BUDGET,
    jsonb_build_object('reply', 'Two ideas.', 'session', 'ds1', 'ideas', v_ideas));

  -- Started, its first step forks the discussion's session and carries the whole discussion.
  v_task := api.v1_start_idea(A, v_dsc, api.v1_discussion(A, v_dsc) -> 'ideas' -> 0 ->> 'id', null, CODING, BUDGET, 10) ->> 'id';
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.resume = 'ds1' and v_job.fork and v_job.transcript_of = v_dsc, 'the first step did not fork the discussion';
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  v_json := cloud.runner_job_json((select j from cloud.runner_jobs j where j.id = v_job.id));
  assert (v_json ->> 'fork')::boolean and v_json ->> 'resume' = 'ds1'
    and v_json ->> 'transcript' = E'User: Add a pricing page\n\nAgent: Two ideas.', format('the claimed step misread: %s', v_json);
  perform pg_temp.save_card(A, v_task, '{"body": "Card"}'::jsonb, 0, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"card": 7, "reply": "Planned.", "session": "ts1"}');
  assert (select session from cloud.task_chats where task_id = v_task and account_id = A) = 'ts1',
    'the step''s session was not the chat''s';
  assert (select session from cloud.discussions where id = v_dsc) = 'ds1', 'the discussion''s session moved';

  -- An answer continues it as the chat's reply, with no message of the user's.
  perform pg_temp.decide(A, v_task, 'request_changes', 'Fewer tiers.');
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.flow ->> 'verb' = 'revise' and v_job.resume = 'ts1' and not v_job.fork, 'the answer did not continue the session';
  assert api.v1_task_chat(A, v_task) ->> 'status' = 'replying', 'the answer was not the chat''s reply';
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  assert cloud.runner_job_json((select j from cloud.runner_jobs j where j.id = v_job.id))::jsonb -> 'chat' = 'null',
    'the answer''s job answered a chat message';
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"card": 7, "reply": "Two tiers now.", "session": "ts2"}');
  v_json := api.v1_task_chat(A, v_task);
  assert jsonb_array_length(v_json -> 'messages') = 3 and v_json -> 'messages' -> 2 ->> 'role' = 'agent'
    and v_json -> 'messages' -> 2 ->> 'body' = 'Two tiers now.' and v_json ->> 'status' = 'idle',
    format('the answer''s reply misread: %s', v_json);

  -- The chat continues it; a step dispatched meanwhile waits, then takes the session the chat left.
  perform api.v1_task_chat_send(A, v_task, 'Why two?', null, BUDGET);
  v_chat := (select job_id from cloud.task_chats where task_id = v_task and account_id = A);
  assert (select resume = 'ts2' and not fork from cloud.runner_jobs where id = v_chat), 'the chat did not continue the session';
  perform api.claim_runner_job(A, HOME, v_chat, 900, BUDGET);
  perform pg_temp.decide(A, v_task, 'request_changes', 'One tier.');
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.resume = 'ts2' and cloud.runner_job_queued(v_job), 'a step during a reply did not wait';
  perform api.finish_runner_job(A, HOME, v_chat, 'done', '', BUDGET, '{"reply": "Cheaper.", "session": "ts3"}');
  assert (select resume from cloud.runner_jobs where id = v_job.id) = 'ts3', 'the waiting step did not take the chat''s session';

  -- The discussion goes on unaffected.
  perform api.v1_discussion_send(A, v_dsc, 'And a blog?', null, BUDGET);
  assert (select j.resume from cloud.runner_jobs j join cloud.discussions d on d.job_id = j.id where d.id = v_dsc) = 'ds1',
    'the discussion did not continue its own session';

  -- Another connector or model: a new session, with the transcript.
  update cloud.discussions set session_runtime = 'codex' where id = v_dsc;
  v_other := api.v1_start_idea(A, v_dsc, api.v1_discussion(A, v_dsc) -> 'ideas' -> 1 ->> 'id', null, CODING, BUDGET, 10, null, true) ->> 'id';
  v_job := cloud.v1_flow_job(v_other);
  assert v_job.resume is null and not v_job.fork and v_job.transcript_of = v_dsc, 'another connector''s session was carried';
  assert (select skip_plan from cloud.tasks where id = v_other) and not (select skip_plan from cloud.tasks where id = v_task),
    'Build now on an idea did not skip planning';

  -- A task from no discussion carries nothing.
  v_other := api.v1_create_task(A, jsonb_build_object('title', 'Plain', 'workspace', v_ws, 'run', true), CODING, BUDGET) ->> 'id';
  v_job := cloud.v1_flow_job(v_other);
  assert v_job.resume is null and not v_job.fork and v_job.transcript_of is null, 'a plain task carried a session';

  raise notice 'sql checks: #2146 discussion session checks passed';
end
$discussion_sessions$;

-- #2065: a chat belongs to the computer that answered it last, which reviews it; chats are kept 30 days.
do $chat_reviews$
declare
  A constant uuid := 'a0a0a0a0-2065-4065-8065-000000000001';
  HOME constant uuid := 'cccccccc-2065-4065-8065-000000000003';
  OTHER constant uuid := 'dddddddd-2065-4065-8065-000000000004';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_job uuid;
  v_review json;
  v_json json;
  v_swept jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'rv-a');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', '[{"name": "codex", "installed": true}]', false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Review studio"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj, 'run', true), CODING, BUDGET) ->> 'id';
  perform pg_temp.step(A, HOME, v_task, 'done', null, '{"reply": "Planned."}');

  -- A chat's job carries the message it answers, and its claim names the computer.
  perform api.v1_task_chat_send(A, v_task, 'Why tiers?', null, BUDGET);
  v_job := (select job_id from cloud.task_chats where task_id = v_task and account_id = A);
  v_json := api.claim_runner_job(A, HOME, v_job, 900, BUDGET) -> 'job';
  assert v_json -> 'chat' ->> 'body' = 'Why tiers?' and v_json -> 'chat' ->> 'message' like 'msg_%',
    format('the chat job did not carry its message: %s', v_json);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET, '{"reply": "Clarity."}');
  assert (select machine_id from cloud.task_chats where task_id = v_task) = HOME, 'the chat did not note its computer';

  -- Reviewed once archived, by the computer that answered last.
  assert api.runner_chats(A, HOME, 30)::jsonb = '[]', 'an open task''s chat was offered for review';
  update cloud.tasks set card_path = '.archive/1-' || replace(v_task, '_', '-') || '.md' where id = v_task;
  assert api.runner_chats(A, HOME, 30)::jsonb = jsonb_build_array(jsonb_build_object('task', v_task, 'project', v_prj)),
    'an archived task''s chat was not offered';
  assert api.runner_chats(A, OTHER, 30)::jsonb = '[]', 'another computer was offered the chat';
  perform api.v1_task_chat_send(A, v_task, 'And now?', null, BUDGET);
  update cloud.runner_jobs set state = 'claimed', claimed_machine = OTHER
   where id = (select job_id from cloud.task_chats where task_id = v_task);
  assert (select machine_id from cloud.task_chats where task_id = v_task) = OTHER, 'a later answer elsewhere did not move the chat';
  assert api.runner_chats(A, HOME, 30)::jsonb = '[]', 'a chat answered elsewhere since stayed with the first computer';
  update cloud.runner_jobs set state = 'finished', outcome = 'done' where id = (select job_id from cloud.task_chats where task_id = v_task);
  update cloud.task_chats set job_id = null, machine_id = HOME where task_id = v_task;

  -- The review job is pinned here, carries its tasks, writes the board, and runs one at a time.
  v_review := api.dispatch_runner_review(A, HOME, v_prj, array[v_task, 'task_0000'], 'codex', 'gpt-5', BUDGET);
  assert (v_review -> 'review' -> 'tasks')::jsonb = jsonb_build_array(v_task), format('the review misread its tasks: %s', v_review);
  assert (select machine_id from cloud.runner_jobs where id = (v_review ->> 'id')::uuid) = HOME, 'the review was not pinned';
  assert api.dispatch_runner_review(A, HOME, v_prj, array[v_task], 'codex', null, BUDGET) ->> 'id' = v_review ->> 'id',
    'a second review started while one waited';
  perform pg_temp.refuses(format('select api.dispatch_runner_review(%L, %L, %L, %L, %L, null, %s)', A, OTHER, v_prj, array[v_task], 'codex', BUDGET),
    'AKB21', 'a computer that is not the Runner started a review');
  assert (api.claim_runner_job(A, HOME, (v_review ->> 'id')::uuid, 900, BUDGET) ->> 'claimed')::boolean, 'the review was not claimed';
  assert api.v1_board_job(A, v_prj, (v_review ->> 'id')::uuid, HOME) ->> 'job' = v_review ->> 'id', 'the review could not write the board';
  perform api.finish_runner_job(A, HOME, (v_review ->> 'id')::uuid, 'conflict', '', BUDGET);
  assert not exists (select 1 from cloud.runner_jobs where review is not null and state <> 'finished' and owner_id = A),
    'a review that conflicted was dispatched again';

  -- Past 30 days a message goes, and a chat idle as long goes with its last.
  update cloud.task_chat_messages set created_at = now() - interval '31 days' where task_id = v_task and body <> 'And now?';
  v_swept := api.sweep_task_chats(30);
  assert v_swept = '{"messages": 4, "chats": 0, "attachments": 0}', format('the sweep misread: %s', v_swept);
  assert exists (select 1 from cloud.task_chats where task_id = v_task), 'a chat with a message left was swept';
  update cloud.task_chat_messages set created_at = now() - interval '31 days' where task_id = v_task;
  update cloud.task_chats set updated_at = now() - interval '31 days' where task_id = v_task;
  v_swept := api.sweep_task_chats(30);
  assert v_swept = '{"messages": 1, "chats": 1, "attachments": 0}', format('the sweep misread: %s', v_swept);

  raise notice 'sql checks: #2065 chat review checks passed';
end
$chat_reviews$;

-- #2067, #2107: rejection reasons kept for the rejection review; triage items are board files, so
-- Postgres only says who writes them and tells their changes.
do $triage$
declare
  BUDGET constant integer := 100000;
  A constant uuid := 'a0a0a0a0-2067-4067-8067-000000000001';
  M constant uuid := 'b0b0b0b0-2067-4067-8067-000000000002';
  X constant uuid := 'c0c0c0c0-2067-4067-8067-000000000003';
  WF constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "lands": true, "hash": "h", "files": {}, "name": "X"}';
  v_ws text;
  v_prj text;
  v_task text;
  v_gone text;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'tri-a'), (M, 'tri-m'), (X, 'tri-x');
  v_ws := api.v1_create_workspace(A, '{"name": "Triage"}', BUDGET) ->> 'id';
  insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (v_ws, M, 'member');
  insert into cloud.workflow_installs (workspace_id, workflow_id) values (v_ws, 'wf_builtin_x') on conflict do nothing;
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Landing', 'project', v_prj), WF, BUDGET) ->> 'id';

  -- Any member writes, into the project or the general one; nobody else, nor on a stranger workflow.
  v_json := api.v1_triage_write(M, null, v_prj, v_task, 'wf_builtin_x', BUDGET);
  assert v_json = jsonb_build_object('workspace', v_ws, 'project', v_prj), format('a triage write misread: %s', v_json);
  assert api.v1_triage_write(A, v_ws, null, null, 'wf_builtin_x', BUDGET) ->> 'project' = cloud.v1_general(v_ws),
    'an item with no project had a project';
  perform pg_temp.refuses(format('select api.v1_triage_write(%L, null, %L, null, %L, %s)', X, v_prj, 'wf_builtin_x', BUDGET),
    'AKB20', 'an outsider wrote triage');
  perform pg_temp.refuses(format('select api.v1_triage_write(%L, null, %L, null, %L, %s)', A, v_prj, 'wf_nobody', BUDGET),
    'AKB28', 'an item on a stranger workflow was kept');
  perform pg_temp.refuses(format('select api.v1_triage_scope(%L, %L, null)', X, v_ws), 'AKB20', 'an outsider read the triage');
  assert api.v1_triage_scope(M, null, v_prj) ->> 'workspace' = v_ws, 'the triage scope misread';

  -- Told to the workspace; nothing else is.
  perform api.v1_triage_emit(v_ws, 'triage.updated', '{"object": "triage", "id": "tri_1_x"}');
  assert exists (select 1 from cloud.api_events where type = 'triage.updated' and workspace_id = v_ws and data ->> 'id' = 'tri_1_x'),
    'a triage change was not told';
  perform pg_temp.refuses(format('select api.v1_triage_emit(%L, %L, %L)', v_ws, 'task.created', '{}'), 'AKB21', 'a triage emit told a task');

  -- A cancel with a reason is a rejection to learn; one without is not.
  v_json := api.v1_cancel_task(M, v_task, BUDGET, '  Too broad  ');
  assert v_json ->> 'cancel_reason' = 'Too broad' and v_json ->> 'cancelled_by' = 'tri-m', format('a cancel misread: %s', v_json);
  v_gone := api.v1_create_task(A, jsonb_build_object('title', 'Quiet', 'project', v_prj), WF, BUDGET) ->> 'id';
  assert api.v1_cancel_task(A, v_gone, BUDGET) ->> 'cancel_reason' is null, 'a cancel without a reason kept one';
  v_json := api.v1_list_rejections(M, v_ws);
  assert jsonb_array_length(v_json -> 'tasks') = 1 and v_json -> 'tasks' -> 0 ->> 'reason' = 'Too broad' and v_json ->> 'workspace' = v_ws,
    format('the rejections misread: %s', v_json);
  assert jsonb_array_length(api.v1_list_rejections(X, null) -> 'tasks') = 0, 'an outsider read the rejections';
  assert api.v1_rejections_reviewed(X, array[v_task], BUDGET) = 0, 'an outsider marked a rejection learned';
  assert api.v1_rejections_reviewed(M, array[v_task], BUDGET) = 1, 'marking learned misread';
  assert jsonb_array_length(api.v1_list_rejections(A, v_ws) -> 'tasks') = 0, 'a learned rejection still waited';

  -- A card's task by its number.
  v_json := api.v1_card_tasks(jsonb_build_array(jsonb_build_object('project', v_prj,
    'number', (select number from cloud.tasks where id = v_task)), jsonb_build_object('project', v_prj, 'number', 999)));
  assert jsonb_array_length(v_json) = 1 and v_json -> 0 ->> 'task' = v_task, format('the card tasks misread: %s', v_json);

  -- #2139: a task made of an item may skip planning.
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', A,
    jsonb_build_object('title', 't', 'project', v_prj, 'skip_plan', true), WF, BUDGET), 'AKB28', 'skip_plan was taken without run');
  v_gone := api.v1_create_task(A, jsonb_build_object('title', 'Build it now', 'project', v_prj, 'skip_plan', true, 'run', true), WF, BUDGET) ->> 'id';
  assert (select skip_plan from cloud.tasks where id = v_gone), 'the task lost skip_plan';
  assert (select (flow ->> 'skip_plan')::boolean from cloud.runner_jobs where task_id = v_gone and flow ->> 'verb' = 'create'),
    'the create step did not carry skip_plan';
  perform cloud.v1_finish_flow(j, '{"card": 5}') from cloud.runner_jobs j where j.task_id = v_gone;
  assert (select status = 'done' from cloud.tasks where id = v_gone), 'an unplanned create was not ended as a build';

  -- Where the sort and the keep look.
  v_json := api.v1_sort_context(v_ws);
  assert v_json ->> 'owner' = A::text and v_json -> 'installed' ? 'wf_builtin_x', format('the sort context misread: %s', v_json);
  assert api.v1_account_workspaces(A) ? v_ws and not api.v1_account_workspaces(M) ? v_ws, 'the owned workspaces misread';
  update cloud.runner_jobs set state = 'finished', finished_at = now() where task_id = v_gone;
  assert api.v1_sort_workspaces(100) ? v_ws, 'a workspace a job just finished in was not sorted';

  raise notice 'sql checks: #2067 triage checks passed';
end
$triage$;

-- #2004: the Workflow builder makes or changes a workspace's workflow on approval.
do $builder$
declare
  A constant uuid := 'aaaaaaaa-2004-4004-8004-000000000001';
  B constant uuid := 'bbbbbbbb-2004-4004-8004-000000000002';
  HOME constant uuid := 'cccccccc-2004-4004-8004-000000000003';
  BUDGET constant integer := 100000;
  ACTOR constant jsonb := '{"kind": "user", "handle": "wb-a"}';
  BUILDER constant jsonb := '{"id": "wf_builtin_workflow_builder", "builtin": true, "name": "Workflow builder",
    "lands": false, "hash": "wb1", "files": {"WORKFLOW.md": "builder"}}';
  OTHER constant jsonb := '{"id": "wf_builtin_x", "builtin": true, "name": "X", "lands": true, "hash": "x1", "files": {}}';
  SENT constant jsonb := '{"name": "Report", "description": "Weekly", "lands": false, "files": {"WORKFLOW.md": "report v2"}}';
  v_wf text;
  v_theirs text;
  v_old text;
  v_task text;
  v_job uuid;
  v_rev integer;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'wb-a'), (B, 'wb-b');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0', '[]', false, 900, BUDGET);
  v_wf := api.v1_create_workflow(A, '{"name": "Report", "lands": false, "files": {"WORKFLOW.md": "report v1"}}', BUDGET) ->> 'id';
  v_theirs := api.v1_create_workflow(B, '{"name": "Theirs", "lands": false, "files": {"WORKFLOW.md": "t"}}', BUDGET) ->> 'id';
  v_old := api.v1_create_task(A, '{"title": "Running"}', jsonb_build_object('id', v_wf, 'builtin', false), BUDGET) ->> 'id';

  -- Only the builder changes a workflow, and only one of the workspace's own.
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', A,
    jsonb_build_object('title', 'x', 'context', jsonb_build_object('workflow', v_wf)), OTHER, BUDGET), 'AKB21', 'another workflow took context');
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', A,
    jsonb_build_object('title', 'x', 'context', jsonb_build_object('workflow', v_theirs)), BUILDER, BUDGET), 'AKB20', 'a task changed another''s workflow');

  -- A change: the files a job sent are saved on approval, and a later change asks again.
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Add pricing', 'run', true,
    'context', jsonb_build_object('workflow', v_wf)), BUILDER, BUDGET) ->> 'id';
  assert api.v1_task(A, v_task) -> 'context' ->> 'workflow' = v_wf, 'a task did not name the workflow it changes';
  perform pg_temp.save_card(A, v_task, '{"body": "Plan"}', 0, BUDGET);
  v_job := (cloud.v1_flow_job(v_task)).id;
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  assert api.runner_built_workflow(A, HOME, v_job, SENT), 'a builder job''s files were not kept';
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET);
  select review_revision into v_rev from cloud.tasks where id = v_task and review_status = 'ready';
  assert v_rev is not null, 'a builder task did not wait for review';

  perform api.v1_task_chat_send(A, v_task, 'Shorter', null, BUDGET);
  v_job := (select job_id from cloud.task_chats where task_id = v_task and account_id = A);
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  assert api.runner_built_workflow(A, HOME, v_job, SENT || '{"name": "Report 2"}'), 'a chat''s files were not kept';
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET, '{"reply": "Done"}');
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', A, v_task,
    jsonb_build_object('decision', 'approve', 'review_revision', v_rev), ACTOR, BUDGET), 'AKB26', 'an approval missed the files'' change');
  perform api.v1_create_decision(A, v_task, jsonb_build_object('decision', 'approve', 'review_revision',
    (select review_revision from cloud.tasks where id = v_task)), ACTOR, BUDGET);
  assert (select status from cloud.tasks where id = v_task) = 'done', 'an approved builder task did not end';
  v_json := api.v1_workflow(A, v_wf);
  assert (v_json ->> 'version')::int = 2 and v_json ->> 'name' = 'Report 2' and v_json -> 'files' ->> 'WORKFLOW.md' = 'report v2',
    format('the change was not saved: %s', v_json);
  assert exists (select 1 from cloud.api_events where type = 'workflow.updated' and data ->> 'id' = v_wf), 'no workflow.updated';
  assert api.v1_task_workflow(A, v_old) -> 'files' ->> 'WORKFLOW.md' = 'report v1', 'the change reached a running task';

  -- A new one: nothing to save until a job sent it, then the workspace's own.
  v_task := api.v1_create_task(A, '{"title": "Job posts", "run": true}', BUILDER, BUDGET) ->> 'id';
  perform pg_temp.save_card(A, v_task, '{"body": "Plan"}', 0, BUDGET);
  v_job := (cloud.v1_flow_job(v_task)).id;
  perform api.claim_runner_job(A, HOME, v_job, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_job, 'done', '', BUDGET);
  perform pg_temp.refuses(format('select api.v1_create_decision(%L, %L, %L, %L, %s)', A, v_task,
    jsonb_build_object('decision', 'approve', 'review_revision', (select review_revision from cloud.tasks where id = v_task)),
    ACTOR, BUDGET), 'AKB21', 'an approval saved nothing');
  update cloud.tasks set built = SENT || '{"name": "Job posts"}' where id = v_task;
  perform api.v1_create_decision(A, v_task, jsonb_build_object('decision', 'approve', 'review_revision',
    (select review_revision from cloud.tasks where id = v_task)), ACTOR, BUDGET);
  v_wf := api.v1_task(A, v_task) -> 'context' ->> 'workflow';
  assert (api.v1_workflow(A, v_wf) ->> 'name') = 'Job posts', 'a new workflow was not saved';
  assert (api.v1_task(A, v_task) -> 'context' ->> 'created')::boolean, 'a new workflow was not marked made';
  assert exists (select 1 from cloud.api_events where type = 'workflow.created' and data ->> 'id' = v_wf), 'no workflow.created';
  assert exists (select 1 from jsonb_array_elements(api.v1_list_workflows(A, null, null, 100) -> 'data') w where w ->> 'id' = v_wf),
    'a new workflow was not listed';
  assert (api.v1_create_task(A, '{"title": "First post"}', jsonb_build_object('id', v_wf, 'builtin', false), BUDGET) -> 'workflow' ->> 'id') = v_wf,
    'a task could not start on the new workflow';

  raise notice 'sql checks: #2004 workflow builder checks passed';
end
$builder$;

-- #2068: periodic agents run on the Runner; Cloud dedupes, records the last pass, and queues on a finished task.
do $periodic$
declare
  A constant uuid := 'a0a0a0a0-2068-4068-8068-000000000001';
  HOME constant uuid := 'cccccccc-2068-4068-8068-000000000003';
  OTHER constant uuid := 'dddddddd-2068-4068-8068-000000000004';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_job json;
  v_id uuid;
  v_held jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'pa-a');
  perform api.register_runner(A, HOME, 'home-mac', 6, '0.5.0', '[{"name": "codex", "installed": true}]', false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Periodic studio"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';

  -- Only a computer with the project's folder asks.
  perform pg_temp.refuses(format('select api.request_agent_job(%L, %L, %L, %L, null, null, %s)', A, HOME, v_prj, 'prune-memory', BUDGET),
    'AKB20', 'a computer with no folder asked for an agent');
  perform api.add_project_folder(A, HOME, 'site', '/Users/a/site', BUDGET, v_prj);

  -- One open job per agent; handed to the asker, with its folder.
  v_job := api.request_agent_job(A, HOME, v_prj, 'prune-memory', null, null, BUDGET);
  assert v_job -> 'agent' ->> 'name' = 'prune-memory' and v_job ->> 'projectDir' = '/Users/a/site' and v_job ->> 'task' is null,
    format('the agent job misread: %s', v_job);
  assert api.request_agent_job(A, HOME, v_prj, 'prune-memory', null, null, BUDGET) is null, 'a second prune was queued';
  assert api.list_runner_jobs(A, OTHER)::jsonb = '[]', 'another computer was offered the agent job';
  v_id := (v_job ->> 'id')::uuid;
  assert (api.claim_runner_job(A, HOME, v_id, 900, BUDGET) ->> 'claimed')::boolean, 'the agent job was not claimed';
  assert api.v1_board_job(A, v_prj, v_id, HOME) ->> 'job' = v_id::text, 'the agent job could not write the board';

  -- A lapsed lease goes back to the queue once, for any computer.
  update cloud.runner_jobs set lease_expires_at = now() - interval '1 minute' where id = v_id;
  v_held := api.list_runner_jobs(A, HOME)::jsonb;
  assert jsonb_array_length(v_held) = 1 and v_held -> 0 -> 'agent' ->> 'name' = 'prune-memory' and v_held -> 0 ->> 'id' <> v_id::text
    and (v_held -> 0 ->> 'attempt')::int = 2, format('a lapsed agent job was not queued again: %s', v_held);
  update cloud.runner_jobs set created_at = now() - interval '1 minute' where id = (v_job ->> 'id')::uuid;
  v_id := (v_held -> 0 ->> 'id')::uuid;
  perform api.claim_runner_job(A, HOME, v_id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_id, 'done', '', BUDGET);
  assert (select last_success from cloud.project_agents where project_id = v_prj and agent = 'prune-memory')
    = (select created_at from cloud.runner_jobs where id = v_id), 'the pass that passed was not recorded';

  -- A pass after the one the Runner read refuses its ask.
  assert api.request_agent_job(A, HOME, v_prj, 'prune-memory', null, now() - interval '1 day', BUDGET) is null,
    'a Runner that read an older pass queued another';
  v_held := api.runner_agents(A, HOME, v_prj);
  assert v_held -> 'runs' -> 0 ->> 'agent' = 'prune-memory' and v_held -> 'runs' -> 0 -> 'attempts' -> 0 ->> 'status' = 'done'
    and v_held -> 'runs' -> 0 -> 'attempts' -> 1 ->> 'status' = 'error' and not (v_held ->> 'reflectWaiting')::boolean,
    format('the agents misread: %s', v_held);
  perform pg_temp.refuses(format('select api.request_agent_job(%L, %L, %L, %L, %L, null, %s)', A, HOME, v_prj, 'qa-manager', 'wf_mine', BUDGET),
    'AKB20', 'an agent of a workflow the workspace lacks was queued');

  -- A finished task queues a reflect, which reads it as it is claimed and clears it once it passed.
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj), CODING, BUDGET) ->> 'id';
  update cloud.tasks set status = 'done' where id = v_task;
  assert (select reflect_waiting from cloud.tasks where id = v_task), 'a finished task did not wait for a reflect';
  v_held := api.list_runner_jobs(A, HOME)::jsonb;
  assert (select count(*) from jsonb_array_elements(v_held) e where e -> 'agent' ->> 'name' in ('reflect', 'describe-project')) = 2,
    format('a finished task did not queue its agents: %s', v_held);
  v_id := (select (e ->> 'id')::uuid from jsonb_array_elements(v_held) e where e -> 'agent' ->> 'name' = 'reflect');
  v_job := api.claim_runner_job(A, HOME, v_id, 900, BUDGET) -> 'job';
  assert (v_job -> 'agent' -> 'tasks')::jsonb = jsonb_build_array(jsonb_build_object('id', v_task, 'number', (select number from cloud.tasks where id = v_task))),
    format('the reflect did not read its task: %s', v_job);
  perform api.finish_runner_job(A, HOME, v_id, 'done', '', BUDGET);
  assert not (select reflect_waiting from cloud.tasks where id = v_task), 'a reflected task still waited';
  assert not cloud.agent_job_open(v_prj, 'reflect', ''), 'a reflect went on with nothing waiting';

  -- An older Runner is offered none.
  update cloud.runners set protocol = 5 where owner_id = A;
  assert not exists (select 1 from json_array_elements(api.list_runner_jobs(A, HOME)) e where json_typeof(e -> 'agent') = 'object'),
    'a Runner that knows no agent job was offered one';

  raise notice 'sql checks: #2068 periodic agent checks passed';
end
$periodic$;

-- #2138: an agent switched off on the agents page is queued nothing by a finished task.
do $switched$
declare
  A constant uuid := 'a0a0a0a0-2138-4138-8138-000000000001';
  HOME constant uuid := 'cccccccc-2138-4138-8138-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_id uuid;
  v_held jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'sw-a');
  perform api.register_runner(A, HOME, 'home-mac', 6, '0.5.0', '[{"name": "codex", "installed": true}]', false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Switched studio"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  perform api.add_project_folder(A, HOME, 'site', '/Users/a/site', BUDGET, v_prj);

  -- A waiting reflect goes as reflect is switched off; describe-project is off on another cadence.
  perform cloud.queue_agent_job(v_prj, '{"name": "reflect"}', null);
  perform api.v1_set_agent_schedules(A, v_prj, '[{"agent": "reflect", "workflow": null, "on": false, "cadence": null},
    {"agent": "describe-project", "workflow": null, "on": false, "cadence": "3d"}]', BUDGET);
  assert not cloud.agent_job_open(v_prj, 'reflect', ''), 'switching reflect off left its waiting job';
  assert api.v1_agent_schedules(A, v_prj) = '[{"on": false, "agent": "describe-project", "cadence": "3d", "workflow": null},
    {"on": false, "agent": "reflect", "cadence": null, "workflow": null}]'::jsonb,
    format('the switches misread: %s', api.v1_agent_schedules(A, v_prj));
  assert api.runner_agents(A, HOME, v_prj) -> 'schedules' = api.v1_agent_schedules(A, v_prj), 'the Runner was not handed the switches';

  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj), CODING, BUDGET) ->> 'id';
  update cloud.tasks set status = 'done' where id = v_task;
  assert not (select reflect_waiting from cloud.tasks where id = v_task), 'a task finished while reflect was off waited for one';
  assert not exists (select 1 from cloud.runner_jobs j where j.project_id = v_prj and j.agent is not null and j.state <> 'finished'),
    'a finished task queued a switched-off agent';

  -- Run now still queues one; finishing it chains no other while reflect is off.
  assert api.v1_run_agent(A, v_prj, 'reflect', null, BUDGET), 'Run now refused a switched-off agent';
  update cloud.tasks set reflect_waiting = true where id = v_task;
  v_id := (select j.id from cloud.runner_jobs j where j.project_id = v_prj and j.agent ->> 'name' = 'reflect' and j.state = 'waiting');
  perform api.claim_runner_job(A, HOME, v_id, 900, BUDGET);
  update cloud.runner_jobs set agent = agent - 'tasks' || '{"tasks": []}' where id = v_id;
  perform api.finish_runner_job(A, HOME, v_id, 'done', '', BUDGET);
  assert not cloud.agent_job_open(v_prj, 'reflect', ''), 'a finished reflect went on while reflect was off';

  -- Back on, at its default: the row goes and a finished task queues again.
  perform api.v1_set_agent_schedules(A, v_prj, '[{"agent": "reflect", "workflow": null, "on": true, "cadence": null},
    {"agent": "describe-project", "workflow": null, "on": true, "cadence": null}]', BUDGET);
  assert api.v1_agent_schedules(A, v_prj) = '[]', 'agents back at their defaults kept a row';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Copy', 'project', v_prj), CODING, BUDGET) ->> 'id';
  update cloud.tasks set status = 'done' where id = v_task;
  assert (select reflect_waiting from cloud.tasks where id = v_task), 'a task finished with reflect on did not wait';
  assert cloud.agent_job_open(v_prj, 'reflect', '') and cloud.agent_job_open(v_prj, 'describe-project', ''),
    'a finished task did not queue its agents once they were on';

  -- The move writes the same rows, for a project that exists.
  perform api.move_agent_schedules(v_prj, '[{"agent": "qa-manager", "workflow": "wf_builtin_coding", "on": false, "cadence": null}]');
  assert cloud.agent_off(v_prj, 'qa-manager', 'wf_builtin_coding'), 'the move wrote no switch';
  perform pg_temp.refuses(format('select api.move_agent_schedules(%L, %L)', 'prj_none', '[]'), 'AKB20', 'a move named no project');

  raise notice 'sql checks: #2138 switched-off agent checks passed';
end
$switched$;

-- The account rides in the sign-in token (#2116): the hook Auth calls on every issue and refresh
-- writes it in for an admitted account, and never fails the sign-in.
do $claims$
declare
  ADMITTED constant uuid := '44444444-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  OUTSIDER constant uuid := '55555555-cccc-4ccc-8ccc-cccccccccccc';
  EMAILER constant uuid := '66666666-dddd-4ddd-8ddd-dddddddddddd';
  NEWCOMER constant uuid := '77777777-eeee-4eee-8eee-eeeeeeeeeeee';
  v_claims jsonb;
begin
  insert into auth.identities (user_id, provider, identity_data)
  values (ADMITTED, 'github', '{"user_name":"claims-in"}'::jsonb),
         (OUTSIDER, 'github', '{"user_name":"claims-out"}'::jsonb),
         (EMAILER, 'email', '{"email":"emailer@example.com"}'::jsonb),
         (NEWCOMER, 'github', '{"user_name":"claims-new"}'::jsonb);
  insert into cloud.admitted_accounts (handle) values ('claims-in'), ('claims-new');

  -- Called the way Auth calls it, as Auth's own role.
  create function pg_temp.claims_for(p_subject uuid, p_claims jsonb default '{}') returns jsonb
  language plpgsql as $fn$
  declare
    v_out jsonb;
  begin
    set local role supabase_auth_admin;
    v_out := hooks.access_token_claims(jsonb_build_object(
      'user_id', p_subject,
      'claims', jsonb_build_object('sub', p_subject, 'aud', 'authenticated', 'role', 'authenticated') || p_claims,
      'authentication_method', 'oauth'));
    reset role;
    return v_out -> 'claims';
  end;
  $fn$;

  v_claims := pg_temp.claims_for(ADMITTED);
  assert v_claims ->> 'account_id' = ADMITTED::text, format('an admitted account got no account claim: %s', v_claims);
  assert (v_claims ->> 'admitted')::boolean and v_claims ->> 'handle' = 'claims-in',
    format('an admitted account got the wrong claims: %s', v_claims);
  assert v_claims ->> 'sub' = ADMITTED::text and v_claims ->> 'role' = 'authenticated',
    'the hook dropped the claims Auth sent';

  v_claims := pg_temp.claims_for(OUTSIDER, '{"account_id": "forged", "admitted": true}');
  assert not v_claims ?| array['account_id', 'admitted', 'handle'],
    format('an account not admitted carried account claims: %s', v_claims);

  v_claims := pg_temp.claims_for(EMAILER);
  assert not v_claims ? 'account_id', 'a sign-in without GitHub carried an account claim';

  -- With the day's writes spent, a first sign-in cannot write its account row: the claims go
  -- back as they came, and the sign-in still succeeds.
  insert into cloud.daily_writes (day, writes) values ((now() at time zone 'utc')::date, 1000000)
  on conflict (day) do update set writes = excluded.writes;
  v_claims := pg_temp.claims_for(NEWCOMER);
  assert v_claims ->> 'sub' = NEWCOMER::text and not v_claims ? 'account_id',
    format('a spent write budget failed or misread the hook: %s', v_claims);
  assert not exists (select 1 from cloud.accounts where id = NEWCOMER), 'the refused write landed anyway';

  -- Nobody but Auth may call it.
  perform pg_temp.refuses('set local role authenticated; select hooks.access_token_claims(''{}'')',
    '42501', 'a signed-in caller reaching the hook');
  reset role;

  raise notice 'sql checks: #2116 sign-in token claims passed';
end
$claims$;

rollback;

-- #2084: OpenCode and Cursor runtimes, reported and run like the other two.

do $acp$
declare
  A constant uuid := 'a0a0a0a0-2084-4084-8084-000000000001';
  HOME constant uuid := 'cccccccc-2084-4084-8084-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_list jsonb;
  v_cursor text;
  v_task text;
  v_job cloud.runner_jobs;
begin
  insert into cloud.accounts (id, handle) values (A, 'acp-a');
  perform api.register_runner(A, HOME, 'home-mac', 3, '0.4.0',
    '[{"name": "claude-code", "installed": false}, {"name": "codex", "installed": true},
      {"name": "opencode", "installed": true, "models": [{"id": "opencode/big-pickle", "name": "opencode/big-pickle"}]},
      {"name": "cursor", "installed": true, "loggedIn": false}]', false, 900, BUDGET);

  -- Global default still picks between Claude Code and Codex alone.
  v_list := api.v1_list_runtimes(A);
  assert v_list -> 'data' -> 0 ->> 'connector' = 'codex', format('Global default picked another connector: %s', v_list);
  assert v_list -> 'connectors' = '{"claude-code": "not_installed", "codex": "ready", "opencode": "ready", "cursor": "signed_out"}',
    format('the connectors misread: %s', v_list);
  assert v_list -> 'models' = '{"opencode": [{"id": "opencode/big-pickle", "name": "opencode/big-pickle"}]}',
    format('the models misread: %s', v_list);

  -- A Cursor runtime keeps its full model id, and a task's step runs on it.
  v_cursor := api.v1_create_runtime(A, '{"name": "Cursor", "connector": "cursor", "model": "gpt-5.5[context=272k,fast=false]"}', BUDGET) ->> 'id';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'On Cursor', 'run', true, 'runtime', v_cursor), CODING, BUDGET) ->> 'id';
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.runtime = 'cursor' and v_job.model = 'gpt-5.5[context=272k,fast=false]', 'the step did not carry the Cursor runtime';
  assert api.v1_update_runtime(A, v_cursor, '{"connector": "opencode", "model": "opencode/big-pickle"}', BUDGET) ->> 'connector' = 'opencode',
    'a runtime did not move to OpenCode';

  raise notice 'sql checks: #2084 ACP runtime checks passed';
end
$acp$;


-- #2107: the items parked by 0100 are handed to the move one workspace at a time, then dropped.
do $triage_move$
declare
  BUDGET constant integer := 100000;
  A constant uuid := 'a0a0a0a0-2107-4107-8107-000000000001';
  v_ws text;
  v_prj text;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'move-a');
  v_ws := api.v1_create_workspace(A, '{"name": "Moving"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  insert into cloud.triage_moves (id, workspace_id, project_id, created_by, title, body, state, dismissed_by, dismissed_at, reviewed)
  values ('tri_1', v_ws, v_prj, A, 'Dark mode', 'Add it', 'open', null, null, null),
         ('tri_2', v_ws, v_prj, A, 'Old idea', '', 'dismissed', A, now(), false);
  v_json := api.v1_triage_move(v_ws);
  assert jsonb_array_length(v_json) = 2 and v_json -> 1 ->> 'state' = 'dismissed' and (v_json -> 1 ->> 'reviewed')::boolean = false,
    format('the parked items misread: %s', v_json);
  assert api.v1_triage_moved(v_ws, array['tri_1', 'tri_2']) = 2, 'the moved items were not dropped';
  assert api.v1_triage_move(v_ws) = '[]', 'moved items stayed parked';

  raise notice 'sql checks: #2107 triage move checks passed';
end
$triage_move$;

-- #2133: pictures go with a chat message and only to its job; a reply stops part way; a reply
-- carries its job's usage.
do $chat_actions$
declare
  A constant uuid := 'a0a0a0a0-2133-4133-8133-000000000001';
  HOME constant uuid := 'cccccccc-2133-4133-8133-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  PIC constant jsonb := '[{"name": "shot.png", "type": "image/png", "content": "aGk="}]';
  v_ws text;
  v_prj text;
  v_task text;
  v_dsc text;
  v_job cloud.runner_jobs;
  v_json jsonb;
  v_run json;
begin
  insert into cloud.accounts (id, handle) values (A, 'ca-a');
  perform api.register_runner(A, HOME, 'home-mac', 8, '0.5.0',
    '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]', false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Chat actions"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj), CODING, BUDGET) ->> 'id';

  -- A picture alone is a message: its name kept, its bytes on the job only.
  v_json := api.v1_task_chat_send(A, v_task, '', null, BUDGET, PIC);
  assert v_json -> 'messages' -> 0 -> 'image_names' = '["shot.png"]' and v_json -> 'messages' -> 0 ->> 'body' = ''
    and v_json -> 'messages' -> 0 -> 'stopped' = 'false', format('a picture message misread: %s', v_json);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task));
  assert v_job.attachments = '[{"name": "shot.png", "content": "aGk="}]' and v_job.prompt like '%[Pictures: shot.png]',
    format('the job did not carry the picture: %s', v_job);

  -- Stopped while waiting: the job ends with no reply, its picture gone, the chat free.
  v_json := api.v1_task_chat_stop(A, v_task, BUDGET);
  assert v_json -> 'job' = 'null' and v_json -> 'result' ->> 'status' = 'idle', format('a waiting stop misread: %s', v_json);
  assert (select state = 'finished' and attachments = '[]' and reason = 'Stopped.' from cloud.runner_jobs where id = v_job.id),
    'a waiting job did not end, or kept its picture';

  -- Stopped while running: asked, told on renewal, and the words so far land as a stopped reply.
  perform api.v1_task_chat_send(A, v_task, 'Look', null, BUDGET, PIC);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task));
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  v_json := api.v1_task_chat_stop(A, v_task, BUDGET);
  assert v_json ->> 'job' = v_job.id::text and v_json -> 'result' ->> 'status' = 'replying', format('a running stop misread: %s', v_json);
  v_run := api.renew_runner_job(A, HOME, v_job.id, 900, BUDGET);
  assert (v_run ->> 'renewed')::boolean and (v_run ->> 'stop')::boolean, format('the renewal did not ask to stop: %s', v_run);
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"reply": "Half", "stopped": true,
    "usage": {"input": 1, "cacheCreation": 2, "cacheRead": 3, "output": 4}, "costUsd": 0.02}');
  v_json := api.v1_task_chat(A, v_task) -> 'messages' -> -1;
  assert v_json ->> 'body' = 'Half' and v_json -> 'stopped' = 'true' and v_json -> 'usage' ->> 'output' = '4'
    and v_json -> 'cost_usd' = '0.02' and (v_json ->> 'duration_ms')::bigint >= 0, format('a stopped reply misread: %s', v_json);
  assert (select attachments = '[]' from cloud.runner_jobs where id = v_job.id), 'a finished job kept its picture';
  assert api.v1_task_chat(A, v_task) -> 'messages' -> 1 -> 'usage' = 'null', 'a message with no job had usage';

  -- A Runner before protocol 8 knows no stop: its next renewal ends the job, with no reply.
  perform api.register_runner(A, HOME, 'home-mac', 7, '0.4.0',
    '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]', false, 900, BUDGET);
  perform api.v1_task_chat_send(A, v_task, 'Again', null, BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.task_chats where task_id = v_task));
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  perform api.v1_task_chat_stop(A, v_task, BUDGET);
  assert not (api.renew_runner_job(A, HOME, v_job.id, 900, BUDGET) ->> 'renewed')::boolean, 'an old Runner kept a stopped job';
  assert api.v1_task_chat(A, v_task) ->> 'status' = 'idle', 'an old Runner''s stopped chat did not end';
  perform api.register_runner(A, HOME, 'home-mac', 8, '0.5.0',
    '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]', false, 900, BUDGET);

  -- A discussion's stopped reply lands, and leaves its ideas as they were.
  v_dsc := api.v1_create_discussion(A, jsonb_build_object('project', v_prj, 'body', 'Ideas?'), BUDGET) ->> 'id';
  v_job := (select j from cloud.runner_jobs j where j.id = (select job_id from cloud.discussions where id = v_dsc));
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  assert api.v1_discussion_stop(A, v_dsc, BUDGET) ->> 'job' = v_job.id::text, 'a discussion reply was not asked to stop';
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, '{"reply": "So far", "stopped": true,
    "ideas": [{"id": "new_1", "title": "Half an idea", "outcome": "", "acceptance": [], "workflow": "wf_builtin_coding"}]}');
  v_json := api.v1_discussion(A, v_dsc);
  assert v_json -> 'messages' -> 1 ->> 'body' = 'So far' and v_json -> 'messages' -> 1 -> 'stopped' = 'true'
    and v_json -> 'ideas' = '[]' and v_json ->> 'status' = 'idle', format('a stopped discussion reply misread: %s', v_json);

  -- With a picture, as a task chat.
  v_json := api.v1_discussion_send(A, v_dsc, 'This', null, BUDGET, PIC);
  assert v_json -> 'messages' -> 2 -> 'image_names' = '["shot.png"]', format('a discussion picture misread: %s', v_json);

  raise notice 'sql checks: #2133 chat action checks passed';
end
$chat_actions$;

-- #2182: a new idea's pictures go with a discussion's first message, or with a task's first step.
do $request_images$
declare
  A constant uuid := 'a0a0a0a0-2182-4182-8182-000000000001';
  HOME constant uuid := 'cccccccc-2182-4182-8182-000000000003';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  PIC constant jsonb := '[{"name": "shot.png", "type": "image/png", "content": "aGk="}]';
  FILES constant jsonb := '[{"name": "shot.png", "content": "aGk="}]';
  v_prj text;
  v_task jsonb;
  v_json jsonb;
  v_job cloud.runner_jobs;
begin
  insert into cloud.accounts (id, handle) values (A, 'ri-a');
  perform api.register_runner(A, HOME, 'home-mac', 8, '0.5.0', '[{"name": "claude-code", "installed": true}]', false, 900, BUDGET);
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site',
    'workspace', api.v1_create_workspace(A, '{"name": "Request images"}', BUDGET) ->> 'id'), BUDGET) ->> 'id';

  v_json := api.v1_create_discussion(A, jsonb_build_object('project', v_prj, 'body', '', 'images', PIC), BUDGET);
  assert v_json -> 'messages' -> 0 -> 'image_names' = '["shot.png"]', format('a discussion''s first picture misread: %s', v_json);
  assert (select attachments = FILES from cloud.runner_jobs where discussion_id = v_json ->> 'id'),
    'a discussion''s first job did not carry its picture';

  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj, 'run', true, 'images', PIC), CODING, BUDGET);
  assert api.v1_task_chat(A, v_task ->> 'id') -> 'messages' -> 0 -> 'image_names' = '["shot.png"]',
    'a task''s request did not show its picture';
  assert not v_task ? 'images', 'a task answered its pictures';
  v_job := (select j from cloud.runner_jobs j where j.task_id = v_task ->> 'id');
  assert v_job.attachments = FILES and v_job.flow ->> 'verb' = 'create', format('the create step did not carry the picture: %s', v_job);
  perform cloud.v1_dispatch_flow(v_task ->> 'id', 'implement');
  assert (select attachments = '[]' from cloud.runner_jobs where task_id = v_task ->> 'id' and flow ->> 'verb' = 'implement'),
    'a later step carried the request''s picture';

  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Plain', 'project', v_prj, 'run', true), CODING, BUDGET);
  assert (select attachments = '[]' from cloud.runner_jobs where task_id = v_task ->> 'id'), 'a task with no picture carried one';

  raise notice 'sql checks: #2182 request image checks passed';
end
$request_images$;

begin;

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

-- #2135: a runtime is bound to one Runner, carries its connector's settings, and hands its key over
-- in one job that keeps nothing of the key.
do $runtime_settings$
declare
  A constant uuid := 'a0a0a0a0-2135-4135-8135-000000000001';
  HOME constant uuid := 'cccccccc-2135-4135-8135-000000000003';
  OTHER constant uuid := 'dddddddd-2135-4135-8135-000000000004';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_list jsonb;
  v_default text;
  v_gate text;
  v_task text;
  v_job cloud.runner_jobs;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'rt-2135');
  -- A runtime made before any Runner binds to none, and to the first that registers.
  v_default := (api.v1_list_runtimes(A) -> 'data' -> 0 ->> 'id');
  assert (select runner from cloud.runtimes where id = v_default) is null, 'Global default bound to a Runner nobody had';
  perform api.register_runner(A, HOME, 'home-mac', 9, '0.5.0',
    '[{"name": "codex", "installed": true, "settings": [{"key": "apiKey", "label": "OpenAI API key", "kind": "secret"}]},
      {"name": "kimi", "installed": false}]', false, 900, BUDGET);
  v_list := api.v1_list_runtimes(A);
  assert v_list -> 'data' -> 0 ->> 'runner' = HOME::text, format('Global default was not bound to the Runner: %s', v_list);
  assert v_list -> 'connectors' = '{"codex": "ready", "kimi": "not_installed"}', format('a new connector misread: %s', v_list);
  assert v_list -> 'connector_settings' -> 'codex' -> 0 ->> 'key' = 'apiKey', format('the settings misread: %s', v_list);
  assert v_list -> 'runners' = jsonb_build_array(jsonb_build_object('id', HOME, 'name', 'home-mac', 'online', true)),
    format('the Runners misread: %s', v_list);

  -- Any of the eight, on the account's own Runner only, with its settings.
  v_gate := api.v1_create_runtime(A, jsonb_build_object('name', 'Gate', 'connector', 'codex', 'model', 'gpt-5.1-codex',
    'runner', HOME, 'settings', '{"provider": "endpoint", "baseUrl": "https://llm.acme/v1"}'::jsonb), BUDGET) ->> 'id';
  assert api.v1_create_runtime(A, jsonb_build_object('name', 'K', 'connector', 'kimi', 'runner', HOME), BUDGET) ->> 'connector' = 'kimi',
    'Kimi Code was refused';
  perform pg_temp.refuses(format('select api.v1_create_runtime(%L, %L, %s)', A,
    jsonb_build_object('name', 'Theirs', 'connector', 'codex', 'runner', OTHER), BUDGET), 'AKB28', 'a runtime bound to a stranger''s computer');
  assert api.v1_update_runtime(A, v_gate, '{"settings": {"provider": "endpoint", "baseUrl": "https://b/v1", "reasoning": "high"}}', BUDGET)
    -> 'settings' ->> 'reasoning' = 'high', 'a setting was not saved';

  -- A task's step carries the settings and goes to that Runner, with the project's folder there.
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Gate one', 'run', true, 'runtime', v_gate), CODING, BUDGET) ->> 'id';
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.machine_id = HOME and v_job.runtime_id = v_gate and v_job.settings ->> 'baseUrl' = 'https://b/v1',
    format('the step was not bound: %s', row_to_json(v_job));
  v_json := api.list_runner_jobs(A, HOME) -> -1;
  assert v_json ->> 'runtimeId' = v_gate and v_json -> 'settings' ->> 'reasoning' = 'high' and v_json -> 'secret' = 'false',
    format('the Runner misread the step: %s', v_json);
  update cloud.runner_jobs set state = 'finished', outcome = 'done', finished_at = now() where id = v_job.id;

  -- The key: one job for that Runner, taken once, never in a read; done, the list says it is set.
  v_json := api.v1_set_runtime_secrets(A, v_gate, '{"apiKey": "sk-2135"}', BUDGET);
  v_job := (select j from cloud.runner_jobs j where j.id = (v_json ->> 'job')::uuid);
  assert v_job.test and v_job.machine_id = HOME and v_job.runtime_id = v_gate, 'the key job was not bound';
  assert api.list_runner_jobs(A, HOME)::text not like '%sk-2135%', 'the key was in the job list';
  assert api.take_runner_secrets(A, HOME, v_job.id) is null, 'an unclaimed job gave up its key';
  assert api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET)::text not like '%sk-2135%', 'the claim read the key';
  assert api.take_runner_secrets(A, HOME, v_job.id) = '{"apiKey": "sk-2135"}', 'the Runner did not get its key';
  assert api.take_runner_secrets(A, HOME, v_job.id) is null, 'the key was handed over twice';
  assert (select secret::text from cloud.runner_jobs where id = v_job.id) = '{"apiKey": true}', 'the key outlived its handover';
  perform api.finish_runner_job(A, HOME, v_job.id, 'done', '', BUDGET, null);
  assert api.v1_runtime_test(A, v_job.id, 45) ->> 'outcome' = 'done', 'the key job misread';
  v_list := api.v1_list_runtimes(A);
  assert (select r -> 'secretsSet' from jsonb_array_elements(v_list -> 'data') r where r ->> 'id' = v_gate) = '["apiKey"]',
    format('a set key did not read as set: %s', v_list);
  assert v_list::text not like '%sk-2135%', 'the list read the key';
  -- Cleared, and the Runner's own report is the last word.
  v_json := api.v1_set_runtime_secrets(A, v_gate, '{"apiKey": null}', BUDGET);
  perform api.claim_runner_job(A, HOME, (v_json ->> 'job')::uuid, 900, BUDGET);
  perform api.take_runner_secrets(A, HOME, (v_json ->> 'job')::uuid);
  perform api.finish_runner_job(A, HOME, (v_json ->> 'job')::uuid, 'done', '', BUDGET, null);
  perform api.v1_runtime_test(A, (v_json ->> 'job')::uuid, 45);
  assert (select secrets -> v_gate from cloud.runners where owner_id = A) = '[]', 'a cleared key still read as set';
  perform api.report_runner_secrets(A, HOME, jsonb_build_object(v_gate, '["apiKey"]'::jsonb));
  assert (select secrets -> v_gate from cloud.runners where owner_id = A) = '["apiKey"]', 'the Runner''s report was not kept';
  -- One never taken is dropped when it times out.
  v_json := api.v1_set_runtime_secrets(A, v_gate, '{"apiKey": "sk-late"}', BUDGET);
  update cloud.runner_jobs set created_at = now() - interval '1 minute' where id = (v_json ->> 'job')::uuid;
  assert api.v1_runtime_test(A, (v_json ->> 'job')::uuid, 45) ->> 'reason' = 'timeout', 'a late key job was not stopped';
  assert (select secret from cloud.runner_jobs where id = (v_json ->> 'job')::uuid) = '{}', 'a late key outlived its job';

  -- An old Runner, an offline one, and one that is no longer the account's are refused.
  update cloud.runners set protocol = 8 where owner_id = A;
  perform pg_temp.refuses(format('select api.v1_set_runtime_secrets(%L, %L, %L, %s)', A, v_gate, '{"apiKey": "x"}', BUDGET),
    'AKB26', 'a key went to a Runner that would drop it');
  update cloud.runners set protocol = 9, live_until = now() - interval '1 second' where owner_id = A;
  perform pg_temp.refuses(format('select api.v1_set_runtime_secrets(%L, %L, %L, %s)', A, v_gate, '{"apiKey": "x"}', BUDGET),
    'AKB26', 'a key went to an offline Runner');
  perform api.register_runner(A, OTHER, 'laptop', 9, '0.5.0', '[]', false, 900, BUDGET);
  perform pg_temp.refuses(format('select api.v1_test_runtime(%L, %L, %L, %s)', A, v_gate, 'Reply with OK.', BUDGET),
    'AKB26', 'a test went to a Runner the runtime is not bound to');
  assert (select runner from cloud.runtimes where id = v_gate) = HOME, 'a new computer took over a bound runtime';

  raise notice 'sql checks: #2135 runtime settings checks passed';
end
$runtime_settings$;


-- A workspace's Runners (#2134): its folders' computers, and an owner removing one.
do $workspace_runners$
declare
  BUDGET constant integer := 100000;
  O constant uuid := 'a0a0a0a0-2134-4134-8134-000000000001';
  M constant uuid := 'b0b0b0b0-2134-4134-8134-000000000002';
  MAC constant uuid := 'd0d0d0d0-2134-4134-8134-000000000004';
  MINI constant uuid := 'e0e0e0e0-2134-4134-8134-000000000005';
  v_ws text;
  v_prj text;
  v_json jsonb;
  v_job json;
begin
  insert into cloud.accounts (id, handle) values (O, 'wr-o'), (M, 'wr-m');
  v_ws := api.v1_create_workspace(O, '{"name": "Runners"}', BUDGET) ->> 'id';
  insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (v_ws, M, 'member');
  v_prj := api.v1_create_project(O, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  assert api.v1_list_workspace_runners(M, v_ws) -> 'runners' = '[]', 'a computer with no folder was listed';

  -- Every computer an account connected is kept, by name.
  perform api.register_runner(M, MINI, 'Office mini', 9, '0.5.0', '[]', false, 900, BUDGET);
  perform api.release_runner(M, MINI, BUDGET);
  perform api.register_runner(M, MAC, 'Mia''s Mac', 9, '0.5.0', '[]', false, 900, BUDGET);
  assert (select count(*) from cloud.runner_machines where owner_id = M) = 2, 'a computer was forgotten';
  assert api.read_runner(M) ->> 'name' = 'Mia''s Mac', 'the Runner did not read its name';

  perform api.add_project_folder(M, MAC, 'Site', '/Users/m/site', BUDGET, v_prj);
  v_json := api.v1_list_workspace_runners(M, v_ws);
  assert jsonb_array_length(v_json -> 'runners') = 1
    and v_json -> 'runners' -> 0 ->> 'machine' = MAC::text
    and v_json -> 'runners' -> 0 ->> 'name' = 'Mia''s Mac'
    and v_json -> 'runners' -> 0 ->> 'owner' = (select coalesce(nullif(name, ''), handle) from cloud.accounts where id = M)
    and (v_json -> 'runners' -> 0 ->> 'connected')::boolean
    and v_json -> 'runners' -> 0 ->> 'last_active' is not null, format('the Runners misread: %s', v_json);

  -- Only an owner removes one; its folders go and it claims none of the workspace's jobs.
  perform pg_temp.refuses(format('select api.v1_remove_workspace_runner(%L, %L, %L, %s)', M, v_ws, MAC, BUDGET),
    'AKB14', 'a member removed a Runner');
  v_job := api.dispatch_runner_job(M, 'codex', v_prj, 'Build it', '[]', BUDGET);
  perform api.v1_remove_workspace_runner(O, v_ws, MAC, BUDGET);
  assert api.v1_list_workspace_runners(O, v_ws) -> 'runners' = '[]', 'a removed Runner was still listed';
  assert not exists (select 1 from cloud.project_folders where machine_id = MAC), 'a removed Runner kept its folder';
  perform pg_temp.refuses(format('select api.v1_remove_workspace_runner(%L, %L, %L, %s)', O, v_ws, MAC, BUDGET),
    'AKB20', 'a Runner was removed twice');
  assert json_array_length(api.list_runner_jobs(M, MAC)) = 0, 'a removed Runner listed the workspace''s job';
  assert not (api.claim_runner_job(M, MAC, (v_job ->> 'id')::uuid, 900, BUDGET) ->> 'claimed')::boolean,
    'a removed Runner claimed the workspace''s job';

  -- Its owner placing a folder there again brings it back.
  perform api.add_project_folder(M, MAC, 'Site', '/Users/m/site', BUDGET, v_prj);
  assert (api.claim_runner_job(M, MAC, (v_job ->> 'id')::uuid, 900, BUDGET) ->> 'claimed')::boolean,
    'a Runner placed again could not claim';
  assert jsonb_array_length(api.v1_list_workspace_runners(O, v_ws) -> 'runners') = 1, 'a Runner placed again was not listed';

  raise notice 'sql checks: #2134 workspace runners checks passed';
end
$workspace_runners$;

-- #2128: a running task stops, keeping its work, and resumes on the computer that has it.
do $run_controls$
declare
  A constant uuid := 'a0a0a0a0-2128-4128-8128-000000000001';
  HOME constant uuid := 'cccccccc-2128-4128-8128-000000000003';
  OTHER constant uuid := 'dddddddd-2128-4128-8128-000000000004';
  BUDGET constant integer := 100000;
  RUNTIMES constant jsonb := '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]';
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_job cloud.runner_jobs;
  v_next cloud.runner_jobs;
  v_json jsonb;
  v_run json;
begin
  insert into cloud.accounts (id, handle) values (A, 'rc-a');
  perform api.register_runner(A, HOME, 'home-mac', 10, '0.5.0', RUNTIMES, false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Run controls"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  insert into cloud.project_folders (project_id, machine_id, account_id, path) values (v_prj, HOME, A, '/work/site');
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj, 'run', true), CODING, BUDGET) ->> 'id';
  v_job := cloud.v1_flow_job(v_task);

  -- Only a running task stops.
  perform pg_temp.refuses(format('select api.v1_stop_task(%L, %L, %s)', A, v_task, BUDGET), 'AKB21', 'a queued task was stopped');
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  v_json := api.v1_stop_task(A, v_task, BUDGET);
  assert v_json ->> 'job' = v_job.id::text and v_json -> 'result' -> 'run' -> 'stopping' = 'true'
    and v_json -> 'result' -> 'run' ->> 'machine' = 'home-mac' and v_json -> 'result' ->> 'status' = 'running',
    format('a stop misread: %s', v_json);
  v_run := api.renew_runner_job(A, HOME, v_job.id, 900, BUDGET);
  assert (v_run ->> 'renewed')::boolean and (v_run ->> 'stop')::boolean, format('the renewal did not ask to stop: %s', v_run);
  perform api.finish_runner_job(A, HOME, v_job.id, 'stopped', '', BUDGET, '{"card": 7}');
  v_json := api.v1_task(A, v_task);
  assert v_json ->> 'status' = 'stopped' and v_json -> 'failure' = 'null' and v_json -> 'run' = 'null'
    and v_json -> 'resume' ->> 'machine' = 'home-mac', format('a stopped task misread: %s', v_json);
  assert api.v1_task_chat(A, v_task) ->> 'status' = 'idle', 'a stopped step left its chat replying';

  -- Resumed: the same step again, on the computer that ran it, even once the runtime moved.
  update cloud.runtimes set runner = OTHER where account_id = A;
  v_json := api.v1_resume_task(A, v_task, BUDGET);
  v_next := cloud.v1_flow_job(v_task);
  assert v_json ->> 'status' = 'queued' and v_json -> 'resume' = 'null' and v_next.id <> v_job.id
    and v_next.machine_id = HOME and v_next.project_dir = '/work/site'
    and v_next.flow = v_job.flow || '{"card": 7, "resume": true}',
    format('a resume misread: %s / %s', v_json, row_to_json(v_next));
  perform pg_temp.refuses(format('select api.v1_resume_task(%L, %L, %s)', A, v_task, BUDGET), 'AKB21', 'a queued task resumed twice');

  -- Failed, it resumes too; one whose step never ran does not.
  perform api.claim_runner_job(A, HOME, v_next.id, 900, BUDGET);
  perform api.finish_runner_job(A, HOME, v_next.id, 'failed', 'Claude Code exited with code 1', BUDGET, null);
  assert api.v1_task(A, v_task) -> 'resume' ->> 'machine' = 'home-mac', 'a failed task could not resume';
  update cloud.runner_jobs set claimed_machine = null where id = v_next.id;
  assert api.v1_task(A, v_task) -> 'resume' = 'null', 'a step that never ran resumed';

  -- An older Runner cannot pause a flow job: its renewal ends it, and the task stops.
  perform api.register_runner(A, HOME, 'home-mac', 9, '0.4.0', RUNTIMES, false, 900, BUDGET);
  update cloud.runtimes set runner = HOME where account_id = A;
  update cloud.runner_jobs set claimed_machine = HOME where id = v_next.id;
  perform api.v1_resume_task(A, v_task, BUDGET);
  v_job := cloud.v1_flow_job(v_task);
  perform api.claim_runner_job(A, HOME, v_job.id, 900, BUDGET);
  assert api.v1_stop_task(A, v_task, BUDGET) -> 'job' = 'null', 'an old Runner was told over its log';
  assert not (api.renew_runner_job(A, HOME, v_job.id, 900, BUDGET) ->> 'renewed')::boolean, 'an old Runner kept a stopped step';
  assert api.v1_task(A, v_task) ->> 'status' = 'stopped', 'an old Runner''s stopped step did not stop its task';
  update cloud.task_chats set job_id = (select id from cloud.runner_jobs where task_id = v_task order by seq desc limit 1) where task_id = v_task;
  perform cloud.v1_end_stopped_flow((select job_id from cloud.task_chats where task_id = v_task));
  assert api.v1_task_chat(A, v_task) ->> 'status' = 'idle', 'an old Runner''s stopped step left its chat replying';

  raise notice 'sql checks: #2128 run control checks passed';
end
$run_controls$;

-- #2110: a task's next step goes back to the computer of its last, and a reflect runs where its task landed.
do $own_computer$
declare
  A constant uuid := 'a0a0a0a0-2110-4110-8110-000000000001';
  HOME constant uuid := 'cccccccc-2110-4110-8110-000000000003';
  OTHER constant uuid := 'dddddddd-2110-4110-8110-000000000004';
  BUDGET constant integer := 100000;
  RUNTIMES constant jsonb := '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]';
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_landed text;
  v_bare text;
  v_job cloud.runner_jobs;
  v_held jsonb;
  v_id uuid;
begin
  insert into cloud.accounts (id, handle) values (A, 'oc-a');
  perform api.register_runner(A, OTHER, 'office-mac', 10, '0.5.0', RUNTIMES, false, 900, BUDGET);
  update cloud.runners set live_until = now() - interval '1 hour' where owner_id = A;
  perform api.register_runner(A, HOME, 'home-mac', 10, '0.5.0', RUNTIMES, false, 900, BUDGET);
  v_ws := api.v1_create_workspace(A, '{"name": "Own computer"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  insert into cloud.project_folders (project_id, machine_id, account_id, path)
  values (v_prj, HOME, A, '/home/site'), (v_prj, OTHER, A, '/office/site');
  update cloud.runners set live_until = case machine_id when HOME then now() + interval '1 hour' else now() - interval '1 hour' end
   where owner_id = A;

  -- A first step goes to the computer online; the next to the one that ran the last, though offline.
  v_task := api.v1_create_task(A, jsonb_build_object('title', 'Pricing', 'project', v_prj, 'run', true), CODING, BUDGET) ->> 'id';
  v_job := cloud.v1_flow_job(v_task);
  assert v_job.machine_id = HOME, format('a first step skipped the computer online: %s', row_to_json(v_job));
  update cloud.runner_jobs set state = 'finished', outcome = 'done', claimed_machine = OTHER, finished_at = now() where id = v_job.id;
  v_job := cloud.v1_dispatch_flow(v_task, 'implement');
  assert v_job.machine_id = OTHER and v_job.project_dir = '/office/site',
    format('a next step left the computer of the last: %s', row_to_json(v_job));
  assert not exists (select 1 from json_array_elements(api.list_runner_jobs(A, HOME)) e where e ->> 'id' = v_job.id::text),
    'another computer was offered a step pinned to an offline one';

  -- That computer's folder gone, the step goes where the rest do.
  update cloud.runner_jobs set state = 'finished', outcome = 'done', claimed_machine = OTHER, finished_at = now() where id = v_job.id;
  delete from cloud.project_folders where project_id = v_prj and machine_id = OTHER;
  v_job := cloud.v1_dispatch_flow(v_task, 'implement');
  assert v_job.machine_id = HOME, format('a step went to a computer with no folder: %s', row_to_json(v_job));
  update cloud.runner_jobs set state = 'finished', outcome = 'done', finished_at = now() where id = v_job.id;
  insert into cloud.project_folders (project_id, machine_id, account_id, path) values (v_prj, OTHER, A, '/office/site');

  -- A task landed on the offline computer waits for it; one with no landing reflects anywhere.
  v_landed := api.v1_create_task(A, jsonb_build_object('title', 'Landed', 'project', v_prj), CODING, BUDGET) ->> 'id';
  v_bare := api.v1_create_task(A, jsonb_build_object('title', 'Bare', 'project', v_prj), CODING, BUDGET) ->> 'id';
  update cloud.tasks set status = 'done', landed_owner = A, landed_machine = OTHER where id = v_landed;
  update cloud.tasks set status = 'done' where id = v_bare;
  assert (select count(*) from cloud.runner_jobs where project_id = v_prj and agent ->> 'name' = 'reflect' and state <> 'finished'
            and machine_id = OTHER and project_dir is null) = 1, 'a landed task did not queue a reflect where it landed';
  assert (select count(*) from cloud.runner_jobs where project_id = v_prj and agent ->> 'name' = 'reflect' and state <> 'finished') = 2,
    'a reflect was not queued once per computer';
  assert (api.runner_agents(A, HOME, v_prj) ->> 'reflectWaiting')::boolean, 'a task with no landing did not wait here';
  v_held := api.list_runner_jobs(A, HOME)::jsonb;
  assert (select count(*) from jsonb_array_elements(v_held) e where e -> 'agent' ->> 'name' = 'reflect') = 1,
    format('this computer was not offered exactly the unpinned reflect: %s', v_held);
  v_id := (select (e ->> 'id')::uuid from jsonb_array_elements(v_held) e where e -> 'agent' ->> 'name' = 'reflect');
  v_held := api.claim_runner_job(A, HOME, v_id, 900, BUDGET) -> 'job' -> 'agent' -> 'tasks';
  assert v_held = jsonb_build_array(jsonb_build_object('id', v_bare, 'number', (select number from cloud.tasks where id = v_bare))),
    format('a reflect read a task landed elsewhere: %s', v_held);
  perform api.finish_runner_job(A, HOME, v_id, 'done', '', BUDGET);
  assert (select reflect_waiting from cloud.tasks where id = v_landed), 'a reflect cleared a task it did not read';
  assert (select count(*) from cloud.runner_jobs where project_id = v_prj and agent ->> 'name' = 'reflect' and state <> 'finished') = 1,
    'a finished reflect queued another for the offline computer';
  assert not (api.runner_agents(A, HOME, v_prj) ->> 'reflectWaiting')::boolean, 'this computer still saw a reflect it cannot do';

  -- Back online, the landing computer reads its own.
  update cloud.runners set live_until = now() - interval '1 hour' where owner_id = A;
  perform api.register_runner(A, OTHER, 'office-mac', 10, '0.5.0', RUNTIMES, false, 900, BUDGET);
  v_id := (select id from cloud.runner_jobs where project_id = v_prj and agent ->> 'name' = 'reflect' and state <> 'finished');
  v_held := api.claim_runner_job(A, OTHER, v_id, 900, BUDGET);
  assert v_held -> 'job' -> 'agent' -> 'tasks' -> 0 ->> 'id' = v_landed and jsonb_array_length(v_held -> 'job' -> 'agent' -> 'tasks') = 1,
    format('the landing computer misread: %s', v_held);
  perform api.finish_runner_job(A, OTHER, v_id, 'done', '', BUDGET);
  assert not exists (select 1 from cloud.tasks where project_id = v_prj and reflect_waiting), 'a reflected task still waited';
  assert not cloud.reflect_job_open(v_prj, OTHER) and not cloud.reflect_job_open(v_prj, null), 'a reflect went on with nothing waiting';

  raise notice 'sql checks: #2110 own computer checks passed';
end
$own_computer$;

-- #2143: a task on a Runner removed from its workspace — refused when asked by hand, flagged when queued.
do $removed_runner_tasks$
declare
  BUDGET constant integer := 100000;
  O constant uuid := 'a0a0a0a0-2143-4143-8143-000000000001';
  M constant uuid := 'b0b0b0b0-2143-4143-8143-000000000002';
  MAC constant uuid := 'd0d0d0d0-2143-4143-8143-000000000004';
  RUNTIMES constant jsonb := '[{"name": "codex", "installed": true}]';
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_task text;
  v_job cloud.runner_jobs;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (O, 'rr-o'), (M, 'rr-m');
  v_ws := api.v1_create_workspace(O, '{"name": "Removed"}', BUDGET) ->> 'id';
  insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (v_ws, M, 'member');
  v_prj := api.v1_create_project(O, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  perform api.register_runner(M, MAC, 'Mia''s Mac', 10, '0.5.0', RUNTIMES, false, 900, BUDGET);
  perform cloud.v1_default_runtime(M);
  perform api.add_project_folder(M, MAC, 'Site', '/Users/m/site', BUDGET, v_prj);
  v_task := api.v1_create_task(M, jsonb_build_object('title', 'Later', 'project', v_prj), CODING, BUDGET) ->> 'id';
  perform api.v1_remove_workspace_runner(O, v_ws, MAC, BUDGET);

  -- Asked by hand: refused, keeping nothing.
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', M,
    jsonb_build_object('title', 'Now', 'project', v_prj, 'run', true), CODING, BUDGET), 'AKB26', 'a run task went to a removed Runner');
  assert not exists (select 1 from cloud.tasks where workspace_id = v_ws and title = 'Now'), 'a refused task was kept';
  perform pg_temp.refuses(format('select api.v1_task_chat_send(%L, %L, %L, null, %s)', M, v_task, 'Hi', BUDGET),
    'AKB26', 'a chat went to a removed Runner');
  assert not exists (select 1 from cloud.task_chat_messages where task_id = v_task), 'a refused chat message was kept';
  perform pg_temp.refuses(format('select api.v1_create_discussion(%L, %L, %s)', M,
    jsonb_build_object('project', v_prj, 'body', 'An idea'), BUDGET), 'AKB26', 'a discussion went to a removed Runner');

  -- Dispatched otherwise: it queues, saying so.
  v_job := cloud.v1_dispatch_flow(v_task, 'create', 'Later');
  v_json := api.v1_task(M, v_task);
  assert v_job.machine_id = MAC and v_json -> 'run' -> 'runner_removed' = 'true', format('a removed step misread: %s', v_json);
  assert not (api.claim_runner_job(M, MAC, v_job.id, 900, BUDGET) ->> 'claimed')::boolean, 'a removed Runner claimed a step';

  -- Placed again: it starts in that folder.
  perform api.add_project_folder(M, MAC, 'Site', '/Users/m/site', BUDGET, v_prj);
  assert api.v1_task(M, v_task) -> 'run' -> 'runner_removed' = 'false', 'a Runner placed again still read as removed';
  v_json := api.claim_runner_job(M, MAC, v_job.id, 900, BUDGET);
  assert (v_json ->> 'claimed')::boolean and v_json -> 'job' ->> 'projectDir' = '/Users/m/site',
    format('a step placed again did not start there: %s', v_json);

  raise notice 'sql checks: #2143 removed runner task checks passed';
end
$removed_runner_tasks$;


-- #2161: a discussion held in the user's own Claude Code session; the panel's Start alone makes a task.
do $external_discussions$
declare
  A constant uuid := 'a0a0a0a0-2161-4161-8161-000000000001';
  O constant uuid := 'b0b0b0b0-2161-4161-8161-000000000002';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_dsc text;
  v_idea text;
  v_version integer;
  v_json jsonb;
  v_task jsonb;
begin
  insert into cloud.accounts (id, handle) values (A, 'ext-a'), (O, 'ext-o');
  v_ws := api.v1_create_workspace(A, '{"name": "Plugin"}', BUDGET) ->> 'id';
  v_prj := api.v1_create_project(A, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';

  -- Made with no Runner and no message; the same host session answers the same discussion.
  v_json := api.v1_create_external_discussion(A, jsonb_build_object('project', v_prj, 'request_id', 'sess-1'), BUDGET);
  v_dsc := v_json ->> 'id';
  assert v_json ->> 'workspace' = v_ws and v_json ->> 'project' = v_prj and (v_json ->> 'external')::boolean
    and v_json -> 'messages' = '[]' and v_json ->> 'status' = 'idle' and v_json -> 'ideas' = '[]',
    format('an external discussion misread: %s', v_json);
  assert not exists (select 1 from cloud.runner_jobs where discussion_id = v_dsc), 'an external discussion sent a job';
  assert api.v1_create_external_discussion(A, jsonb_build_object('project', v_prj, 'request_id', 'sess-1'), BUDGET) ->> 'id' = v_dsc,
    'the same session made a second discussion';
  assert api.v1_create_external_discussion(O, jsonb_build_object('request_id', 'sess-1'), BUDGET) ->> 'id' <> v_dsc,
    'another account shared a discussion';
  perform pg_temp.refuses(format('select api.v1_discussion_send(%L, %L, %L, null, %s)', A, v_dsc, 'Hi', BUDGET),
    'AKB21', 'an external discussion took a message');
  assert not exists (select 1 from jsonb_array_elements(api.v1_list_chats(A, v_ws, null, 20) -> 'data') e where e ->> 'discussion' = v_dsc),
    'an external discussion was listed on the web';
  assert v_json ->> 'host' = 'claude-code', 'an external discussion named no host';
  assert api.v1_create_external_discussion(A, jsonb_build_object('request_id', 'codex-1', 'host', 'codex'), BUDGET) ->> 'host' = 'codex',
    'a Codex discussion misread its host';
  perform pg_temp.refuses(format('select api.v1_create_external_discussion(%L, %L, %s)', A, '{"request_id": "x-1", "host": "vim"}', BUDGET),
    'AKB21', 'an unknown host was taken');
  assert api.v1_discussion(A, v_dsc) ->> 'host' = 'claude-code', 'a discussion read no host';

  -- Save: the whole set, against the version read; a start in it is ignored.
  v_version := (v_json ->> 'version')::integer;
  v_json := api.v1_save_draft(A, v_dsc, v_version, jsonb_build_array(
    jsonb_build_object('title', 'Pricing page', 'outcome', 'Tiers.', 'acceptance', '["Shows tiers"]'::jsonb, 'start', true),
    jsonb_build_object('title', 'Blog', 'workflow', 'wf_builtin_coding')), BUDGET);
  assert (v_json ->> 'saved')::boolean and jsonb_array_length(v_json -> 'discussion' -> 'ideas') = 2
    and v_json -> 'discussion' -> 'ideas' -> 0 ->> 'workflow' = 'wf_builtin_coding'
    and (v_json -> 'discussion' ->> 'version')::integer > v_version, format('a draft save misread: %s', v_json);
  assert not exists (select 1 from cloud.tasks where discussion_id = v_dsc), 'a draft save started a task';
  perform pg_temp.refuses(format('select api.v1_save_draft(%L, %L, %s, %L, %s)', A, v_dsc,
    (v_json -> 'discussion' ->> 'version'), '[{"title": "X", "workflow": "wf_nope"}]', BUDGET), 'AKB20', 'a draft took a missing workflow');
  perform pg_temp.refuses(format('select api.v1_save_draft(%L, %L, %s, %L, %s)', O, v_dsc, 1, '[]', BUDGET),
    'AKB20', 'another saved a draft');

  -- A stale version is refused with the ideas as they stand; leaving one out drops it.
  v_json := api.v1_save_draft(A, v_dsc, v_version, '[]', BUDGET);
  assert not (v_json ->> 'saved')::boolean and jsonb_array_length(v_json -> 'discussion' -> 'ideas') = 2,
    format('a stale save was not refused: %s', v_json);
  v_version := (v_json -> 'discussion' ->> 'version')::integer;
  v_idea := v_json -> 'discussion' -> 'ideas' -> 0 ->> 'id';
  v_json := api.v1_save_draft(A, v_dsc, v_version, jsonb_build_array(
    jsonb_build_object('id', v_idea, 'title', 'Pricing page', 'outcome', 'Three tiers.', 'acceptance', '["Shows tiers"]'::jsonb)), BUDGET);
  assert (v_json ->> 'saved')::boolean and jsonb_array_length(v_json -> 'discussion' -> 'ideas') = 1
    and v_json -> 'discussion' -> 'ideas' -> 0 ->> 'outcome' = 'Three tiers.', format('a save did not drop the idea left out: %s', v_json);
  v_version := (v_json -> 'discussion' ->> 'version')::integer;

  -- Listed only when asked for, while an idea waits.
  assert not exists (select 1 from jsonb_array_elements(api.v1_list_chats(A, v_ws, null, 20) -> 'data') e where e ->> 'discussion' = v_dsc),
    'an external discussion was listed without external';
  v_json := api.v1_list_chats(A, v_ws, null, 20, true) -> 'data';
  assert v_json -> 0 ->> 'discussion' = v_dsc and v_json -> 0 ->> 'host' = 'claude-code' and v_json -> 0 ->> 'title' = 'Pricing page',
    format('an external discussion was not listed: %s', v_json);
  assert api.v1_list_chats(A, v_ws, v_dsc, 20, true) -> 'data' = '[]', 'the list did not page past an external discussion';

  -- Start names the version; a retry answers the same task.
  perform pg_temp.refuses(format('select api.v1_start_idea(%L, %L, %L, null, %L, %s, 10, %s)', A, v_dsc, v_idea, CODING, BUDGET, v_version - 1),
    'AKB27', 'a start on a moved version went');
  perform pg_temp.refuses(format('select api.v1_start_idea(%L, %L, %L, null, %L, %s, 10)', A, v_dsc, v_idea, CODING, BUDGET),
    'AKB27', 'a start named no version');
  v_task := api.v1_start_idea(A, v_dsc, v_idea, null, CODING, BUDGET, 10, v_version);
  assert v_task ->> 'project' = v_prj and v_task ->> 'discussion' = v_dsc and v_task ->> 'request' = E'Three tiers.\n\n## Done when\n- Shows tiers',
    format('an external start misread: %s', v_task);
  assert api.v1_start_idea(A, v_dsc, v_idea, null, CODING, BUDGET, 10, v_version) ->> 'id' = v_task ->> 'id'
    and (select count(*) from cloud.tasks where discussion_id = v_dsc) = 1, 'a retried start made a second task';
  v_json := api.v1_discussion(A, v_dsc);
  assert v_json -> 'ideas' -> 0 -> 'task' ->> 'id' = v_task ->> 'id', format('the started idea did not name its task: %s', v_json);
  v_json := api.v1_save_draft(A, v_dsc, (v_json ->> 'version')::integer, '[]', BUDGET);
  assert jsonb_array_length(v_json -> 'discussion' -> 'ideas') = 1, 'a save dropped a started idea';
  assert not exists (select 1 from jsonb_array_elements(api.v1_list_chats(A, v_ws, null, 20, true) -> 'data') e where e ->> 'discussion' = v_dsc),
    'an external discussion with no idea waiting was listed';

  raise notice 'sql checks: #2161 #2160 external discussion checks passed';
end
$external_discussions$;

-- #2123: a local board's open cards imported as tasks that do not run, by the numbers they expect.
do $board_import$
declare
  A constant uuid := 'a0a0a0a0-2123-4123-8123-000000000001';
  O constant uuid := 'b0b0b0b0-2123-4123-8123-000000000002';
  BUDGET constant integer := 100000;
  CODING constant jsonb := '{"wf_builtin_coding": {"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}}';
  v_prj text;
  v_other text;
  v_json jsonb;
  v_task text;
begin
  insert into cloud.accounts (id, handle) values (A, 'imp-a'), (O, 'imp-o');
  v_prj := api.v1_create_project(A, '{"name": "Imported"}', BUDGET) ->> 'id';
  v_json := api.v1_import_tasks(A, v_prj, 'board-1', jsonb_build_array(
    jsonb_build_object('ref', 2007, 'number', 1, 'title', 'Docs', 'workflow', 'wf_builtin_coding'),
    jsonb_build_object('ref', 2104, 'number', 2, 'title', '迁移', 'workflow', 'wf_builtin_coding')), CODING, BUDGET);
  assert v_json -> 'cards' = jsonb_build_array(
      jsonb_build_object('ref', 2007, 'task', (select id from cloud.tasks where project_id = v_prj and number = 1), 'number', 1, 'carded', false),
      jsonb_build_object('ref', 2104, 'task', (select id from cloud.tasks where project_id = v_prj and number = 2), 'number', 2, 'carded', false)),
    format('an import misread: %s', v_json);
  assert (v_json ->> 'next')::integer = 3, 'an import did not answer the next number';
  v_task := v_json -> 'cards' -> 1 ->> 'task';
  assert not exists (select 1 from cloud.tasks where project_id = v_prj and (run or status <> 'queued')), 'an imported task ran';
  assert not exists (select 1 from cloud.runner_jobs j join cloud.tasks t on t.id = j.task_id where t.project_id = v_prj), 'an import sent a job';

  -- A rerun answers the tasks made; the next card must take the next number.
  v_json := api.v1_import_tasks(A, v_prj, 'board-1', jsonb_build_array(
    jsonb_build_object('ref', 2104, 'number', 2, 'title', '迁移', 'workflow', 'wf_builtin_coding'),
    jsonb_build_object('ref', 2123, 'number', 3, 'title', 'Import', 'workflow', 'wf_builtin_coding')), CODING, BUDGET);
  assert v_json -> 'cards' -> 0 ->> 'task' = v_task and (v_json -> 'cards' -> 1 ->> 'number')::integer = 3
    and (select count(*) from cloud.tasks where project_id = v_prj) = 3, format('a rerun misread: %s', v_json);
  perform pg_temp.refuses(format('select api.v1_import_tasks(%L, %L, %L, %L, %L, %s)', A, v_prj, 'board-1',
    '[{"ref": 2165, "number": 7, "title": "X", "workflow": "wf_builtin_coding"}]', CODING, BUDGET),
    'AKB21', 'a card expecting the wrong number was taken');
  assert (select count(*) from cloud.tasks where project_id = v_prj) = 3, 'a refused card made a task';

  -- Another board, or a project with a task of its own, is refused; so is a stranger.
  perform pg_temp.refuses(format('select api.v1_import_tasks(%L, %L, %L, %L, %L, %s)', A, v_prj, 'board-2',
    '[{"ref": 1, "number": 4, "title": "X", "workflow": "wf_builtin_coding"}]', CODING, BUDGET),
    'AKB21', 'a second board imported into the same project');
  v_other := api.v1_create_project(A, '{"name": "Busy"}', BUDGET) ->> 'id';
  perform api.v1_create_task(A, jsonb_build_object('title', 'Mine', 'project', v_other), CODING -> 'wf_builtin_coding', BUDGET);
  perform pg_temp.refuses(format('select api.v1_import_tasks(%L, %L, %L, %L, %L, %s)', A, v_other, 'board-1',
    '[{"ref": 1, "number": 2, "title": "X", "workflow": "wf_builtin_coding"}]', CODING, BUDGET),
    'AKB21', 'an import went into a project with its own task');
  perform pg_temp.refuses(format('select api.v1_import_tasks(%L, %L, %L, %L, %L, %s)', O, v_prj, 'board-1', '[]', CODING, BUDGET),
    'AKB20', 'a stranger imported into the project');

  -- On review: the card's question, else approving the plan; once only.
  assert api.v1_import_reviews(A, v_prj, jsonb_build_array(
    jsonb_build_object('task', v_task, 'review', null),
    jsonb_build_object('task', v_json -> 'cards' -> 1 ->> 'task', 'review',
      '{"question": "Which tier?", "options": ["Free", "Pro"], "position": 2}'::jsonb)), BUDGET) = 2, 'reviews were not set';
  assert (select status = 'waiting_review' and review_status = 'ready' and review ->> 'question' = '批准这份方案？' and run
          from cloud.tasks where id = v_task), 'an imported card without a question was not on review';
  assert not exists (select 1 from cloud.runner_jobs where task_id = v_task), 'a card put on review sent a job';
  perform api.v1_index_cards(A, v_prj, jsonb_build_array(
    jsonb_build_object('number', 2, 'path', 'todo/2-migrate.md', 'seq', 1, 'front', '{}'::jsonb)), BUDGET);
  perform api.v1_create_decision(A, v_task, jsonb_build_object('decision', 'approve',
    'review_revision', (select review_revision from cloud.tasks where id = v_task)), '{"kind": "user"}', BUDGET);
  assert (cloud.v1_flow_job(v_task)).flow ->> 'verb' = 'implement', 'an approved imported card was not built';
  assert (select review ->> 'question' = 'Which tier?' and (review ->> 'card_question')::integer = 2
            and review -> 'options' -> 1 ->> 'label' = 'Pro'
          from cloud.tasks where id = v_json -> 'cards' -> 1 ->> 'task'), 'an imported card''s question was not asked';
  assert api.v1_import_reviews(A, v_prj, jsonb_build_array(jsonb_build_object('task', v_task)), BUDGET) = 0,
    'a card on review was put on review again';

  raise notice 'sql checks: #2123 board import checks passed';
end
$board_import$;

-- #2196: a computer shared with a team workspace runs its members' tasks in its owner's folder and
-- runtime; ending the share stops theirs and leaves the owner's.
do $shared_runners$
declare
  O constant uuid := 'a0a0a0a0-2196-4196-8196-000000000001';
  M constant uuid := 'b0b0b0b0-2196-4196-8196-000000000002';
  X constant uuid := 'c0c0c0c0-2196-4196-8196-000000000003';
  MAC constant uuid := 'd0d0d0d0-2196-4196-8196-000000000004';
  BUDGET constant integer := 100000;
  RUNTIMES constant jsonb := '[{"name": "codex", "installed": true}, {"name": "claude-code", "installed": true}]';
  CODING constant jsonb := '{"id": "wf_builtin_coding", "builtin": true, "name": "Coding", "lands": true,
    "hash": "c1", "files": {"WORKFLOW.md": "coding"}}';
  v_ws text;
  v_prj text;
  v_mine text;
  v_theirs text;
  v_queued text;
  v_job cloud.runner_jobs;
  v_own cloud.runner_jobs;
  v_json jsonb;
begin
  insert into cloud.accounts (id, handle) values (O, 'sr-o'), (M, 'sr-m'), (X, 'sr-x');
  v_ws := api.v1_create_workspace(O, '{"name": "Shared"}', BUDGET) ->> 'id';
  insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (v_ws, M, 'member'), (v_ws, X, 'owner');
  v_prj := api.v1_create_project(O, jsonb_build_object('name', 'Site', 'workspace', v_ws), BUDGET) ->> 'id';
  perform api.register_runner(O, MAC, 'Tao''s Mac', 10, '0.5.0', RUNTIMES, false, 900, BUDGET);
  perform api.add_project_folder(O, MAC, 'Site', '/Users/o/site', BUDGET, v_prj);
  insert into cloud.runtimes (id, account_id, name, connector, runner, settings)
  values ('rt_sr_mac', O, 'Codex on Mac', 'codex', MAC, '{"effort": "high"}');

  -- Off until its owner shares it: nobody else may, and a personal workspace has no one to share with.
  v_json := api.v1_list_workspace_runners(M, v_ws) -> 'runners' -> 0;
  assert not (v_json ->> 'shared')::boolean and v_json ->> 'owner_account' = O::text
    and v_json -> 'projects' = jsonb_build_array(v_prj) and not v_json ? 'runs', format('a Runner misread: %s', v_json);
  perform pg_temp.refuses(format('select api.v1_create_task(%L, %L, %L, %s)', M,
    jsonb_build_object('title', 'Early', 'project', v_prj, 'run', true, 'machine', MAC), CODING, BUDGET),
    'AKB26', 'a member ran on a computer not shared');
  perform pg_temp.refuses(format('select api.v1_share_runner(%L, %L, %L, true, %s)', M, v_ws, MAC, BUDGET),
    'AKB20', 'a member shared another''s computer');
  perform pg_temp.refuses(format('select api.v1_share_runner(%L, %L, %L, true, %s)', X, v_ws, MAC, BUDGET),
    'AKB20', 'a workspace owner shared another''s computer');
  perform pg_temp.refuses(format('select api.v1_share_runner(%L, %L, %L, true, %s)', O,
    (select id from cloud.v1_workspaces where account_id = O and personal), MAC, BUDGET),
    'AKB20', 'a computer was shared with a personal workspace');

  -- Shared: a member with no computer of their own runs there, in its owner's folder and runtime.
  perform api.v1_share_runner(O, v_ws, MAC, true, BUDGET);
  assert (api.v1_list_workspace_runners(M, v_ws) -> 'runners' -> 0 ->> 'shared')::boolean, 'a shared computer was not listed shared';
  v_theirs := api.v1_create_task(M, jsonb_build_object('title', 'Theirs', 'project', v_prj, 'run', true), CODING, BUDGET) ->> 'id';
  v_job := cloud.v1_flow_job(v_theirs);
  assert v_job.owner_id = M and v_job.machine_id = MAC and v_job.project_dir = '/Users/o/site'
    and v_job.runtime_id = 'rt_sr_mac' and v_job.runtime = 'codex' and v_job.settings = '{"effort": "high"}',
    format('a member''s job misread: %s', row_to_json(v_job));
  v_json := api.v1_task(M, v_theirs);
  assert v_json -> 'run' ->> 'machine' = 'Tao''s Mac' and v_json -> 'run' ->> 'runtime_name' = 'Codex on Mac'
    and (v_json -> 'run' ->> 'runner_connected')::boolean, format('a member''s run misread: %s', v_json);
  assert json_array_length(api.list_runner_jobs(O, MAC)) = 1, 'the owner''s Runner did not list a member''s job';
  assert (api.claim_runner_job(O, MAC, v_job.id, 900, BUDGET) ->> 'claimed')::boolean, 'the owner''s Runner could not claim';
  assert (select claimed_by from cloud.runner_jobs where id = v_job.id) = O, 'the claim did not name its Runner';
  assert (api.renew_runner_job(O, MAC, v_job.id, 900, BUDGET) ->> 'renewed')::boolean, 'the owner''s Runner could not renew';

  -- The member sees the computer and runtime, never the folder or the settings.
  assert api.read_runner_job(M, v_job.id) -> 'job' ->> 'projectDir' is null
    and (api.read_runner_job(M, v_job.id) -> 'job' -> 'settings')::jsonb = '{}', 'a member read the folder';
  assert api.read_runner_job(O, v_job.id) -> 'job' ->> 'projectDir' = '/Users/o/site', 'the owner''s Runner lost the folder';
  assert api.v1_list_workspace_runners(M, v_ws)::text not like '%/Users/o%', 'a member read a path';

  -- The owner sees who runs there; a pick of a computer not theirs is refused, their own default kept.
  v_queued := api.v1_create_task(M, jsonb_build_object('title', 'Queued', 'project', v_prj, 'run', true, 'machine', MAC),
    CODING, BUDGET) ->> 'id';
  v_mine := api.v1_create_task(O, jsonb_build_object('title', 'Mine', 'project', v_prj, 'run', true), CODING, BUDGET) ->> 'id';
  v_own := cloud.v1_flow_job(v_mine);
  assert (select machine_id from cloud.tasks where id = v_mine) is null and v_own.machine_id = MAC, 'the owner''s task was pinned';
  perform api.claim_runner_job(O, MAC, v_own.id, 900, BUDGET);
  v_json := api.v1_list_workspace_runners(O, v_ws) -> 'runners' -> 0 -> 'runs';
  assert v_json = '{"count": 2, "by": ["sr-m"]}', format('the owner misread the members'' runs: %s', v_json);

  -- Ending the share stops the members' runs and queued steps; the owner's own keeps running.
  v_json := api.v1_share_runner(O, v_ws, MAC, false, BUDGET);
  assert v_json -> 'stop' = jsonb_build_array(v_job.id) and not (v_json -> 'result' ->> 'shared')::boolean,
    format('ending the share misread: %s', v_json);
  assert (select stop_requested from cloud.runner_jobs where id = v_job.id), 'a member''s run kept going';
  assert not (select stop_requested from cloud.runner_jobs where id = v_own.id), 'the owner''s own run was stopped';
  assert api.v1_task(M, v_queued) ->> 'status' = 'stopped' and api.v1_task(M, v_queued) -> 'run' = 'null',
    'a member''s queued step was left queued';
  assert not exists (select 1 from cloud.tasks where id in (v_theirs, v_queued) and machine_id is not null),
    'a member''s task stayed pinned';
  assert json_array_length(api.list_runner_jobs(O, MAC)) = 2, 'the owner''s Runner lost its held jobs';
  perform api.finish_runner_job(O, MAC, v_job.id, 'stopped', '', BUDGET, null);
  v_json := api.v1_task(M, v_theirs);
  assert v_json ->> 'status' = 'stopped' and v_json -> 'resume' ->> 'machine' = 'Tao''s Mac'
    and not (v_json -> 'resume' ->> 'available')::boolean, format('a stopped member task misread: %s', v_json);

  -- Resuming asks for another computer; picking a shared one starts the step there afresh.
  perform pg_temp.refuses(format('select api.v1_resume_task(%L, %L, %s)', M, v_theirs, BUDGET),
    'AKB26', 'a member resumed on a computer no longer shared');
  perform pg_temp.refuses(format('select api.v1_resume_task(%L, %L, %s, %L)', M, v_theirs, BUDGET, MAC),
    'AKB26', 'a member picked a computer no longer shared');
  perform api.v1_share_runner(O, v_ws, MAC, true, BUDGET);
  perform api.v1_resume_task(M, v_queued, BUDGET, MAC);
  v_job := cloud.v1_flow_job(v_queued);
  assert v_job.machine_id = MAC and v_job.runtime_id = (cloud.v1_host_runtime(O, MAC)).id and not v_job.flow ? 'resume',
    format('a picked resume misread: %s', row_to_json(v_job));

  -- Stopping the workspace's tasks on it ends the share too.
  perform api.v1_remove_workspace_runner(O, v_ws, MAC, BUDGET);
  assert not exists (select 1 from cloud.shared_runners where machine_id = MAC), 'a removed computer stayed shared';
  assert api.v1_task(M, v_queued) ->> 'status' = 'stopped', 'a removed computer kept a member''s queued step';

  raise notice 'sql checks: #2196 shared runner checks passed';
end
$shared_runners$;

rollback;
