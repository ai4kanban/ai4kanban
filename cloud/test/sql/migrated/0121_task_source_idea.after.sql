-- What 0121_task_source_idea.before.sql left: the started task names its idea, the named one keeps its own.

do $migrated$
begin
  assert (select source_context ->> 'idea' from cloud.tasks where id = 'task_m0111a') = 'idea_m0111a', 'a started task was not backfilled';
  assert (select source_context ->> 'idea' from cloud.tasks where id = 'task_m0111b') = 'idea_kept', 'a task''s own idea was overwritten';
  assert (select source_context #>> '{creator,account}' from cloud.tasks where id = 'task_m0111a') is not null, 'the backfill dropped the creator';
  delete from cloud.accounts where id = 'a0000000-0111-4111-8111-011101110111';
end
$migrated$;
