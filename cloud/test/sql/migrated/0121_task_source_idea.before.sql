-- Tasks as they stood before #111, for 0121_task_source_idea.after.sql: one started from an idea
-- with no `idea`, one already naming another.

insert into cloud.accounts (id, handle) values ('a0000000-0111-4111-8111-011101110111', 'mig0111');
insert into cloud.tasks (id, account_id, workspace_id, workflow, title, source, source_context) values
  ('task_m0111a', 'a0000000-0111-4111-8111-011101110111', cloud.v1_personal('a0000000-0111-4111-8111-011101110111'), '{}', 'Started', 'web',
   '{"creator": {"account": "a0000000-0111-4111-8111-011101110111"}}'),
  ('task_m0111b', 'a0000000-0111-4111-8111-011101110111', cloud.v1_personal('a0000000-0111-4111-8111-011101110111'), '{}', 'Named', 'web',
   '{"creator": {"account": "a0000000-0111-4111-8111-011101110111"}, "idea": "idea_kept"}');
insert into cloud.discussions (id, account_id, workspace_id)
  values ('dsc_m0111', 'a0000000-0111-4111-8111-011101110111', cloud.v1_personal('a0000000-0111-4111-8111-011101110111'));
insert into cloud.discussion_ideas (id, discussion_id, title, workflow, state, task_id) values
  ('idea_m0111a', 'dsc_m0111', 'Started', 'wf_builtin_coding', 'started', 'task_m0111a'),
  ('idea_m0111b', 'dsc_m0111', 'Named', 'wf_builtin_coding', 'started', 'task_m0111b');
