-- What 0084_workspace_boards.before.sql left: the inbox renamed, the memory parked for the move.

do $migrated$
declare
  A constant uuid := 'a0000000-2114-4114-8114-211421142114';
  v_ws text := cloud.v1_personal('a0000000-2114-4114-8114-211421142114');
  v_unfiled text := (select project_id from cloud.tasks where id = 'task_m2114');
  v jsonb;
begin
  assert (select unfiled and name = 'No project' and prefix = 'TASK' from cloud.projects where id = v_unfiled),
    'the inbox was not renamed';
  assert (select prefix from cloud.projects where id = 'prj_m2114') = 'TASK2', 'a project on TASK kept it';
  assert api.v1_task(A, 'task_m2114') ->> 'key' = 'TASK-1', 'a task with no project kept its old key';
  assert not exists (select 1 from cloud.task_aliases where workspace_id = v_ws and prefix = 'INBOX'), 'an INBOX key was kept';
  assert to_regclass('cloud.memories') is null, 'the memory rows are still there';

  v := api.v1_board_move(v_ws);
  assert v -> 'projects' ?& array[v_unfiled, 'prj_m2114'], 'a project''s old board was not moved';
  assert v -> 'files' = jsonb_build_array(
    jsonb_build_object('path', 'memory/agents/planner/decisions.md', 'content', 'D'),
    jsonb_build_object('path', 'memory/readme.md', 'content', 'R'),
    jsonb_build_object('path', 'projects/' || v_unfiled || '/memory/agents/planner/decisions.md', 'content', 'D'),
    jsonb_build_object('path', 'projects/' || v_unfiled || '/memory/readme.md', 'content', 'R')), 'the memory was not parked: ' || (v -> 'files');

  v := api.v1_board_moved(v_ws, jsonb_build_array(jsonb_build_object('task', 'task_m2114', 'path', 'todo/1-task-m2114.md', 'seq', 9)));
  assert (v ->> 'indexed')::int = 1 and (select card_version from cloud.tasks where id = 'task_m2114') = 9, 'a moved card kept its old seq';
  assert (select count(*) from cloud.dropped_boards where board in (v_unfiled, 'prj_m2114')) = 2, 'an old board was not queued';
  v := api.v1_board_move(v_ws);
  assert v = '{"projects": [], "files": []}', 'a moved workspace moved again';
  delete from cloud.accounts where id = A;
end
$migrated$;
