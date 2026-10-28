-- A guest is emailed when invited (#2055).
--
-- The database keeps only a share link's hash, so the owner's client hands back the link it is
-- sharing; the Worker hashes it and mails the result. An invitation that names a link returns
-- what the message needs, once, when the email is new to the task.

-- AKB28  A request naming something it may not use: here, a share link of another task, or one
--        revoked or expired. The Worker answers 400.

drop function api.v1_add_guest(uuid, text, text, integer);
create function api.v1_add_guest(p_account uuid, p_task text, p_email text, p_daily_write_budget integer,
  p_share_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g cloud.task_guests;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
  v_expires timestamptz;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  if p_share_hash is not null then
    select l.expires_at into v_expires from cloud.share_links l
    join cloud.task_checkpoints c on c.id = l.checkpoint_id
    where l.token_hash = p_share_hash and c.task_id = p_task and l.revoked_at is null and l.expires_at > now();
    if v_expires is null then
      raise exception 'That share link is not an open link of this task.' using errcode = 'AKB28';
    end if;
  end if;
  select * into g from cloud.task_guests where task_id = p_task and email = lower(btrim(p_email));
  if found then return jsonb_build_object('guest', cloud.v1_guest_json(g), 'invite', null); end if;
  if (select count(*) from cloud.task_guests where task_id = p_task) >= 50 then
    perform cloud.v1_refuse('A task takes at most 50 guests.');
  end if;
  insert into cloud.task_guests (task_id, email) values (p_task, lower(btrim(p_email))) returning * into g;
  perform cloud.v1_emit(v_ws, 'guest.added', cloud.v1_guest_json(g));
  return jsonb_build_object('guest', cloud.v1_guest_json(g), 'invite', case when v_expires is not null then
    jsonb_build_object(
      'inviter', (select coalesce(nullif(btrim(a.name), ''), a.handle) from cloud.accounts a where a.id = p_account),
      'title', (select t.title from cloud.tasks t where t.id = p_task),
      'expires_at', cloud.v1_ts(v_expires)) end);
end;
$$;

revoke all on function api.v1_add_guest(uuid, text, text, integer, text) from public;
grant execute on function api.v1_add_guest(uuid, text, text, integer, text) to service_role;
