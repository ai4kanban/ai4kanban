-- Project roles (#2027): a task's guests, and the review page's chat with an agent.
--
-- - **Guests belong to the task**: every link of the task's checkpoints admits the same
--   invited emails; a guest comments and decides, and nothing else.
-- - **Access is decided in one place**: `cloud.v1_share_access` names the caller `owner`,
--   `guest`, or no role (a `link` link, read only). #2018 adds `member` there.
-- - **Only the owner chats**: each message is a job of the task on the owner's Runner, in the
--   task's queue; its reply comes back as the job finishes, and the agent's session is kept
--   per task so the next message continues it.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB25  `owner_only`: a guest or a read-only visitor at what only the owner may do.
-- AKB26  `chat_busy`: a reply is still on its way; `runner_offline`: the owner's Runner is not
--        connected.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.task_guests (
  task_id text not null references cloud.tasks (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  created_at timestamptz not null default now(),
  primary key (task_id, email)
);
alter table cloud.task_guests enable row level security;

insert into cloud.task_guests (task_id, email)
select distinct c.task_id, e from cloud.share_links l
join cloud.task_checkpoints c on c.id = l.checkpoint_id
cross join unnest(l.emails) e
on conflict do nothing;

alter table cloud.share_links drop column emails;
drop function cloud.v1_emails(jsonb);

-- The session a task's chat continues, and the job writing its reply.
create table cloud.task_chats (
  task_id text primary key references cloud.tasks (id) on delete cascade,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  -- The agent picked last.
  runtime text check (runtime in ('codex', 'claude-code')),
  job_id uuid references cloud.runner_jobs (id) on delete set null,
  session text,
  session_runtime text,
  -- `{ used, limit }` of the session, as the Runner last read it.
  context jsonb,
  -- How the last reply failed, until the next message.
  failure text check (failure in ('failed', 'conflict')),
  updated_at timestamptz not null default now()
);
alter table cloud.task_chats enable row level security;

create table cloud.task_chat_messages (
  id text primary key,
  task_id text not null references cloud.tasks (id) on delete cascade,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  role text not null check (role in ('user', 'agent')),
  body text not null check (length(btrim(body)) > 0 and octet_length(body) <= 65536),
  created_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index task_chat_messages_task on cloud.task_chat_messages (task_id, seq);
alter table cloud.task_chat_messages enable row level security;

-- The session a job continues.
alter table cloud.runner_jobs add column resume text;

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'project', p_job.project_id,
    'projectDir', p_job.project_dir,
    'task', p_job.task_id,
    'stage', p_job.stage,
    'attempt', p_job.attempt,
    'resume', p_job.resume,
    'prompt', p_job.prompt,
    'attachments', p_job.attachments,
    'state', case when cloud.runner_job_interrupted(p_job) then 'interrupted' else p_job.state end,
    'outcome', p_job.outcome,
    'reason', p_job.reason,
    'leaseExpiresAt', p_job.lease_expires_at,
    'createdAt', p_job.created_at,
    'finishedAt', p_job.finished_at
  );
$$;

create or replace function cloud.v1_share_link_json(l cloud.share_links) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'object', 'share_link', 'checkpoint', l.checkpoint_id, 'access', l.access,
    'expires_at', cloud.v1_ts(l.expires_at), 'revoked', l.revoked_at is not null,
    'active', l.revoked_at is null and l.expires_at > now(), 'created_at', cloud.v1_ts(l.created_at));
$$;

create function cloud.v1_guest_json(g cloud.task_guests) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('object', 'guest', 'task', g.task_id, 'email', g.email, 'created_at', cloud.v1_ts(g.created_at));
$$;

create function cloud.v1_chat_message_json(m cloud.task_chat_messages) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'role', m.role, 'body', m.body, 'created_at', cloud.v1_ts(m.created_at));
$$;

-- ---------------------------------------------------------------------------
-- Guests, as the owner manages them
-- ---------------------------------------------------------------------------

create function cloud.v1_own_task(p_account uuid, p_task text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.tasks where id = p_task and account_id = p_account) then
    perform cloud.v1_missing('task');
  end if;
end;
$$;

create function api.v1_list_guests(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_own_task(p_account, p_task);
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_guest_json(g) order by g.created_at, g.email)
    from cloud.task_guests g where g.task_id = p_task), '[]'), 'next', null);
