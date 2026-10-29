-- The tasks one computer runs or waits to run, for the Claude Code plugin's Tasks tab (#18).
-- One row per task: its jobs claimed there by the caller, and its waiting ones pinned there, or
-- the caller's unpinned ones when this is the caller's Runner.

alter table cloud.runner_jobs add column claimed_at timestamptz;
update cloud.runner_jobs set claimed_at = updated_at where state = 'claimed';

create function cloud.runner_job_claimed_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.state = 'claimed' and old.state is distinct from 'claimed' then new.claimed_at := now(); end if;
  return new;
end;
$$;

create trigger runner_job_claimed_at before update of state on cloud.runner_jobs
  for each row execute function cloud.runner_job_claimed_at();

-- `stop` names the route that stops it: `task` for a running step, `chat` for the caller's chat
-- reply, null while it waits.
create function api.list_machine_tasks(p_subject uuid, p_machine uuid) returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
      'task', t.id,
      'key', p.prefix || '-' || t.number,
      'title', t.title,
      'project', p.name,
      'runtime', x.runtime,
      'state', case when x.running then 'running' else 'queued' end,
      'since', x.since,
      'stop', case when x.flow then 'task' when x.chat then 'chat' end
    ) order by x.running desc, x.since, t.id), '[]'::json)
  from (
    select j.task_id,
           bool_or(j.state = 'claimed') as running,
           (array_agg(j.runtime order by j.state = 'claimed' desc, j.seq))[1] as runtime,
           coalesce(min(j.claimed_at) filter (where j.state = 'claimed'), min(j.created_at)) as since,
           bool_or(j.state = 'claimed' and j.flow is not null) as flow,
           bool_or(j.state = 'claimed' and exists (select 1 from cloud.task_chats h
                                                    where h.job_id = j.id and h.account_id = p_subject)) as chat
    from cloud.runner_jobs j
    where j.task_id is not null
      and ((j.state = 'claimed' and j.claimed_machine = p_machine and coalesce(j.claimed_by, j.owner_id) = p_subject
            and not cloud.runner_job_interrupted(j))
           or (j.state = 'waiting' and j.machine_id = p_machine
               and (j.owner_id = p_subject or cloud.runner_job_host(j) = p_subject))
           or (j.state = 'waiting' and j.machine_id is null and j.owner_id = p_subject
               and exists (select 1 from cloud.runners r where r.owner_id = p_subject and r.machine_id = p_machine)))
    group by j.task_id
  ) x
  join cloud.tasks t on t.id = x.task_id
  left join cloud.projects p on p.id = t.project_id;
$$;

revoke all on function cloud.runner_job_claimed_at() from public;
revoke all on function api.list_machine_tasks(uuid, uuid) from public;
grant execute on function api.list_machine_tasks(uuid, uuid) to service_role;
