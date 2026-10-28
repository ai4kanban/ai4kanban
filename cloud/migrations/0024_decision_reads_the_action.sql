-- Once an event has been acted on, `decision` is what was DONE, not what was asked (#642).
--
-- A card holding a `[user]` question raises a `question` event, so `cloud.events.decision` is
-- `answer`. Ticking the confirmation and pressing **Implement** on that same card records an
-- action whose own decision is `implement` — the delivery runs, the question is answered
-- before landing, and the branch lands.
--
-- Nothing said so. `needsPerson` (cli/src/lib/cloud/events.ts) reports a finished delivery
-- only when `decision = 'implement'`, and `cloud.event_json` handed it the column the event
-- was RAISED with, so the landing left neither a notification nor a row on the card's rail —
-- the guarantee #640 gave every other Implement.
--
-- `cloud.request_json` already reads `cloud.event_actions.decision`, which is why the run
-- itself was always correct. This makes the rendered event read the same column once one
-- exists, so the desktop card page and cloud.ai4kanban.dev are fixed by the one change.
--
-- Rewriting `cloud.events.decision` on the action would fix it too, and would leave
-- `kind = 'question'` stored next to `decision = 'implement'` — a row contradicting itself.
-- The column keeps what was asked; the rendering reports what was decided.
--
-- Nothing else moves: an unacted event still renders the decision it asked for, so the button
-- a surface draws and the wording it uses are what they were.

create or replace function cloud.event_json(p_event cloud.events)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_event.id,
    'boardId', coalesce(p_event.board_id::text, ''),
    'workspaceId', coalesce(p_event.workspace_id::text, ''),
    'boardName', coalesce(
      (select b.name from cloud.boards b where b.id = p_event.board_id),
      (select w.name from cloud.workspaces w where w.id = p_event.workspace_id),
      ''
    ),
    'taskId', p_event.task_id,
    'taskTitle', p_event.task_title,
    'release', p_event.release,
    'revision', p_event.revision,
    'kind', p_event.kind,
    'decision', coalesce(
      (select a.decision from cloud.event_actions a where a.event_id = p_event.id),
      p_event.decision
    ),
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
    'reason', p_event.reason,
    'serverName', coalesce(
      (select s.machine_name from cloud.board_servers s
        where s.board_id = p_event.board_id and s.enabled
        limit 1),
      (select coalesce(nullif(s.node_name, ''), s.machine_name) from cloud.board_servers s
        where s.workspace_id = p_event.workspace_id
          and s.removed_at is null
          and s.enabled
          and s.lease_expires_at is not null
          and s.lease_expires_at > now()
          and s.owner_id = (select r.actor_id from cloud.event_requests r where r.event_id = p_event.id)
        order by s.lease_expires_at desc
        limit 1),
      (select coalesce(nullif(s.node_name, ''), s.machine_name) from cloud.board_servers s
        where s.workspace_id = p_event.workspace_id
          and not exists (select 1 from cloud.event_requests r
                           where r.event_id = p_event.id and r.actor_id is not null)
          and s.removed_at is null
          and s.enabled
          and s.lease_expires_at is not null
          and s.lease_expires_at > now()
        order by s.lease_expires_at desc
        limit 1),
      ''
    ),
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'broughtIn', p_event.brought_in_at is not null and p_event.state = 'actionable',
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;
