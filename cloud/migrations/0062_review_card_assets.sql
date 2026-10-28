-- A review shows what its card shows (#2003): the Runner uploads a card's mockups as the
-- task's own artifacts, named by `card.assets` and tied to no checkpoint, so a link reaches
-- those as well as its checkpoint's.

create function cloud.v1_reviewed_artifacts(c cloud.task_checkpoints) returns setof text
language sql stable security definer set search_path = '' as $$
  select a.id from cloud.artifacts a where a.checkpoint_id = c.id
  union
  select a.id from cloud.task_cards k, jsonb_each(k.assets) e, cloud.artifacts a
   where k.task_id = c.task_id and a.id = e.value ->> 'artifact' and a.task_id = c.task_id;
$$;
revoke all on function cloud.v1_reviewed_artifacts(cloud.task_checkpoints) from public;

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
              from cloud.accounts a where a.id = t.account_id),
    'workspace', (select jsonb_build_object('id', w.id, 'name', w.name) from cloud.v1_workspaces w
                  where w.id = t.workspace_id and v_role in ('owner', 'member')),
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
$$;

create or replace function api.v1_shared_file(p_hash text, p_subject uuid, p_email text, p_artifact text, p_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  c cloud.task_checkpoints;
  v_file jsonb;
begin
  select * into c from cloud.task_checkpoints where id = v ->> 'checkpoint';
  select av.file into v_file from cloud.artifact_versions av
   where av.artifact_id = p_artifact and av.version = p_version and av.artifact_id in (select cloud.v1_reviewed_artifacts(c));
  if not found then perform cloud.v1_missing('artifact version on this checkpoint'); end if;
  return jsonb_build_object('stored', v_file);
end;
$$;