end;
$$;

create function api.v1_add_guest(p_account uuid, p_task text, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g cloud.task_guests;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  perform cloud.v1_own_task(p_account, p_task);
  select * into g from cloud.task_guests where task_id = p_task and email = lower(btrim(p_email));
  if found then return cloud.v1_guest_json(g); end if;
  if (select count(*) from cloud.task_guests where task_id = p_task) >= 50 then
    perform cloud.v1_refuse('A task takes at most 50 guests.');
  end if;
  insert into cloud.task_guests (task_id, email) values (p_task, lower(btrim(p_email))) returning * into g;
  perform cloud.v1_emit(p_account, 'guest.added', cloud.v1_guest_json(g));
  return cloud.v1_guest_json(g);
end;
$$;

create function api.v1_remove_guest(p_account uuid, p_task text, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g cloud.task_guests;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  perform cloud.v1_own_task(p_account, p_task);
  delete from cloud.task_guests where task_id = p_task and email = lower(btrim(p_email)) returning * into g;
  if not found then perform cloud.v1_missing('guest'); end if;
  perform cloud.v1_emit(p_account, 'guest.removed', cloud.v1_guest_json(g));
  return cloud.v1_guest_json(g) || jsonb_build_object('deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Share links: the task's guests stand in for each link's emails
-- ---------------------------------------------------------------------------

create or replace function api.v1_create_share_link(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_hash text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if not exists (select 1 from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account) then
    perform cloud.v1_missing('checkpoint');
  end if;
  insert into cloud.share_links (id, account_id, checkpoint_id, token_hash, access, expires_at)
  values (cloud.v1_id('shr'), p_account, p_checkpoint, p_hash, coalesce(p_fields ->> 'access', 'invited'),
          now() + make_interval(days => coalesce((p_fields ->> 'expires_in_days')::integer, 7)))
  returning * into l;
  perform cloud.v1_emit(p_account, 'share_link.created', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

create or replace function api.v1_update_share_link(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into l from cloud.share_links where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('share link'); end if;
  if l.revoked_at is not null then perform cloud.v1_refuse('This link has been revoked.'); end if;
  if l.expires_at <= now() then perform cloud.v1_refuse('This link has expired.'); end if;
  update cloud.share_links set access = coalesce(p_fields ->> 'access', access), updated_at = now()
  where id = p_id returning * into l;
  perform cloud.v1_emit(p_account, 'share_link.updated', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who the caller is to a link
-- ---------------------------------------------------------------------------

-- The live link a token's hash names, and the caller's role on its task: `owner` for the
-- account, `guest` for an email the task invited, none on a `link` link. Raises otherwise.
create or replace function cloud.v1_share_access(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l cloud.share_links;
  v_task text;
  v_role text;
begin
  select * into l from cloud.share_links where token_hash = p_hash;
  if not found then
    raise exception 'This link is not valid.' using errcode = 'AKB24', detail = 'invalid';
  end if;
  if l.revoked_at is not null then
    raise exception 'This link has been revoked.' using errcode = 'AKB24', detail = 'revoked';
  end if;
  if l.expires_at <= now() then
    raise exception 'This link has expired.' using errcode = 'AKB24', detail = 'expired';
  end if;
  select task_id into v_task from cloud.task_checkpoints where id = l.checkpoint_id;
  if p_subject is not null and p_subject = l.account_id then
    v_role := 'owner';
  elsif p_subject is not null and p_email is not null
    and exists (select 1 from cloud.task_guests g where g.task_id = v_task and g.email = lower(p_email)) then
    v_role := 'guest';
  elsif l.access = 'link' then
    v_role := null;
  elsif p_subject is null then
    raise exception 'Sign in to open this review.' using errcode = 'AKB25', detail = 'sign_in_required';
  else
    raise exception 'This email is not invited to this review.' using errcode = 'AKB25', detail = 'not_invited';
  end if;
  return jsonb_build_object('link', l.id, 'account', l.account_id, 'checkpoint', l.checkpoint_id, 'task', v_task,
    'role', v_role);
end;
$$;

create or replace function cloud.v1_reviewer(p_role text, p_subject uuid, p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_role = 'owner'
    then jsonb_build_object('kind', 'user', 'handle', (select a.handle from cloud.accounts a where a.id = p_subject))
    else jsonb_build_object('kind', 'reviewer', 'email', lower(p_email),
           'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end;
$$;

create or replace function cloud.v1_share_writer(p_hash text, p_subject uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
begin
  if v ->> 'role' is null then
    raise exception 'This link is view only.' using errcode = 'AKB25', detail = 'view_only';
  end if;
  return v || jsonb_build_object('author', cloud.v1_reviewer(v ->> 'role', p_subject, p_email));
end;
$$;

create function cloud.v1_share_owner(p_hash text, p_subject uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
begin
  if v ->> 'role' is distinct from 'owner' then
    raise exception 'Only the task owner can do this.' using errcode = 'AKB25', detail = 'owner_only';
  end if;
  return v;
end;
$$;

-- A visitor without a role gets the card and the previews; a guest also the history; the
-- owner also the guests.
create or replace function api.v1_shared(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_role text := v ->> 'role';
  l cloud.share_links;
  c cloud.task_checkpoints;
  t cloud.tasks;
  k cloud.task_cards;
  v_out jsonb;
begin
  select * into l from cloud.share_links where id = v ->> 'link';
  select * into c from cloud.task_checkpoints where id = l.checkpoint_id;
  select * into t from cloud.tasks where id = c.task_id;
  select * into k from cloud.task_cards where task_id = c.task_id;

  v_out := jsonb_build_object(
    'object', 'shared_review',
    'role', v_role,
    'me', case when p_subject is null then null else jsonb_build_object('email', lower(p_email),
            'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end,
    'link', jsonb_build_object('id', l.id, 'access', l.access, 'expires_at', cloud.v1_ts(l.expires_at)),
    'owner', (select jsonb_build_object('handle', a.handle, 'name', a.name, 'avatar_url', a.avatar_url)
              from cloud.accounts a where a.id = l.account_id),
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'workflow', t.workflow ->> 'name',
              'project', (select p.name from cloud.projects p where p.id = t.project_id)),
    'checkpoint', case when v_role is null then cloud.v1_checkpoint_json(c) - 'status' else cloud.v1_checkpoint_json(c) end,
    'card', case when k.task_id is null then null else jsonb_build_object('version', t.card_version, 'body', k.body,
              'metadata', k.metadata, 'assets', k.assets) end,
    'artifacts', coalesce((
      select jsonb_agg(cloud.v1_artifact_json(a) || jsonb_build_object('versions', coalesce((
        select jsonb_agg(cloud.v1_version_json(av) #- '{file,url}' order by av.version)
        from cloud.artifact_versions av
        where av.artifact_id = a.id and (av.version = a.latest_version or av.version in (
          select (e.value ->> 'version')::integer from jsonb_each(coalesce(k.assets, '{}')) e
          where e.value ->> 'artifact' = a.id))), '[]')) order by a.id)
      from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0), '[]'));

  if v_role is null then return v_out; end if;
  v_out := v_out || jsonb_build_object(
    'decisions', coalesce((select jsonb_agg(cloud.v1_decision_json(d) order by d.id)
                           from cloud.decisions d where d.checkpoint_id = c.id), '[]'),
    'comments', coalesce((select jsonb_agg(cloud.v1_comment_json(m) order by m.id)
                          from cloud.checkpoint_comments m where m.checkpoint_id = c.id), '[]'),
    'revisions', coalesce((select jsonb_agg(jsonb_build_object('revision', r.revision, 'created_at', cloud.v1_ts(r.created_at))
                                            order by r.revision)
                           from cloud.checkpoint_revisions r where r.checkpoint_id = c.id), '[]'));
  if v_role <> 'owner' then return v_out; end if;
  return v_out || jsonb_build_object('guests', coalesce((
    select jsonb_agg(cloud.v1_guest_json(g) order by g.created_at, g.email)
    from cloud.task_guests g where g.task_id = t.id), '[]'));
end;
$$;

-- ---------------------------------------------------------------------------
-- The review page's chat
-- ---------------------------------------------------------------------------

-- The job writing the chat's reply, while it has not ended.
create function cloud.task_chat_job(p_chat cloud.task_chats) returns cloud.runner_jobs
language sql stable security definer set search_path = '' as $$
  select j.* from cloud.runner_jobs j
  where j.id = p_chat.job_id and j.state <> 'finished' and not cloud.runner_job_interrupted(j);
$$;

-- `status`: `idle`, `queued` behind the task's other jobs, `replying`, or how the last reply
-- failed (`failed`, `conflict`). `runtimes`: the agents the owner's Runner can run.
create function cloud.task_chat_json(p_account uuid, p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  j cloud.runner_jobs;
  r cloud.runners;
  v_status text := 'idle';
begin
  select * into h from cloud.task_chats where task_id = p_task;
  select * into r from cloud.runners where owner_id = p_account;
  if h.job_id is not null then
    j := cloud.task_chat_job(h);
    if j.id is null then v_status := 'failed';
    elsif j.state = 'waiting' and cloud.runner_job_queued(j) then v_status := 'queued';
    else v_status := 'replying';
    end if;
  elsif h.failure is not null then
    v_status := h.failure;
  end if;
  return jsonb_build_object(
    'object', 'task_chat',
    'messages', coalesce((
      select jsonb_agg(cloud.v1_chat_message_json(m) order by m.seq)
      from cloud.task_chat_messages m where m.task_id = p_task), '[]'),
    'status', v_status,
    'runtime', h.runtime,
    'runtimes', coalesce((
      select jsonb_agg(e ->> 'name') from jsonb_array_elements(r.runtimes) e
      where (e ->> 'installed')::boolean and coalesce((e ->> 'loggedIn')::boolean, true)), '[]'),
    'runner', jsonb_build_object('connected', coalesce(r.live_until > now(), false)),
    'context', case when h.session is not null and (h.context ->> 'limit')::integer > 0 then
      jsonb_build_object('used', (h.context ->> 'used')::integer, 'limit', (h.context ->> 'limit')::integer) end);
end;
$$;

-- What the Runner's agent is asked: the card-chat flow, the last 30 messages, and the newest.
create function cloud.task_chat_prompt(p_task text) returns text
language sql stable security definer set search_path = '' as $$
  with recent as (
    select m.role, m.body, row_number() over (order by m.seq desc) n
    from cloud.task_chat_messages m where m.task_id = p_task order by m.seq desc limit 30
  )
  select concat_ws(E'\n\n',
    'Answer the newest message in this task card''s review-page chat, following `akb guide card-chat`.',
    case when count(*) filter (where n > 1) > 0 then E'The conversation so far, oldest first:\n\n' || string_agg(
      case when role = 'user' then 'User: ' else 'Agent: ' end || body, E'\n\n' order by n desc) filter (where n > 1) end,
    E'The newest message:\n\n' || max(body) filter (where n = 1))
  from recent;
$$;

create function api.v1_shared_chat(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_owner(p_hash, p_subject, p_email);
begin
  return cloud.task_chat_json((v ->> 'account')::uuid, v ->> 'task');
end;
$$;

-- One message from the owner, answered by a job of the task. Switching agents starts a new session.
create function api.v1_shared_chat_send(
  p_hash text, p_subject uuid, p_email text, p_body text, p_runtime text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_owner(p_hash, p_subject, p_email);
  v_account uuid := (v ->> 'account')::uuid;
  v_task text := v ->> 'task';
  h cloud.task_chats;
  v_job json;
begin
  perform cloud.v1_write(v_account, p_daily_write_budget);
  perform 1 from cloud.tasks where id = v_task for update;
  insert into cloud.task_chats (task_id, account_id) values (v_task, v_account) on conflict (task_id) do nothing;
  select * into h from cloud.task_chats where task_id = v_task;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  if not exists (select 1 from cloud.runners r where r.owner_id = v_account and r.live_until > now()) then
    raise exception 'Your Runner is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
  values (cloud.v1_id('msg'), v_task, v_account, 'user', p_body);
  v_job := api.dispatch_runner_job(v_account, p_runtime, null, cloud.task_chat_prompt(v_task), '[]', p_daily_write_budget, v_task);
  if h.session_runtime is not distinct from p_runtime and h.session is not null then
    update cloud.runner_jobs set resume = h.session where id = (v_job ->> 'id')::uuid;
  end if;
  update cloud.task_chats set runtime = p_runtime, job_id = (v_job ->> 'id')::uuid, failure = null,
    session = case when session_runtime is distinct from p_runtime then null else session end,
    context = case when session_runtime is distinct from p_runtime then null else context end,
    updated_at = now()
  where task_id = v_task;
  return jsonb_build_object('account', v_account, 'result', cloud.task_chat_json(v_account, v_task));
end;
$$;

-- Clearing drops every message and the session; the agent picked stays.
create function api.v1_shared_chat_clear(p_hash text, p_subject uuid, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_owner(p_hash, p_subject, p_email);
  v_account uuid := (v ->> 'account')::uuid;
  v_task text := v ->> 'task';
  h cloud.task_chats;
begin
  perform cloud.v1_write(v_account, p_daily_write_budget);
  select * into h from cloud.task_chats where task_id = v_task for update;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  delete from cloud.task_chat_messages where task_id = v_task;
  update cloud.task_chats set job_id = null, session = null, session_runtime = null, context = null, failure = null,
    updated_at = now()
  where task_id = v_task;
  return jsonb_build_object('account', v_account, 'result', cloud.task_chat_json(v_account, v_task));
end;
$$;

-- ---------------------------------------------------------------------------
-- A finished job answers its chat
-- ---------------------------------------------------------------------------

drop function api.finish_runner_job(uuid, uuid, uuid, text, text, integer);

-- `p_report` is `{ reply?, session?, context? }`, what the agent said and where it left off.
create function api.finish_runner_job(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_outcome text,
  p_reason text,
  p_daily_write_budget integer,
  p_report jsonb default null
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs := cloud.held_runner_job(p_subject, p_machine, p_job);
  v_outcome text := p_outcome;
  v_reason text := nullif(p_reason, '');
  v_retry cloud.runner_jobs;
  v_reply text := nullif(btrim(left(coalesce(p_report ->> 'reply', ''), 60000)), '');
begin
  if v_job.id is null then
    return json_build_object('finished', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  if v_outcome = 'conflict' and (v_job.task_id is null or v_job.attempt >= 2) then
    v_outcome := 'failed';
    v_reason := 'The card was updated elsewhere.';
  end if;
  update cloud.runner_jobs
     set state = 'finished',
         outcome = v_outcome,
         reason = v_reason,
         finished_at = now(),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_outcome = 'conflict' then
    insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, stage, attempt, resume, prompt,
                                   attachments)
    values (v_job.owner_id, v_job.runtime, v_job.project_id, v_job.project_dir, v_job.machine_id, v_job.task_id, v_job.stage, 2,
            v_job.resume, v_job.prompt, v_job.attachments)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  if v_outcome = 'done' and v_job.stage = 'plan' and v_job.task_id is not null then
    perform cloud.v1_submit_draft(v_job.task_id);
  end if;

  if exists (select 1 from cloud.task_chats where job_id = p_job) then
    if v_outcome = 'done' and v_reply is not null then
      insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
      values (cloud.v1_id('msg'), v_job.task_id, v_job.owner_id, 'agent', v_reply);
    end if;
    update cloud.task_chats set
      job_id = v_retry.id,
      session = coalesce(p_report ->> 'session', session),
      session_runtime = case when p_report ->> 'session' is null then session_runtime else v_job.runtime end,
      context = coalesce(p_report -> 'context', context),
      failure = case v_outcome when 'failed' then
        case when v_reason = 'The card was updated elsewhere.' then 'conflict' else 'failed' end end,
      updated_at = now()
    where job_id = p_job;
  end if;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end);
end;
$$;
revoke all on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) from public;
grant execute on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function cloud.v1_guest_json(cloud.task_guests) from public;
revoke all on function cloud.v1_chat_message_json(cloud.task_chat_messages) from public;
revoke all on function cloud.v1_own_task(uuid, text) from public;
revoke all on function cloud.v1_share_owner(text, uuid, text) from public;
revoke all on function cloud.task_chat_job(cloud.task_chats) from public;
revoke all on function cloud.task_chat_json(uuid, text) from public;
revoke all on function cloud.task_chat_prompt(text) from public;
do $grants$
declare
  f text;
begin
  foreach f in array array[
    'api.v1_list_guests(uuid, text)',
    'api.v1_add_guest(uuid, text, text, integer)',
    'api.v1_remove_guest(uuid, text, text, integer)',
    'api.v1_shared_chat(text, uuid, text)',
    'api.v1_shared_chat_send(text, uuid, text, text, text, integer)',
    'api.v1_shared_chat_clear(text, uuid, text, integer)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$grants$;
