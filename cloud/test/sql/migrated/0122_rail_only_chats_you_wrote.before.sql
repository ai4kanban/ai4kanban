-- Chats as they stood before #113, for 0122_rail_only_chats_you_wrote.after.sql: one holding only
-- its task's request, one the user wrote in, and a Build now chat the user wrote in.

insert into cloud.accounts (id, handle) values ('a0000000-0113-4113-8113-011301130113', 'mig0113');
insert into cloud.tasks (id, account_id, workspace_id, workflow, title, source, source_context, created_at) values
  ('task_m0113a', 'a0000000-0113-4113-8113-011301130113', cloud.v1_personal('a0000000-0113-4113-8113-011301130113'), '{}', 'Request only', 'web',
   '{"creator": {"account": "a0000000-0113-4113-8113-011301130113"}}', '2026-10-01'),
  ('task_m0113b', 'a0000000-0113-4113-8113-011301130113', cloud.v1_personal('a0000000-0113-4113-8113-011301130113'), '{}', 'Written', 'web',
   '{"creator": {"account": "a0000000-0113-4113-8113-011301130113"}}', '2026-10-01');
insert into cloud.task_chats (task_id, account_id, in_rail) values
  ('task_m0113a', 'a0000000-0113-4113-8113-011301130113', true),
  ('task_m0113b', 'a0000000-0113-4113-8113-011301130113', false);
insert into cloud.task_chat_messages (id, task_id, account_id, role, body, created_at) values
  ('msg_m0113a', 'task_m0113a', 'a0000000-0113-4113-8113-011301130113', 'user', 'Request only', '2026-10-01'),
  ('msg_m0113b', 'task_m0113a', 'a0000000-0113-4113-8113-011301130113', 'agent', 'Planned.', '2026-10-02'),
  ('msg_m0113c', 'task_m0113b', 'a0000000-0113-4113-8113-011301130113', 'user', 'Written', '2026-10-01'),
  ('msg_m0113d', 'task_m0113b', 'a0000000-0113-4113-8113-011301130113', 'user', 'Any news?', '2026-10-02');
