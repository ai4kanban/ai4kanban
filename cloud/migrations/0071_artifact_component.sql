-- A member's read of the component an artifact version pinned (#2082): the WildCrane Web card
-- page frames it as the review page does. Reached as the artifact version is.

create function api.v1_artifact_component(p_account uuid, p_artifact text, p_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.component_versions;
begin
  perform cloud.v1_workspace_of(p_account, 'artifact', p_artifact);
  select cv.* into v
  from cloud.artifact_versions av join cloud.component_versions cv on cv.hash = av.component_version
  where av.artifact_id = p_artifact and av.version = p_version;
  if not found then perform cloud.v1_missing('component on this artifact version'); end if;
  if v.deleted_at is not null then
    raise exception 'This component has been removed.' using errcode = 'AKB20';
  end if;
  return cloud.v1_component_version_json(v) || jsonb_build_object('stored', v.hash);
end;
$$;

revoke all on function api.v1_artifact_component(uuid, text, integer) from public;
grant execute on function api.v1_artifact_component(uuid, text, integer) to service_role;
