-- Checkpoints as they stood before #2103, for 0080_review_cards.after.sql: a task three phases in
-- with its second up for review, a single-phase one sent back, and one never submitted.

insert into cloud.accounts (id, handle) values ('a0000000-2103-4103-8103-210321032103', 'mig');
insert into cloud.projects (id, account_id, workspace_id, name)
  values ('prj_mig', 'a0000000-2103-4103-8103-210321032103', cloud.v1_personal('a0000000-2103-4103-8103-210321032103'), 'Mig');
insert into cloud.tasks (id, account_id, workspace_id, project_id, workflow, title, source, card_metadata, status)
values ('task_m1', 'a0000000-2103-4103-8103-210321032103', cloud.v1_personal('a0000000-2103-4103-8103-210321032103'), 'prj_mig', '{}', 'Multi', 'api',
        '{"phases": ["Outline", "Draft", "Polish"], "phase": 2}', 'waiting_review'),
       ('task_m2', 'a0000000-2103-4103-8103-210321032103', cloud.v1_personal('a0000000-2103-4103-8103-210321032103'), 'prj_mig', '{}', 'Single', 'api', '{}', 'waiting_review'),
       ('task_m3', 'a0000000-2103-4103-8103-210321032103', cloud.v1_personal('a0000000-2103-4103-8103-210321032103'), 'prj_mig', '{}', 'Pending', 'api', '{}', 'queued');
insert into cloud.task_checkpoints (id, account_id, task_id, position, key, title, definition, status, review, review_revision, updated_at) values
 ('cp_m1a', 'a0000000-2103-4103-8103-210321032103', 'task_m1', 1, 'phase-1', 'Outline', '{}', 'approved', '{"question":"Q1?"}', 5, now() - interval '2 days'),
 ('cp_m1b', 'a0000000-2103-4103-8103-210321032103', 'task_m1', 2, 'phase-2', 'Draft', '{}', 'ready', '{"question":"Q2?"}', 3, now() - interval '1 day'),
 ('cp_m2', 'a0000000-2103-4103-8103-210321032103', 'task_m2', 1, 'plan', 'Single', '{"question":"Old def?"}', 'changes_requested', null, 2, now()),
 ('cp_m3', 'a0000000-2103-4103-8103-210321032103', 'task_m3', 1, 'plan', 'Pending', '{}', 'pending', null, 0, now());
insert into cloud.checkpoint_revisions (checkpoint_id, revision, account_id) select 'cp_m1a', g, 'a0000000-2103-4103-8103-210321032103' from generate_series(1,5) g;
insert into cloud.checkpoint_revisions (checkpoint_id, revision, account_id) select 'cp_m1b', g, 'a0000000-2103-4103-8103-210321032103' from generate_series(1,3) g;
insert into cloud.checkpoint_comments (id, account_id, task_id, checkpoint_id, body, author) values
 ('cmt_m1', 'a0000000-2103-4103-8103-210321032103', 'task_m1', 'cp_m1a', 'on outline', '{"kind":"user","handle":"mig"}'),
 ('cmt_m2', 'a0000000-2103-4103-8103-210321032103', 'task_m1', 'cp_m1b', 'on draft', '{"kind":"reviewer","email":"x@y.z"}'),
 ('cmt_m3', 'a0000000-2103-4103-8103-210321032103', 'task_m2', 'cp_m2', 'single', '{"kind":"user","handle":"mig"}');
insert into cloud.decisions (id, account_id, checkpoint_id, decision, comment, decided_by, review_revision) values
 ('dec_m1', 'a0000000-2103-4103-8103-210321032103', 'cp_m1a', 'request_changes', 'redo', '{"kind":"user","handle":"mig"}', 2),
 ('dec_m2', 'a0000000-2103-4103-8103-210321032103', 'cp_m1a', 'approve', '', '{"kind":"user","handle":"mig"}', 5),
 ('dec_m3', 'a0000000-2103-4103-8103-210321032103', 'cp_m2', 'request_changes', 'no', '{"kind":"user","handle":"mig"}', 2);
insert into cloud.share_links (id, account_id, checkpoint_id, token_hash, expires_at) values
 ('shr_m1', 'a0000000-2103-4103-8103-210321032103', 'cp_m1a', 'hash-m1', now() + interval '3 days'),
 ('shr_m2', 'a0000000-2103-4103-8103-210321032103', 'cp_m2', 'hash-m2', now() + interval '3 days');
insert into cloud.artifacts (id, account_id, task_id, checkpoint_id, type) values
 ('art_m1', 'a0000000-2103-4103-8103-210321032103', 'task_m1', 'cp_m1b', 'html'),
 ('art_m2', 'a0000000-2103-4103-8103-210321032103', 'task_m1', null, 'html');
insert into cloud.alerts (id, account_id, kind, task_id, checkpoint_id, channel) values
 ('alr_m1', 'a0000000-2103-4103-8103-210321032103', 'review', 'task_m1', 'cp_m1b', 'web');
insert into cloud.alerts (id, account_id, kind, task_id, checkpoint_id, comment_id, channel) values
 ('alr_m2', 'a0000000-2103-4103-8103-210321032103', 'comment', 'task_m1', 'cp_m1b', 'cmt_m2', 'web');
