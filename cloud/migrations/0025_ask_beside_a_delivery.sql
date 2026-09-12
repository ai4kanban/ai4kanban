-- A card can ask again while its delivery waits for the answer (#647).
--
-- One task keeps one live row, and that is what a publisher relies on: a card revised twice
-- before anyone looks must not leave three rows asking about revisions two of them no longer
-- bind. The rule costs one case, though. A delivery that stops for an answer — sent back by
-- review, or held at landing — leaves its own event `running`, so `publish_event` finds that
-- row, sees a state it may not refresh, and answers with it unchanged. The card is waiting on
-- a person and no channel says so.
--
-- So a publication may name the running event it stands BESIDE, and that one is left out of
-- the look-up. The board raising it is the machine carrying that delivery, and only that
-- machine names it: every other one publishes without a name, finds the running row, and
-- raises nothing — so one stop asks once however many machines watch the card.
--
-- The two rows are apart for the whole of their lives: the delivery's event keeps the
-- Implement it carries and reports the landing, and the new one carries the question and ends
-- when the card stops asking. `event_actions` still takes one action per event,
-- `event_requests` still holds one request per event, and a chat still threads the second
-- message under the first (`connector_jobs` roots a thread at the task's earliest message).

-- ---------------------------------------------------------------------------
-- "One live row per task" narrows to "one row ASKING per task"
-- ---------------------------------------------------------------------------

-- 0004's index is what a second row runs into, and the sentence it was written for is the
-- narrower one: a card revised twice before anyone looks must not leave three rows asking
-- about revisions two of them no longer bind. A row a delivery is REPORTING against asks
-- nobody anything, so it is not what that sentence is about — and `publish_event`'s own
-- look-up is still what keeps a finished delivery's row as history rather than reusing it.
--
-- Still a backstop against the race it always guarded: two publications landing together can
-- no more leave one card asking twice than they could before.
drop index if exists cloud.events_one_live_per_task;
create unique index events_one_live_per_task
  on cloud.events (board_id, task_id)
  where board_id is not null and state = 'actionable';
drop index if exists cloud.events_one_live_per_workspace_task;
create unique index events_one_live_per_workspace_task
  on cloud.events (workspace_id, task_id)
  where workspace_id is not null and state = 'actionable';

create or replace function api.publish_event(
  p_subject uuid,
  p_board uuid,
  p_workspace uuid,
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
  p_brought_in boolean,
  p_daily_write_budget integer,
  p_besides uuid default null
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_event cloud.events;
  v_brought_in timestamptz := case when coalesce(p_brought_in, false) then now() else null end;
begin
  if num_nonnulls(p_board, p_workspace) <> 1 then
    raise exception 'An event names a board or a workspace, never both.' using errcode = 'AKB10';
  end if;

  if p_workspace is not null then
    perform cloud.require_member(p_workspace, p_subject);
  else
    select * into v_board from cloud.boards where id = p_board;
    if v_board.id is null then
      perform cloud.count_write(p_daily_write_budget);
      insert into cloud.boards (id, owner_id, name) values (p_board, p_subject, '');
      select * into v_board from cloud.boards where id = p_board;
    end if;
    perform cloud.require_owner(v_board.owner_id, p_subject);
  end if;

  select * into v_event
  from cloud.events e
  where e.task_id = p_task_id
    and e.board_id is not distinct from p_board
    and e.workspace_id is not distinct from p_workspace
    and (p_besides is null or e.id <> p_besides)
    and (
      e.finished_at is null
      or (e.state = 'stale' and not exists (select 1 from cloud.event_actions a where a.event_id = e.id))
    )
  order by e.changed_at desc
  limit 1;

  if v_event.id is not null then
    if v_event.state = 'actionable' and v_event.fingerprint = p_fingerprint then
      if v_event.revision is distinct from p_revision
         or v_event.release is distinct from coalesce(p_release, '') then
        perform cloud.count_write(p_daily_write_budget);
        update cloud.events
           set revision = p_revision,
               release = coalesce(p_release, ''),
               content_at = now()
         where id = v_event.id
        returning * into v_event;
      end if;
      return cloud.event_json(v_event);
    end if;
    if v_event.state <> 'actionable' and v_event.state <> 'stale' then
      return cloud.event_json(v_event);
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.events
       set task_title = p_task_title,
           release = coalesce(p_release, ''),
           revision = p_revision,
           kind = p_kind,
           decision = p_decision,
           questions = coalesce(p_questions, '[]'::jsonb),
           summary = coalesce(p_summary, ''),
           notes = coalesce(p_notes, ''),
           fingerprint = p_fingerprint,
           state = 'actionable',
           finished_at = null,
           brought_in_at = v_brought_in,
           changed_at = now(),
           content_at = now()
     where id = v_event.id
    returning * into v_event;
    perform cloud.hint_audience(v_event);
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.events (
    owner_id, board_id, workspace_id, task_id, task_title, release, revision, kind, decision,
    questions, summary, notes, fingerprint, brought_in_at
  ) values (
    coalesce(v_board.owner_id, p_subject), p_board, p_workspace, p_task_id, p_task_title,
    coalesce(p_release, ''), p_revision, p_kind, p_decision,
    coalesce(p_questions, '[]'::jsonb), coalesce(p_summary, ''), coalesce(p_notes, ''),
    p_fingerprint, v_brought_in
  )
  returning * into v_event;
  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid) from public;
grant execute on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer, uuid) to service_role;

-- The one without it goes, or a call passing every argument but the last is ambiguous between
-- the two and Postgres refuses it.
drop function if exists api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer);
