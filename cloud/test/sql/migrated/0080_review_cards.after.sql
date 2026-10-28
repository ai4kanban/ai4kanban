-- What 0080_review_cards.before.sql left, moved onto its tasks (#2103).

do $migrated$
declare
  v jsonb;
begin
  assert (select review_status || '/' || review_phase || '/' || review_revision || '/' || (review ->> 'question')
          from cloud.tasks where id = 'task_m1') = 'ready/2/5/Q2?', 'the ready checkpoint was not the task''s review';
  assert (select review_status || '/' || review_phase || '/' || (review ->> 'question')
          from cloud.tasks where id = 'task_m2') = 'changes_requested/1/Old def?', 'a sent-back plan lost its review';
  assert (select review_status is null and review_phase is null from cloud.tasks where id = 'task_m3'),
    'a checkpoint never submitted became a review';
  assert (select string_agg(phase || ':' || revision, ',' order by phase, revision) from cloud.review_revisions
          where task_id = 'task_m1') = '1:1,1:2,1:3,1:4,1:5,2:1,2:2,2:3', 'revision snapshots were lost';
  assert (select string_agg(id || ':' || task_id || ':' || phase, ',' order by id) from cloud.comments where id like 'cmt_m%')
    = 'cmt_m1:task_m1:1,cmt_m2:task_m1:2,cmt_m3:task_m2:1', 'comments lost their phase';
  assert (select string_agg(id || ':' || task_id || ':' || phase || ':' || review_revision, ',' order by id)
          from cloud.decisions where id like 'dec_m%') = 'dec_m1:task_m1:1:2,dec_m2:task_m1:1:5,dec_m3:task_m2:1:2',
    'decisions lost their task or phase';
  assert (select string_agg(id || ':' || task_id, ',' order by id) from cloud.share_links where id like 'shr_m%')
    = 'shr_m1:task_m1,shr_m2:task_m2', 'share links did not move to their task';
  assert (select string_agg(id || ':' || coalesce(phase::text, '-'), ',' order by id) from cloud.artifacts where id like 'art_m%')
    = 'art_m1:2,art_m2:-', 'artifacts lost their phase';
  assert (select phase from cloud.alerts where id = 'alr_m1') = 2, 'an alert lost its phase';

  -- An old link still opens, now on the phase under review, with every phase's history.
  v := api.v1_shared('hash-m1', 'a0000000-2103-4103-8103-210321032103', null);
  assert v -> 'task' ->> 'id' = 'task_m1' and (v -> 'review' ->> 'phase')::int = 2 and v -> 'review' ->> 'phase_title' = 'Draft'
    and jsonb_array_length(v -> 'comments') = 2 and jsonb_array_length(v -> 'decisions') = 2
    and jsonb_array_length(v -> 'revisions') = 8, 'an old link did not open its task''s review';
  assert api.runner_inbox('a0000000-2103-4103-8103-210321032103') -> 'review' -> 0 ->> 'detail' = 'Draft',
    'the inbox missed the migrated review';
  assert not exists (select 1 from information_schema.columns where table_schema = 'cloud' and column_name like '%checkpoint%')
    and not exists (select 1 from information_schema.tables where table_schema = 'cloud' and table_name like '%checkpoint%'),
    'a checkpoint table or column was left';
  raise notice 'sql checks: #2103 migrated reviews checked';
end
$migrated$;
