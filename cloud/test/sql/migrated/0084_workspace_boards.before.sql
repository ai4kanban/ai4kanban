-- A workspace as it stood before #2114, for 0084_workspace_boards.after.sql: an inbox with a
-- task, a project of the user's own on `TASK`, and workspace memory rows.

insert into cloud.accounts (id, handle) values ('a0000000-2114-4114-8114-211421142114', 'mig2114');
insert into cloud.projects (id, account_id, workspace_id, name, prefix)
  values ('prj_m2114', 'a0000000-2114-4114-8114-211421142114', cloud.v1_personal('a0000000-2114-4114-8114-211421142114'), 'Tasks', 'TASK');
insert into cloud.tasks (id, account_id, workspace_id, workflow, title, source, card_path, card_version)
values ('task_m2114', 'a0000000-2114-4114-8114-211421142114', cloud.v1_personal('a0000000-2114-4114-8114-211421142114'), '{}', 'Loose', 'api',
        'todo/1-task-m2114.md', 3);
insert into cloud.task_aliases (workspace_id, account_id, prefix, number, task_id)
values (cloud.v1_personal('a0000000-2114-4114-8114-211421142114'), 'a0000000-2114-4114-8114-211421142114', 'INBOX', 7, 'task_m2114');
insert into cloud.memories (id, account_id, workspace_id, scope, name, body) values
 ('mem_m1', 'a0000000-2114-4114-8114-211421142114', cloud.v1_personal('a0000000-2114-4114-8114-211421142114'), 'workspace', 'agents/planner/decisions.md', 'D'),
 ('mem_m2', 'a0000000-2114-4114-8114-211421142114', cloud.v1_personal('a0000000-2114-4114-8114-211421142114'), 'workspace', 'readme.md', 'R');
