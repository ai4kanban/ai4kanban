-- What 0095_preview_rounds.before.sql left: one round each, and only the build lands (#2152).

do $migrated$
begin
  assert (select string_agg(id || '/' || rounds || '/' || lands, ',' order by id) from cloud.workflow_versions
          where id like 'wfv\_mig\_%') = 'wfv_mig_build/1/true,wfv_mig_plan/1/false', 'delivers did not become lands';
  delete from cloud.workflow_versions where id like 'wfv\_mig\_%';
end
$migrated$;
