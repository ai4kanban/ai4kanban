-- A card edit an event cannot see must not interrupt anybody (#182).
--
-- #319 hashed the card's REVISION into an event's fingerprint, and a revision is a hash of
-- the whole card file. So every edit moved the fingerprint, every publication refreshed the
-- row, `changed_at` moved, and the bell marked a row unread again over a `release:` reset or
-- a typo in a section no event carries. The fingerprint now covers only what the person is
-- being asked to decide — the kind, the title, the questions, the summary, the notes.
--
-- That leaves the revision and the release with nowhere to land, and they cannot simply be
-- dropped: an action is refused against a revision Cloud does not hold (AKB03), and a Slack
-- message names the release it is promised to. So the event grows a SECOND clock:
--
--   changed_at   when it last became news        → the rail's order, the bell's unread mark
--   content_at   when any of it last moved       → whether Slack owes it a rewrite
--
-- A news write moves both. A quiet one moves `content_at` alone: Cloud ends up holding the
-- current revision and release, Slack's message is edited to match — an edit pings nobody —
-- and the row the user has already read stays read.

alter table cloud.events add column if not exists content_at timestamptz not null default now();

-- Every row that exists was last written when it last became news, so the two clocks start
-- level. Without this the column's default would date every live event to the migration and
-- put the whole board through one Slack rewrite.
update cloud.events set content_at = changed_at where content_at <> changed_at;

comment on column cloud.events.changed_at is
  'When this event last became news: what the rail orders by and what the bell''s unread mark compares against.';
comment on column cloud.events.content_at is
  'When any field of this event last moved, news or not. What a connector''s rewrite is owed against.';

-- ---------------------------------------------------------------------------
-- The publication, with the quiet branch
-- ---------------------------------------------------------------------------

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

  -- The row this task's event should go on: the live one, or one retired as `stale` that
  -- nobody ever acted on. A row with an action on record is never reused — that one is
  -- history, and the bell's 30 days are what it is for.
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
    -- Nothing the person is being asked to decide has moved. Whatever else did — the card's
    -- revision, the release it is promised to — is written through without touching
    -- `changed_at`: an action binds the revision, so Cloud has to hold the current one, and
    -- a row the user has already read must stay read.
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
    -- Live work somebody already acted on is a delivery's to report, not a publication's to
    -- refresh: the revision it bound is the one the action was granted against.
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
           changed_at = now(),
           content_at = now()
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

-- ---------------------------------------------------------------------------
-- What Slack is owed, against the second clock
-- ---------------------------------------------------------------------------

-- Unchanged but for which clock it reads. A message follows every field of its event, news
-- or not — an edit in a channel pings nobody, and a message naming a release the card no
-- longer carries is a message somebody would review from.
--
-- The version token is under BOTH names, carrying `content_at` either way. A migration and a
-- Worker deploy do not land together, and the Worker echoes this value straight back as
-- `p_rendered_at`: one that read a key the other did not send would record NULL, and a
-- delivery with no `rendered_at` is due forever — every message in the channel rewritten on
-- every pass until the two sides met. `changedAt` is the older Worker's name for it and can
-- go once nothing is running that reads it.
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
      'contentAt', e.content_at,
      'changedAt', e.content_at,
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
      and (d.id is null or d.state <> 'sent' or d.rendered_at is null or d.rendered_at < e.content_at)
      and coalesce(d.attempts, 0) < p_max_attempts
    order by e.content_at
    limit greatest(coalesce(p_limit, 20), 1)
  ) due;
$$;
revoke all on function api.slack_jobs(uuid, integer, integer) from public;
grant execute on function api.slack_jobs(uuid, integer, integer) to service_role;
