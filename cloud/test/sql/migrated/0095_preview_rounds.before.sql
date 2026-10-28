-- Workflow versions as they stood before #2152, for 0095_preview_rounds.after.sql: one that
-- delivers its plan and one that builds.

insert into cloud.workflow_versions (id, workflow_id, version, hash, name, delivers, files) values
  ('wfv_mig_plan', 'wf_builtin_mig_plan', 1, 'h', 'Plan', 'plan', '{}'),
  ('wfv_mig_build', 'wf_builtin_mig_build', 1, 'h', 'Build', 'execute', '{}');
