-- Only the workspace's members decide through a share link (#2062): a guest comments only.
-- The link's task says its status, so the page offers nothing on a task already over.

create or replace function api.v1_shared_decide(p_hash text, p_subject uuid, p_email text, p_picked integer, p_text text, p_revision integer, p_daily_write_budget integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $function$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
  c cloud.task_checkpoints;
  v_option jsonb;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_fields jsonb;
begin
  v := v || jsonb_build_object('author', cloud.v1_reviewer(v ->> 'role', p_subject, p_email));
  select * into c from cloud.task_checkpoints where id = v ->> 'checkpoint';
  if not exists (select 1 from cloud.tasks k where k.id = c.task_id and k.card_path is not null) then
    raise exception 'This checkpoint has no full card to review yet.' using errcode = 'AKB26', detail = 'card_missing';
  end if;
  if p_picked is null then
    if v_text is null then perform cloud.v1_refuse('Write what should change.'); end if;
    v_fields := jsonb_build_object('decision', 'request_changes', 'comment', v_text);
  else
    v_option := coalesce(c.review -> 'options', '[{"label": "Approve", "approve": true}]') -> p_picked;
    if v_option is null or p_picked < 0 then perform cloud.v1_refuse('No option has this number.'); end if;
    v_fields := jsonb_build_object(
      'decision', case when coalesce((v_option ->> 'approve')::boolean, false) then 'approve' else 'request_changes' end,
      'comment', concat_ws(E'\n\n', v_option ->> 'label', v_text));
  end if;
  return jsonb_build_object('workspace', v -> 'workspace', 'result',
    api.v1_create_decision((v ->> 'account')::uuid, c.id, v_fields || jsonb_build_object('review_revision', p_revision),
                           v -> 'author', p_daily_write_budget));
end;
$function$;

create or replace function api.v1_shared(p_hash text, p_subject uuid, p_email text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path = ''
as $function$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_role text := v ->> 'role';
  l cloud.share_links;
  c cloud.task_checkpoints;
  t cloud.tasks;
  v_out jsonb;
begin
  select * into l from cloud.share_links where id = v ->> 'link';
  select * into c from cloud.task_checkpoints where id = l.checkpoint_id;
  select * into t from cloud.tasks where id = c.task_id;

  v_out := jsonb_build_object(
    'object', 'shared_review',
    'role', v_role,
    'me', case when p_subject is null then null else jsonb_build_object('email', lower(p_email),
            'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end,
    'link', jsonb_build_object('id', l.id, 'access', l.access, 'expires_at', cloud.v1_ts(l.expires_at)),
    'owner', (select jsonb_build_object('handle', a.handle, 'name', a.name, 'avatar_url', a.avatar_url)
              from cloud.accounts a where a.id = t.account_id),
    'workspace', (select jsonb_build_object('id', w.id, 'name', w.name) from cloud.v1_workspaces w
                  where w.id = t.workspace_id and v_role in ('owner', 'member')),
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'status', t.status, 'workflow', t.workflow ->> 'name',
              'project', (select p.name from cloud.projects p where p.id = t.project_id)),
    'checkpoint', case when v_role is null then cloud.v1_checkpoint_json(c) - 'status' else cloud.v1_checkpoint_json(c) end,
    'card', case when t.card_path is null then null else jsonb_build_object('version', t.card_version,
              'project', t.project_id, 'path', t.card_path, 'metadata', t.card_metadata, 'assets', t.card_assets) end,
    'artifacts', coalesce((
      select jsonb_agg(cloud.v1_artifact_json(a) || jsonb_build_object('versions', coalesce((
        select jsonb_agg(cloud.v1_version_json(av) #- '{file,url}' order by av.version)
        from cloud.artifact_versions av
        where av.artifact_id = a.id and (av.version = a.latest_version or av.version in (
          select (e.value ->> 'version')::integer from jsonb_each(t.card_assets) e
          where e.value ->> 'artifact' = a.id))), '[]')) order by a.id)
      from cloud.artifacts a where a.id in (select cloud.v1_reviewed_artifacts(c)) and a.latest_version > 0), '[]'));

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
$function$;
