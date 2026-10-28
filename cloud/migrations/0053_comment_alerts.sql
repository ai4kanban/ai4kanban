-- Reviewer comments alert the task's owner (#2029).
--
-- - **Only someone else's comment**: a reviewer's raises a `comment` alert; the owner's own,
--   through the app or an API key, reads the checkpoint's unread ones instead.
-- - **The desktop opts in**: a Runner lists `comment` alerts only when it asks for them, so an
--   older one never shows them as a failed task.

alter table cloud.alerts drop constraint alerts_kind_check;
alter table cloud.alerts
  add constraint alerts_kind_check check (kind in ('review', 'done', 'failed', 'comment')),
  add column comment_id text references cloud.checkpoint_comments (id) on delete cascade,
  add constraint alerts_comment_check check ((kind = 'comment') = (comment_id is not null));

create or replace function cloud.v1_alert_json(a cloud.alerts) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'object', 'alert', 'kind', a.kind, 'task', a.task_id,
    'task_title', t.title, 'project', t.project_id, 'checkpoint', a.checkpoint_id,
    'checkpoint_title', c.title,
    'comment', case when m.id is null then null else jsonb_build_object('id', m.id, 'author', m.author, 'body', m.body) end,
    'channel', a.channel, 'read', a.read_at is not null, 'created_at', cloud.v1_ts(a.created_at))
  from cloud.tasks t
  left join cloud.task_checkpoints c on c.id = a.checkpoint_id
  left join cloud.checkpoint_comments m on m.id = a.comment_id
  where t.id = a.task_id;
$$;

drop function cloud.raise_alert(cloud.tasks, text, text);

create function cloud.raise_alert(p_task cloud.tasks, p_kind text, p_checkpoint text, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runners;
  a cloud.alerts;
  v_desktop boolean;
begin
  select * into r from cloud.runners where owner_id = p_task.account_id and live_until > now() and notify;
  v_desktop := r.owner_id is not null and not exists (
    select 1 from cloud.project_folders f
     where f.project_id = p_task.project_id and f.machine_id = r.machine_id and not f.notify);
  insert into cloud.alerts (id, account_id, kind, task_id, checkpoint_id, comment_id, channel, machine_id)
  values (cloud.v1_id('alr'), p_task.account_id, p_kind, p_task.id, p_checkpoint, p_comment,
          case when v_desktop then 'desktop' else 'web' end, case when v_desktop then r.machine_id end)
  returning * into a;
  perform cloud.v1_emit(a.account_id, 'alert.created', cloud.v1_alert_json(a));
  if v_desktop then perform cloud.hint_desktop(a.account_id, 'alert', jsonb_build_object('alertId', a.id)); end if;
end;
$$;
revoke all on function cloud.raise_alert(cloud.tasks, text, text, text) from public;

create function cloud.comment_alerts() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.author ->> 'kind' = 'reviewer' then
    perform cloud.raise_alert((select t from cloud.tasks t where t.id = new.task_id), 'comment', new.checkpoint_id, new.id);
  else
    perform cloud.read_alerts_where(new.account_id, new.task_id, new.checkpoint_id, 'comment');
  end if;
  return null;
end;
$$;
revoke all on function cloud.comment_alerts() from public;
create trigger comment_alerts after insert on cloud.checkpoint_comments
  for each row execute function cloud.comment_alerts();

drop function api.list_desktop_alerts(uuid, uuid);

create function api.list_desktop_alerts(p_subject uuid, p_machine uuid, p_comments boolean default false)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(cloud.v1_alert_json(a) order by a.id), '[]'::json)
  from cloud.alerts a
  where a.account_id = p_subject and a.machine_id = p_machine and a.shown_at is null and a.read_at is null
    and (p_comments or a.kind <> 'comment');
$$;
revoke all on function api.list_desktop_alerts(uuid, uuid, boolean) from public;
grant execute on function api.list_desktop_alerts(uuid, uuid, boolean) to service_role;

-- The menu bar's unread mark stays the review's own; a comment does not stand in for it.
create or replace function api.runner_inbox(p_subject uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'review', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, c.id checkpoint, c.title detail,
               c.updated_at at,
               (select a.id from cloud.alerts a where a.checkpoint_id = c.id and a.kind = 'review' and a.read_at is null
                 order by a.id desc limit 1) alert
          from cloud.task_checkpoints c
          join cloud.tasks t on t.id = c.task_id
          left join cloud.projects p on p.id = t.project_id
         where c.account_id = p_subject and c.status = 'ready'
           and t.status not in ('done', 'failed', 'cancelled')
         order by c.updated_at desc limit 200) x), '[]'::json),
    'running', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, null::text checkpoint,
               (select c.title from cloud.task_checkpoints c
                 where c.task_id = t.id and c.status <> 'approved' order by c.position limit 1) detail,
               t.created_at at, null::text alert
          from cloud.tasks t
          left join cloud.projects p on p.id = t.project_id
         where t.account_id = p_subject and t.status = 'running'
         order by t.created_at desc limit 200) x), '[]'::json)
  );
$$;
