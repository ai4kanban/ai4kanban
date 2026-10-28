-- The `No project` row is `general` now; the one the user renamed keeps its name (#2141).

do $$
begin
  assert (select name from cloud.projects where id = cloud.v1_general(cloud.v1_personal('a0000000-2141-4141-8141-214121412141'))) = 'general',
    'No project was not renamed';
  assert (select name from cloud.projects where id = cloud.v1_general(cloud.v1_personal('b0000000-2141-4141-8141-214121412141'))) = 'Inbox',
    'a name the user chose was overwritten';
end $$;
